import type { Space } from '../../types/space';
import type { DashboardFilters, DateRange, ScenarioId } from './types';
import { DEFAULT_FILTERS } from './types';
import { findTargetSpace } from '../../services/ai/spaceMatch';

/**
 * Builds a dashboard from a sentence: "show me what is blocked in the sprint and who is overloaded".
 * It reads the words, picks the matching widgets and filters, and tells the person what it understood.
 * No outside AI service is needed, so it works offline and always gives the same result for the same sentence.
 */

export interface DashboardPlan {
  name: string;
  scenario: ScenarioId;
  filters: DashboardFilters;
  entries: string[];
  /** What was understood, in plain words (shown to the person). */
  understood: string[];
}

interface Rule { test: RegExp; topic: string; entries: string[]; scenario?: ScenarioId }

const RULES: Rule[] = [
  { test: /\b(blocked|blocker|blockers|stuck|waiting on)\b/, topic: 'Blocked work', entries: ['stat-blocked', 'blocked'], scenario: 'blocked-risks' },
  { test: /\b(overdue|late|past due|missed)\b/, topic: 'Overdue', entries: ['stat-overdue', 'list-overdue'], scenario: 'blocked-risks' },
  { test: /\b(overload\w*|workload|capacity|busy|busiest|who has|people|team|assignee|per person)\b/, topic: 'Team workload', entries: ['workload', 'bar-assignee'], scenario: 'team-workload' },
  { test: /\b(burn ?down|burn ?up)\b/, topic: 'Sprint burn', entries: ['burndown', 'burnup'], scenario: 'sprint-health' },
  { test: /\b(cumulative flow|cfd)\b/, topic: 'Flow chart', entries: ['cfd'], scenario: 'delivery-flow' },
  { test: /\b(bug|bugs|defect|defects|quality)\b/, topic: 'Bugs', entries: ['stat-bugs', 'bar-priority', 'list-high'], scenario: 'quality-bugs' },
  { test: /\b(roadmap|milestone|milestones)\b/, topic: 'Roadmap', entries: ['roadmap'], scenario: 'roadmap' },
  { test: /\b(epic|epics|project|projects|progress)\b/, topic: 'Progress', entries: ['progress-project', 'progress-epic'], scenario: 'project-progress' },
  { test: /\b(flow|cycle time|lead time|throughput|velocity|speed)\b/, topic: 'Delivery flow', entries: ['throughput', 'stat-lead', 'aging'], scenario: 'delivery-flow' },
  { test: /\b(due|deadline|deadlines|calendar|upcoming)\b/, topic: 'Due dates', entries: ['due-calendar', 'list-due-soon'] },
  { test: /\b(priority|priorities|urgent|critical)\b/, topic: 'Priority', entries: ['bar-priority', 'list-high'] },
  { test: /\b(unassigned|no owner|nobody|no assignee)\b/, topic: 'Unassigned work', entries: ['stat-unassigned', 'list-unassigned'] },
  { test: /\b(stale|idle|old|aging|ageing)\b/, topic: 'Stale work', entries: ['list-stale', 'aging'] },
  { test: /\b(summary|overview|executive|report|status update|headline)\b/, topic: 'Summary', entries: ['summary', 'stat-completion', 'stat-open', 'stat-done-week', 'list-attention'], scenario: 'executive' },
  { test: /\b(sprint|sprints)\b/, topic: 'Sprint', entries: ['stat-completion', 'stat-points-left', 'bar-status'], scenario: 'sprint-health' },
  { test: /\b(done|finished|completed|shipped)\b/, topic: 'Finished work', entries: ['stat-done-week', 'list-recent-done'] },
];

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function isDashboardRequest(text: string): boolean {
  const q = text.toLowerCase();
  return /\bdashboards?\b/.test(q) && /\b(create|build|make|generate|set ?up|new|show|give|need|want|add)\b/.test(q);
}

interface FilterRule { when: (q: string) => boolean; apply: (f: DashboardFilters) => void; note: string }

/** Words that narrow the dashboard, each with the sentence that tells the person what was understood. */
const FILTER_RULES: FilterRule[] = [
  { when: q => /\bsprint\b/.test(q) && !/\bsprints\b.*\ball\b/.test(q), apply: f => { f.sprint = 'current'; }, note: 'Limited to the current sprint.' },
  { when: q => /\b(my|mine|me|myself)\b/.test(q) && !/\b(team|everyone|people)\b/.test(q), apply: f => { f.assignee = 'me'; }, note: 'Only tickets assigned to you.' },
  { when: q => /\bbugs?\b/.test(q), apply: f => { f.types = ['bug']; }, note: 'Only bugs.' },
  { when: q => /\b(high|highest|urgent|critical)\b.*\bpriorit/.test(q) || /\b(urgent|critical)\b/.test(q), apply: f => { f.priorities = ['highest', 'high']; }, note: 'Only high priority work.' },
];

const RANGE_WORDS: { range: DateRange; test: RegExp; label: string }[] = [
  { range: '7d', test: /\b(this week|last week|past week|7 days|seven days)\b/, label: 'last 7 days' },
  { range: '30d', test: /\b(this month|last month|30 days|past month)\b/, label: 'last 30 days' },
  { range: '90d', test: /\b(quarter|90 days|three months)\b/, label: 'last 90 days' },
];

const OVERVIEW_ENTRIES = ['summary', 'stat-open', 'stat-done-week', 'stat-blocked', 'stat-overdue', 'bar-status', 'list-attention'];

/** The widgets and the scenario the words ask for. */
function topicsFor(q: string) {
  const hits = RULES.filter(r => r.test.test(q));
  // the generic "sprint" word should not drown out something more specific
  const specific = hits.filter(h => h.topic !== 'Sprint');
  const used = specific.length ? specific : hits;
  const entries: string[] = [];
  let scenario: ScenarioId | undefined;
  used.forEach(r => {
    r.entries.forEach(id => { if (!entries.includes(id)) entries.push(id); });
    scenario = scenario ?? r.scenario;
  });
  return { topics: used.map(r => r.topic), entries, scenario };
}

/** The filters the words ask for, and a sentence about each. */
function filtersFor(text: string, q: string, spaces: Space[]) {
  const filters: DashboardFilters = { ...DEFAULT_FILTERS };
  const understood: string[] = [];
  for (const rule of FILTER_RULES) {
    if (rule.when(q)) { rule.apply(filters); understood.push(rule.note); }
  }
  const range = RANGE_WORDS.find(r => r.test.test(q));
  if (range) {
    filters.range = range.range;
    understood.push(`Finished work from the ${range.label} (open work always counts).`);
  }
  const space = findTargetSpace(text, spaces);
  if (space?.id && !/\b(all spaces|every space|everything)\b/.test(q)) {
    filters.spaceIds = [space.id];
    understood.push(`Only the ${space.name} space.`);
  }
  return { filters, understood };
}

export function planFromPrompt(text: string, spaces: Space[] = []): DashboardPlan {
  const q = text.toLowerCase();
  const { topics, entries, scenario: found } = topicsFor(q);
  const { filters, understood } = filtersFor(text, q, spaces);
  let scenario = found;

  if (entries.length === 0) {
    // nothing recognised: a general overview
    entries.push(...OVERVIEW_ENTRIES);
    scenario = 'executive';
    topics.push('Overview');
    understood.push('I did not recognise a specific topic, so this is a general overview.');
  } else {
    if (entries.length < 4) ['stat-open', 'stat-done-week'].forEach(id => { if (!entries.includes(id)) entries.unshift(id); });
    understood.unshift(`Topics: ${topics.join(', ')}.`);
  }

  let name = [...new Set(topics)].slice(0, 3).join(' and ');
  if (filters.sprint === 'current') name += ' (this sprint)';
  if (filters.assignee === 'me') { name = `My ${name.toLowerCase()}`; scenario = 'my-work'; }
  return { name: titleCase(name || 'New dashboard'), scenario: scenario ?? 'custom', filters, entries, understood };
}
