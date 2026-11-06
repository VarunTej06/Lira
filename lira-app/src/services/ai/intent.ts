import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import type { RefinedPromptGoal } from './types';
import { currentSprintKey, nextSprint, prevSprint, sprintName } from '../../utils/sprintUtils';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolves a space from user text dynamically (by name, key, significant words, or common aliases).
 * Works automatically for all existing and any future spaces created in Lira.
 */
export function findTargetSpace(text: string, allSpaces: Space[]): Space | undefined {
  const t = text.toLowerCase();

  // 1. Exact match on space key with word boundaries (e.g. "in AP", "AP tasks", "tickets for FIN")
  for (const s of allSpaces) {
    const keyLower = s.key.toLowerCase();
    const keyRegex = new RegExp(`(^|[^a-z0-9])${escapeRegex(keyLower)}([^a-z0-9]|$)`, 'i');
    if (keyRegex.test(t)) {
      return s;
    }
  }

  // 2. Exact match on full space name (e.g. "Atmos - Weather App", "Interview Guide", "Cloud Infrastructure")
  for (const s of allSpaces) {
    const nameLower = s.name.toLowerCase();
    if (t.includes(nameLower)) {
      return s;
    }
  }

  // 3. Significant word token matching for any multi-word space name (present or future):
  const stopWords = new Set([
    'app', 'space', 'project', 'projects', 'hub', 'board', 'team',
    'the', 'and', 'for', 'with', 'task', 'tasks', 'ticket', 'tickets',
    'issue', 'issues', 'item', 'items', 'all', 'show', 'list', 'what', 'give'
  ]);
  for (const s of allSpaces) {
    const words = s.name.toLowerCase().split(/[\s\-_/]+/).filter(w => w.length >= 3 && !stopWords.has(w));
    for (const w of words) {
      const wordRegex = new RegExp(`(^|[^a-z0-9])${escapeRegex(w)}([^a-z0-9]|$)`, 'i');
      if (wordRegex.test(t)) {
        return s;
      }
    }
  }

  // 4. Common shorthand aliases for existing spaces
  for (const s of allSpaces) {
    const keyLower = s.key.toLowerCase();
    if (keyLower === 'ap' && (t.includes('atmos') || t.includes('weather'))) return s;
    if (keyLower === 'ig' && (t.includes('interview') || t.includes('guide'))) return s;
    if (keyLower === 'ai' && (t.includes('ai project') || t.includes('ai-project') || t.includes('machine learning') || t.includes('ai space'))) return s;
    if (keyLower === 'cert' && (t.includes('certification') || t.includes('certs') || t.includes('cert '))) return s;
    if (keyLower === 'crs' && (t.includes('course') || t.includes('courses') || t.includes('class'))) return s;
    if (keyLower === 'cre' && (t.includes('creator') || t.includes('hub'))) return s;
    if (keyLower === 'gen' && (t.includes('general') || t.includes('general tasks'))) return s;
    if (keyLower === 'lira' && t.includes('lira')) return s;
  }

  return undefined;
}

/**
 * Prompt Refinement & Goal Reformulation Engine:
 * Analyzes raw user input, normalizes ticket keys, resolves target spaces,
 * detects the underlying engineering/project intent, and creates an optimized,
 * explicit goal statement to govern autonomous execution.
 */
export function refineUserPrompt(
  rawInput: string,
  allSpaces: Space[],
  allIssues: Issue[],
  activeSpace?: Space
): RefinedPromptGoal {
  const raw = rawInput.trim();
  const q = raw.toLowerCase();

  // 1. Normalize ticket key patterns: "AP-10", "ap10", "ap 10", "LIRA 2", "lira-2"
  let targetTicket: Issue | undefined = undefined;
  let targetTicketKey: string | undefined = undefined;

  const keyPattern = /\b([a-z]{2,10})[- ]?(\d+)\b/i;
  const match = q.match(keyPattern);
  if (match) {
    const prefix = match[1].toUpperCase();
    const num = match[2];
    const candidateKey = `${prefix}-${num}`;
    const found = allIssues.find(i => i.key.toUpperCase() === candidateKey);
    if (found) {
      targetTicket = found;
      targetTicketKey = found.key;
    } else if (allSpaces.some(s => s.key.toUpperCase() === prefix)) {
      targetTicketKey = candidateKey;
    }
  }

  // 2. Resolve target space
  let targetSpace = findTargetSpace(q, allSpaces);
  if (!targetSpace && targetTicket) {
    targetSpace = allSpaces.find(s => s.id === targetTicket!.spaceId);
  }
  if (!targetSpace) {
    targetSpace = activeSpace;
  }

  // 2b. Sprint-aware requests: planning, summary, standup digest, risk radar
  if (!targetTicket) {
    const explicitSpace = findTargetSpace(q, allSpaces);
    const sprintOf = (fallback: string) =>
      /\bnext\b/.test(q) ? nextSprint(currentSprintKey())
        : /\b(last|previous)\b/.test(q) ? prevSprint(currentSprintKey())
        : /\b(this|current)\b/.test(q) ? currentSprintKey()
        : fallback;
    const sprintGoal = (intent: RefinedPromptGoal['intent'], sprint: string | undefined, text: string): RefinedPromptGoal => ({
      originalInput: raw, intent, targetSprint: sprint, targetSpace: explicitSpace, optimizedGoal: text,
    });
    if (/\b(plan|fill|populate|prepare)\b/.test(q) && /\bsprint\b/.test(q)) {
      const s = sprintOf(nextSprint(currentSprintKey()));
      return sprintGoal('sprint_plan', s, `Plan ${sprintName(s)} from the backlog${explicitSpace ? ` of ${explicitSpace.name}` : ''}, highest priority first, within capacity`);
    }
    if (/\b(standup|stand-up|daily update|what did i do|what changed)\b/.test(q)) {
      return sprintGoal('standup_digest', undefined, 'Write a standup from what changed since the last working day');
    }
    if (/\b(risk|at risk|risky|slipping|stale|idle|stuck|behind)\b/.test(q) && /\b(sprint|ticket|tickets|work|radar)\b|^(show |what is |what's )?(the )?risk/.test(q)) {
      return sprintGoal('risk_radar', undefined, 'Find sprints likely to miss their goal and tickets that have sat idle');
    }
    if (/\b(summari[sz]e|summary|recap|how is|how's|status of)\b/.test(q) && /\bsprint\b/.test(q)) {
      const s = sprintOf(currentSprintKey());
      return sprintGoal('sprint_summary', s, `Summarise ${sprintName(s)}`);
    }
  }

  // 3. Status Transition Intent Check (Evaluate before Matrix check to avoid "to done" matching "to do")
  if (targetTicketKey && (
    q.includes('move') || q.includes('mark') || q.includes('set') || q.includes('change') ||
    q.includes('put') || q.includes('promote') || q.includes('complete') || q.includes('transition') ||
    q.includes('done') || q.includes('in progress') || q.includes('inprogress') ||
    /\b(to do|todo)\b/i.test(q) || /\b(backlog)\b/i.test(q)
  )) {
    let targetStatus: string | undefined = undefined;
    if (q.includes('done') || q.includes('complete') || q.includes('finish') || q.includes('resolve')) targetStatus = 'done';
    else if (q.includes('in progress') || q.includes('inprogress') || q.includes('ongoing') || q.includes('working')) targetStatus = 'inprogress';
    else if (/\b(to do|todo)\b/i.test(q)) targetStatus = 'todo';
    else if (/\b(backlog)\b/i.test(q)) targetStatus = 'backlog';

    if (targetStatus) {
      return {
        originalInput: raw,
        intent: 'status_transition',
        targetTicket,
        targetTicketKey,
        targetStatus,
        targetSpace,
        optimizedGoal: `Transition ticket ${targetTicketKey}${targetTicket ? ` ("${targetTicket.title}")` : ''} in ${targetSpace ? targetSpace.name : 'Workspace'} to ${targetStatus.toUpperCase()}`
      };
    }
  }

  // 4. Priority Breakdown (Check before breakdown to avoid matching 'priority breakdown')
  if (q.includes('priority breakdown') || q.includes('by priority') || q.includes('per priority')) {
    return {
      originalInput: raw,
      intent: 'priority_breakdown',
      optimizedGoal: `Calculate priority distribution (Highest, High, Medium, Low) across all ${allSpaces.length} workspace spaces`
    };
  }

  // 5. Subtask Breakdown Intent Check
  const isSubtaskBreakdown =
    q.includes('generate subtasks') ||
    q.includes('add subtasks') ||
    q.includes('break down') ||
    (targetTicketKey && (q.includes('subtask') || q.includes('subtasks') || q.includes('breakdown') || q.includes('split'))) ||
    (!q.includes('priority') && !q.includes('status') && q.includes('breakdown'));

  if (isSubtaskBreakdown) {
    return {
      originalInput: raw,
      intent: 'subtask_breakdown',
      targetTicket,
      targetTicketKey,
      targetSpace,
      optimizedGoal: `Generate technical domain-specific checklist subtasks for ${targetTicketKey || 'ticket'}${targetTicket ? ` ("${targetTicket.title}")` : ''} in ${targetSpace ? targetSpace.name : 'Workspace'}`
    };
  }

  // 6. Status Matrix Intent Check (Strict word boundary for 'to do' so 'to done' is never mistaken)
  const wantsStatusMatrix =
    (/\b(to do|todo)\b/i.test(q) && (q.includes('backlog') || q.includes('in progress') || q.includes('inprogress') || q.includes('done'))) ||
    q.includes('status breakdown') ||
    q.includes('columns breakdown') ||
    q.includes('number of tickets in each') ||
    q.includes('tickets in each') ||
    q.includes('by status') ||
    q.includes('per status') ||
    q.includes('status of all spaces') ||
    (q.includes('all space') && q.includes('status')) ||
    q.includes('matrix');

  if (wantsStatusMatrix) {
    return {
      originalInput: raw,
      intent: 'matrix',
      optimizedGoal: `Generate 4-column status breakdown matrix (Backlog, To Do, In Progress, Done) across all ${allSpaces.length} spaces with workspace totals`,
      targetSpace: undefined
    };
  }

  // 7. Create Issue Intent Check
  const createMatch = q.match(/(?:create|add|new)\s+(?:an?\s+)?(task|bug|epic)?\s*(?:called|named|titled|for|:)?\s*["']?([^"'\n]+)["']?/i);
  if (createMatch && (q.includes('create') || q.includes('add task') || q.includes('new task') || q.includes('add bug') || q.includes('new bug') || q.includes('add epic'))) {
    const rawType = (createMatch[1] || 'task').toLowerCase();
    let title = createMatch[2]?.trim() || '';
    if (targetSpace) {
      title = title.replace(new RegExp(`\\s+(?:in|for|inside|under)\\s+(?:the\\s+)?(?:${escapeRegex(targetSpace.name)}|${escapeRegex(targetSpace.key)}).*$`, 'i'), '');
      const words = targetSpace.name.split(/[\s\-_/]+/).filter(w => w.length >= 3);
      for (const w of words) {
        title = title.replace(new RegExp(`\\s+(?:in|for|inside|under)\\s+(?:the\\s+)?${escapeRegex(w)}.*$`, 'i'), '');
      }
    }
    title = title.replace(/\s+(?:in|for|inside|under)\s+(?:the\s+)?[a-z0-9\s-]+$/i, '');
    title = title.replace(/^(a|an|the)\s+/i, '').replace(/\s+(with|in|at)\s+(high|highest|medium|low|todo|inprogress|backlog).*$/i, '').trim();

    return {
      originalInput: raw,
      intent: 'create_issue',
      newIssueType: rawType,
      newIssueTitle: title,
      targetSpace,
      optimizedGoal: `Create new ${rawType.toUpperCase()} "${title}" in space "${targetSpace ? targetSpace.name : 'Workspace'}" with standard checklist`
    };
  }

  // 8. Ticket Detail Inspection
  if (targetTicket) {
    return {
      originalInput: raw,
      intent: 'ticket_detail',
      targetTicket,
      targetTicketKey: targetTicket.key,
      targetSpace,
      optimizedGoal: `Inspect and retrieve comprehensive issue details, assignee, parent epic, and subtasks for ${targetTicket.key}`
    };
  }

  // 9. Explicit Space Query Check
  const explicitlyMentionedSpace = findTargetSpace(q, allSpaces);
  if (explicitlyMentionedSpace) {
    let statusFilter: string | undefined = undefined;
    if (q.includes('in progress') || q.includes('working on') || q.includes('ongoing')) statusFilter = 'inprogress';
    else if (q.includes('done') || q.includes('completed') || q.includes('finished')) statusFilter = 'done';
    else if (/\b(to do|todo)\b/i.test(q)) statusFilter = 'todo';
    else if (/\b(backlog)\b/i.test(q)) statusFilter = 'backlog';

    if (statusFilter) {
      return {
        originalInput: raw,
        intent: 'space_query',
        targetSpace: explicitlyMentionedSpace,
        targetStatus: statusFilter,
        optimizedGoal: `Query all ${statusFilter.toUpperCase()} work items in space "${explicitlyMentionedSpace.name}" (${explicitlyMentionedSpace.key})`
      };
    }

    return {
      originalInput: raw,
      intent: 'space_query',
      targetSpace: explicitlyMentionedSpace,
      optimizedGoal: `Fetch all tickets, progress metrics, and column breakdown for space "${explicitlyMentionedSpace.name}" (${explicitlyMentionedSpace.key})`
    };
  }

  // 10. Global Status Query
  if (q.includes('in progress') || q.includes('working on') || q.includes('ongoing')) {
    return {
      originalInput: raw,
      intent: 'status_query',
      targetStatus: 'inprogress',
      optimizedGoal: `Query and list all active tasks currently IN PROGRESS across all ${allSpaces.length} workspace spaces`
    };
  }
  if (q.includes('done') || q.includes('completed') || q.includes('finished')) {
    return {
      originalInput: raw,
      intent: 'status_query',
      targetStatus: 'done',
      optimizedGoal: `Query and list all completed deliverables in DONE across all ${allSpaces.length} workspace spaces`
    };
  }
  if (/\b(to do|todo)\b/i.test(q)) {
    return {
      originalInput: raw,
      intent: 'status_query',
      targetStatus: 'todo',
      optimizedGoal: `Query and list all pending tasks in TO DO across all ${allSpaces.length} workspace spaces`
    };
  }
  if (/\b(backlog)\b/i.test(q)) {
    return {
      originalInput: raw,
      intent: 'status_query',
      targetStatus: 'backlog',
      optimizedGoal: `Query and list all backlog work items across all ${allSpaces.length} workspace spaces`
    };
  }

  // 11. Epics List
  if (q.includes('epic') || q.includes('epics')) {
    return {
      originalInput: raw,
      intent: 'epics_list',
      optimizedGoal: `Fetch all project epics and their progress across all workspace spaces`
    };
  }

  // 12. Keyword Search
  const searchMatch = q.match(/(?:search|find|lookup|about|check for)\s+(.+)/i);
  const searchTerm = searchMatch ? searchMatch[1].trim() : (q.length > 3 ? q : '');
  if (searchTerm && !['what', 'how', 'who', 'help', 'hello', 'hi', 'hey'].includes(searchTerm)) {
    return {
      originalInput: raw,
      intent: 'search',
      searchKeyword: searchTerm,
      optimizedGoal: `Search all tickets, titles, descriptions, and labels across all spaces for keyword "${searchTerm}"`
    };
  }

  // 13. Workspace Overview Fallback
  return {
    originalInput: raw,
    intent: 'overview',
    optimizedGoal: `Provide full workspace directory and operational overview across all ${allSpaces.length} spaces`
  };
}
