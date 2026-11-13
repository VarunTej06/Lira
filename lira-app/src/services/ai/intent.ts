import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import type { RefinedPromptGoal } from './types';
import { isDashboardRequest } from '../../utils/dashboards/promptBuilder';
import { escapeRegex, findTargetSpace } from './spaceMatch';
import { currentSprintKey, nextSprint, prevSprint, sprintName } from '../../utils/sprintUtils';

/** What each step below knows about the request. */
interface Ask {
  raw: string;
  /** The request in lower case. */
  q: string;
  spaces: Space[];
  targetTicket?: Issue;
  targetTicketKey?: string;
  targetSpace?: Space;
}
type Detector = (a: Ask) => RefinedPromptGoal | undefined;

const has = (q: string, ...words: string[]) => words.some(w => q.includes(w));
const isTodo = (q: string) => /\b(to do|todo)\b/i.test(q);
const isBacklog = (q: string) => /\b(backlog)\b/i.test(q);
const where = (space?: Space) => (space ? space.name : 'Workspace');

/** The status a "move / mark / set" request names. */
function transitionStatus(q: string): string | undefined {
  if (has(q, 'done', 'complete', 'finish', 'resolve')) return 'done';
  if (has(q, 'in progress', 'inprogress', 'ongoing', 'working')) return 'inprogress';
  if (isTodo(q)) return 'todo';
  return isBacklog(q) ? 'backlog' : undefined;
}

/** The status a "what is in progress / done ..." question names. */
function queriedStatus(q: string): string | undefined {
  if (has(q, 'in progress', 'working on', 'ongoing')) return 'inprogress';
  if (has(q, 'done', 'completed', 'finished')) return 'done';
  if (isTodo(q)) return 'todo';
  return isBacklog(q) ? 'backlog' : undefined;
}

const dashboard: Detector = ({ raw }) => (isDashboardRequest(raw)
  ? { originalInput: raw, intent: 'dashboard_build', optimizedGoal: 'Build a dashboard from the description' }
  : undefined);

/** Planning, summary, standup digest and risk radar: only when the request names no ticket. */
const sprintAware: Detector = ({ raw, q, spaces, targetTicket }) => {
  if (targetTicket) return undefined;
  const space = findTargetSpace(q, spaces);
  const sprintOf = (fallback: string) =>
    /\bnext\b/.test(q) ? nextSprint(currentSprintKey())
      : /\b(last|previous)\b/.test(q) ? prevSprint(currentSprintKey())
      : /\b(this|current)\b/.test(q) ? currentSprintKey()
      : fallback;
  const goal = (intent: RefinedPromptGoal['intent'], sprint: string | undefined, text: string): RefinedPromptGoal => ({ originalInput: raw, intent, targetSprint: sprint, targetSpace: space, optimizedGoal: text });

  if (/\b(plan|fill|populate|prepare)\b/.test(q) && /\bsprint\b/.test(q)) {
    const s = sprintOf(nextSprint(currentSprintKey()));
    return goal('sprint_plan', s, `Plan ${sprintName(s)} from the backlog${space ? ` of ${space.name}` : ''}, highest priority first, within capacity`);
  }
  if (/\b(standup|stand-up|daily update|what did i do|what changed)\b/.test(q)) return goal('standup_digest', undefined, 'Write a standup from what changed since the last working day');
  if (/\b(risk|at risk|risky|slipping|stale|idle|stuck|behind)\b/.test(q) && /\b(sprint|ticket|tickets|work|radar)\b|^(show |what is |what's )?(the )?risk/.test(q)) {
    return goal('risk_radar', undefined, 'Find sprints likely to miss their goal and tickets that have sat idle');
  }
  if (/\b(summari[sz]e|summary|recap|how is|how's|status of)\b/.test(q) && /\bsprint\b/.test(q)) {
    const s = sprintOf(currentSprintKey());
    return goal('sprint_summary', s, `Summarise ${sprintName(s)}`);
  }
  return undefined;
};

/** "Move AP-10 to done". Checked before the status matrix so "to done" is never read as "to do". */
const statusTransition: Detector = ({ raw, q, targetTicket, targetTicketKey, targetSpace }) => {
  const mentionsChange = has(q, 'move', 'mark', 'set', 'change', 'put', 'promote', 'complete', 'transition', 'done', 'in progress', 'inprogress') || isTodo(q) || isBacklog(q);
  const targetStatus = targetTicketKey && mentionsChange ? transitionStatus(q) : undefined;
  if (!targetStatus) return undefined;
  return {
    originalInput: raw, intent: 'status_transition', targetTicket, targetTicketKey, targetStatus, targetSpace,
    optimizedGoal: `Transition ticket ${targetTicketKey}${targetTicket ? ` ("${targetTicket.title}")` : ''} in ${where(targetSpace)} to ${targetStatus.toUpperCase()}`,
  };
};

/** Checked before the subtask breakdown so "priority breakdown" is not mistaken for it. */
const priorityBreakdown: Detector = ({ raw, q, spaces }) => (has(q, 'priority breakdown', 'by priority', 'per priority')
  ? { originalInput: raw, intent: 'priority_breakdown', optimizedGoal: `Calculate priority distribution (Highest, High, Medium, Low) across all ${spaces.length} workspace spaces` }
  : undefined);

const subtaskBreakdown: Detector = ({ raw, q, targetTicket, targetTicketKey, targetSpace }) => {
  const wanted = has(q, 'generate subtasks', 'add subtasks', 'break down')
    || (!!targetTicketKey && has(q, 'subtask', 'breakdown', 'split'))
    || (!has(q, 'priority', 'status') && q.includes('breakdown'));
  return wanted ? {
    originalInput: raw, intent: 'subtask_breakdown', targetTicket, targetTicketKey, targetSpace,
    optimizedGoal: `Generate technical domain-specific checklist subtasks for ${targetTicketKey || 'ticket'}${targetTicket ? ` ("${targetTicket.title}")` : ''} in ${where(targetSpace)}`,
  } : undefined;
};

/** The four-column table of every space. "to do" has strict word boundaries so "to done" is never mistaken. */
const statusMatrix: Detector = ({ raw, q, spaces }) => {
  const wanted = (isTodo(q) && has(q, 'backlog', 'in progress', 'inprogress', 'done'))
    || has(q, 'status breakdown', 'columns breakdown', 'number of tickets in each', 'tickets in each', 'by status', 'per status', 'status of all spaces', 'matrix')
    || (q.includes('all space') && q.includes('status'));
  return wanted
    ? { originalInput: raw, intent: 'matrix', targetSpace: undefined, optimizedGoal: `Generate 4-column status breakdown matrix (Backlog, To Do, In Progress, Done) across all ${spaces.length} spaces with workspace totals` }
    : undefined;
};

/** Takes the space's name out of a title such as "Fix login in Atmos". */
function titleWithoutSpace(title: string, space?: Space): string {
  let t = title;
  const trailing = (name: string) => new RegExp(`\\s+(?:in|for|inside|under)\\s+(?:the\\s+)?${name}.*$`, 'i');
  if (space) {
    t = t.replace(trailing(`(?:${escapeRegex(space.name)}|${escapeRegex(space.key)})`), '');
    for (const w of space.name.split(/[\s\-_/]+/).filter(w => w.length >= 3)) t = t.replace(trailing(escapeRegex(w)), '');
  }
  return t
    .replace(/\s+(?:in|for|inside|under)\s+(?:the\s+)?[a-z0-9\s-]+$/i, '')
    .replace(/^(a|an|the)\s+/i, '')
    .replace(/\s+(with|in|at)\s+(high|highest|medium|low|todo|inprogress|backlog).*$/i, '')
    .trim();
}

const createIssue: Detector = ({ raw, q, targetSpace }) => {
  const m = q.match(/(?:create|add|new)\s+(?:an?\s+)?(task|bug|epic)?\s*(?:called|named|titled|for|:)?\s*["']?([^"'\n]+)["']?/i);
  if (!m || !has(q, 'create', 'add task', 'new task', 'add bug', 'new bug', 'add epic')) return undefined;
  const type = (m[1] || 'task').toLowerCase();
  const title = titleWithoutSpace(m[2]?.trim() || '', targetSpace);
  return {
    originalInput: raw, intent: 'create_issue', newIssueType: type, newIssueTitle: title, targetSpace,
    optimizedGoal: `Create new ${type.toUpperCase()} "${title}" in space "${where(targetSpace)}" with standard checklist`,
  };
};

const ticketDetail: Detector = ({ raw, targetTicket, targetSpace }) => (targetTicket
  ? { originalInput: raw, intent: 'ticket_detail', targetTicket, targetTicketKey: targetTicket.key, targetSpace, optimizedGoal: `Inspect and retrieve comprehensive issue details, assignee, parent epic, and subtasks for ${targetTicket.key}` }
  : undefined);

const spaceQuery: Detector = ({ raw, q, spaces }) => {
  const space = findTargetSpace(q, spaces);
  if (!space) return undefined;
  const status = queriedStatus(q);
  return status
    ? { originalInput: raw, intent: 'space_query', targetSpace: space, targetStatus: status, optimizedGoal: `Query all ${status.toUpperCase()} work items in space "${space.name}" (${space.key})` }
    : { originalInput: raw, intent: 'space_query', targetSpace: space, optimizedGoal: `Fetch all tickets, progress metrics, and column breakdown for space "${space.name}" (${space.key})` };
};

const STATUS_QUERY_GOAL: Record<string, string> = {
  inprogress: 'Query and list all active tasks currently IN PROGRESS',
  done: 'Query and list all completed deliverables in DONE',
  todo: 'Query and list all pending tasks in TO DO',
  backlog: 'Query and list all backlog work items',
};
const statusQuery: Detector = ({ raw, q, spaces }) => {
  const status = queriedStatus(q);
  return status ? { originalInput: raw, intent: 'status_query', targetStatus: status, optimizedGoal: `${STATUS_QUERY_GOAL[status]} across all ${spaces.length} workspace spaces` } : undefined;
};

const epicsList: Detector = ({ raw, q }) => (q.includes('epic')
  ? { originalInput: raw, intent: 'epics_list', optimizedGoal: 'Fetch all project epics and their progress across all workspace spaces' }
  : undefined);

const NOT_A_SEARCH = ['what', 'how', 'who', 'help', 'hello', 'hi', 'hey'];
const keywordSearch: Detector = ({ raw, q }) => {
  const m = q.match(/(?:search|find|lookup|about|check for)\s+(.+)/i);
  const term = m ? m[1].trim() : (q.length > 3 ? q : '');
  return term && !NOT_A_SEARCH.includes(term)
    ? { originalInput: raw, intent: 'search', searchKeyword: term, optimizedGoal: `Search all tickets, titles, descriptions, and labels across all spaces for keyword "${term}"` }
    : undefined;
};

/** In the order they are tried: the first one that recognises the request wins. */
const DETECTORS: Detector[] = [
  dashboard, sprintAware, statusTransition, priorityBreakdown, subtaskBreakdown, statusMatrix, createIssue,
  ticketDetail, spaceQuery, statusQuery, epicsList, keywordSearch,
];

/**
 * Prompt Refinement & Goal Reformulation Engine:
 * Analyzes raw user input, normalizes ticket keys, resolves target spaces,
 * detects the underlying engineering/project intent, and creates an optimized,
 * explicit goal statement to govern autonomous execution.
 */
export function refineUserPrompt(rawInput: string, allSpaces: Space[], allIssues: Issue[], activeSpace?: Space): RefinedPromptGoal {
  const raw = rawInput.trim();
  const q = raw.toLowerCase();

  // A ticket key: "AP-10", "ap10", "ap 10", "LIRA 2", "lira-2"
  let targetTicket: Issue | undefined;
  let targetTicketKey: string | undefined;
  const match = q.match(/\b([a-z]{2,10})[- ]?(\d+)\b/i);
  if (match) {
    const prefix = match[1].toUpperCase();
    const candidate = `${prefix}-${match[2]}`;
    targetTicket = allIssues.find(i => i.key.toUpperCase() === candidate);
    if (targetTicket) targetTicketKey = targetTicket.key;
    else if (allSpaces.some(s => s.key.toUpperCase() === prefix)) targetTicketKey = candidate;
  }

  // The space: named in the request, else the ticket's, else the one on screen
  const targetSpace = findTargetSpace(q, allSpaces)
    ?? (targetTicket && allSpaces.find(s => s.id === targetTicket!.spaceId))
    ?? activeSpace;

  const ask: Ask = { raw, q, spaces: allSpaces, targetTicket, targetTicketKey, targetSpace };
  for (const detect of DETECTORS) {
    const goal = detect(ask);
    if (goal) return goal;
  }
  return { originalInput: raw, intent: 'overview', optimizedGoal: `Provide full workspace directory and operational overview across all ${allSpaces.length} spaces` };
}
