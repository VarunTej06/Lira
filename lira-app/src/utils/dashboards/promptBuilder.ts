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

export function planFromPrompt(text: string, spaces: Space[] = []): DashboardPlan {
  const q = text.toLowerCase();
  const understood: string[] = [];
  const filters: DashboardFilters = { ...DEFAULT_FILTERS };
  const entries: string[] = [];
  const topics: string[] = [];
  let scenario: ScenarioId | undefined;

  const hits = RULES.filter(r => r.test.test(q));
  // the generic "sprint" word should not drown out something more specific
  const specific = hits.filter(h => h.topic !== 'Sprint');
  const used = specific.length ? specific : hits;
  used.forEach(r => {
    topics.push(r.topic);
    r.entries.forEach(id => { if (!entries.includes(id)) entries.push(id); });
    scenario = scenario ?? r.scenario;
  });

  if (/\bsprint\b/.test(q) && !/\bsprints\b.*\ball\b/.test(q)) { filters.sprint = 'current'; understood.push('Limited to the current sprint.'); }
  if (/\b(my|mine|me|myself)\b/.test(q) && !/\b(team|everyone|people)\b/.test(q)) { filters.assignee = 'me'; understood.push('Only tickets assigned to you.'); }
  if (/\bbugs?\b/.test(q)) { filters.types = ['bug']; understood.push('Only bugs.'); }
  if (/\b(high|highest|urgent|critical)\b.*\bpriorit/.test(q) || /\b(urgent|critical)\b/.test(q)) { filters.priorities = ['highest', 'high']; understood.push('Only high priority work.'); }
  const range: DateRange | null = /\b(this week|last week|past week|7 days|seven days)\b/.test(q) ? '7d' : /\b(this month|last month|30 days|past month)\b/.test(q) ? '30d' : /\b(quarter|90 days|three months)\b/.test(q) ? '90d' : null;
  if (range) { filters.range = range; understood.push(`Finished work from the ${range === '7d' ? 'last 7 days' : range === '30d' ? 'last 30 days' : 'last 90 days'} (open work always counts).`); }
  const space = findTargetSpace(text, spaces);
  if (space?.id && !/\b(all spaces|every space|everything)\b/.test(q)) { filters.spaceIds = [space.id]; understood.push(`Only the ${space.name} space.`); }

  if (entries.length === 0) {
    // nothing recognised: a general overview
    entries.push('summary', 'stat-open', 'stat-done-week', 'stat-blocked', 'stat-overdue', 'bar-status', 'list-attention');
    scenario = 'executive';
    topics.push('Overview');
    understood.push('I did not recognise a specific topic, so this is a general overview.');
  } else {
    if (entries.length < 4) ['stat-open', 'stat-done-week'].forEach(id => { if (!entries.includes(id)) entries.unshift(id); });
    understood.unshift(`Topics: ${topics.join(', ')}.`);
  }

  const parts = [...new Set(topics)].slice(0, 3);
  let name = parts.join(' and ');
  if (filters.sprint === 'current') name += ' (this sprint)';
  if (filters.assignee === 'me') name = `My ${name.toLowerCase()}`;
  if (filters.assignee === 'me') scenario = 'my-work';
  return { name: titleCase(name || 'New dashboard'), scenario: scenario ?? 'custom', filters, entries, understood };
}
