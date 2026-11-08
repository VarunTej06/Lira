import type { DashboardFilters, DashboardWidget, ScenarioId, WidgetConfig, WidgetSize, WidgetType } from './types';
import { DEFAULT_FILTERS } from './types';

/**
 * The widget gallery and the dashboard scenarios the wizard offers. A catalog entry says what a widget is and how big
 * it starts; a scenario is a goal ("sprint health") with the filters and widgets that answer it.
 */

export type WidgetCategory = 'Numbers' | 'Charts' | 'Over time' | 'Sprint' | 'Lists' | 'People' | 'Progress' | 'Summary';
export const CATEGORY_ORDER: WidgetCategory[] = ['Numbers', 'Charts', 'Over time', 'Sprint', 'Lists', 'People', 'Progress', 'Summary'];

export interface CatalogEntry {
  id: string;
  type: WidgetType;
  title: string;
  description: string;
  category: WidgetCategory;
  size: WidgetSize;
  height: 1 | 2 | 3;
  config: WidgetConfig;
}

const e = (id: string, type: WidgetType, title: string, description: string, category: WidgetCategory, size: WidgetSize, height: 1 | 2 | 3, config: WidgetConfig = {}): CatalogEntry =>
  ({ id, type, title, description, category, size, height, config });

export const CATALOG: CatalogEntry[] = [
  // Numbers
  e('stat-open', 'stat', 'Open tickets', 'Everything not done, with the change since last week', 'Numbers', 'S', 1, { metric: 'open' }),
  e('stat-total', 'stat', 'All tickets', 'Every ticket in scope', 'Numbers', 'S', 1, { metric: 'total' }),
  e('stat-done', 'stat', 'Done', 'Finished tickets', 'Numbers', 'S', 1, { metric: 'done' }),
  e('stat-in-progress', 'stat', 'In progress', 'Work being done now', 'Numbers', 'S', 1, { metric: 'in_progress' }),
  e('stat-done-week', 'stat', 'Done this week', 'Finished in the last 7 days', 'Numbers', 'S', 1, { metric: 'done_week' }),
  e('stat-created-week', 'stat', 'Created this week', 'Added in the last 7 days', 'Numbers', 'S', 1, { metric: 'created_week' }),
  e('stat-blocked', 'stat', 'Blocked', 'Tickets switched to Blocked', 'Numbers', 'S', 1, { metric: 'blocked' }),
  e('stat-overdue', 'stat', 'Overdue', 'Past their due date and not done', 'Numbers', 'S', 1, { metric: 'overdue' }),
  e('stat-due-soon', 'stat', 'Due in 7 days', 'Due within the next week', 'Numbers', 'S', 1, { metric: 'due_soon' }),
  e('stat-unassigned', 'stat', 'Unassigned', 'Open tickets with nobody on them', 'Numbers', 'S', 1, { metric: 'unassigned' }),
  e('stat-high', 'stat', 'High priority open', 'Highest and High, not done', 'Numbers', 'S', 1, { metric: 'high_priority' }),
  e('stat-bugs', 'stat', 'Open bugs', 'Bugs not yet fixed', 'Numbers', 'S', 1, { metric: 'bugs_open' }),
  e('stat-points-left', 'stat', 'Points left', 'Story points not done', 'Numbers', 'S', 1, { metric: 'points_open' }),
  e('stat-points-done', 'stat', 'Points done', 'Story points finished', 'Numbers', 'S', 1, { metric: 'points_done' }),
  e('stat-lead', 'stat', 'Average lead time', 'Days from created to done', 'Numbers', 'S', 1, { metric: 'lead_days' }),
  e('stat-completion', 'stat', 'Completion', 'Share of tickets done', 'Numbers', 'S', 1, { metric: 'completion' }),
  // Charts
  e('bar-status', 'bar', 'Tickets by status', 'How many tickets are in each status', 'Charts', 'M', 2, { groupBy: 'status', measure: 'count' }),
  e('bar-priority', 'bar', 'Tickets by priority', 'Highest to lowest', 'Charts', 'M', 2, { groupBy: 'priority', measure: 'count' }),
  e('bar-type', 'bar', 'Tickets by type', 'Tasks, bugs and subtasks', 'Charts', 'M', 2, { groupBy: 'type', measure: 'count' }),
  e('bar-assignee', 'bar', 'Points by person', 'Story points per assignee', 'Charts', 'M', 2, { groupBy: 'assignee', measure: 'points' }),
  e('bar-label', 'bar', 'Tickets by label', 'The most used labels', 'Charts', 'M', 2, { groupBy: 'label', measure: 'count' }),
  e('bar-epic', 'bar', 'Tickets by epic', 'Work spread over epics', 'Charts', 'M', 2, { groupBy: 'epic', measure: 'count' }),
  e('bar-sprint', 'bar', 'Tickets by sprint', 'How each sprint is loaded', 'Charts', 'M', 2, { groupBy: 'sprint', measure: 'count' }),
  e('bar-space', 'bar', 'Tickets by space', 'Work per space', 'Charts', 'M', 2, { groupBy: 'space', measure: 'count' }),
  e('donut-status', 'donut', 'Status split', 'Share of tickets in each status', 'Charts', 'M', 2, { groupBy: 'status', measure: 'count' }),
  e('donut-priority', 'donut', 'Priority split', 'Share of tickets by priority', 'Charts', 'M', 2, { groupBy: 'priority', measure: 'count' }),
  e('donut-type', 'donut', 'Type split', 'Share of tasks, bugs and subtasks', 'Charts', 'M', 2, { groupBy: 'type', measure: 'count' }),
  e('donut-space', 'donut', 'Space split', 'Share of work per space', 'Charts', 'M', 2, { groupBy: 'space', measure: 'count' }),
  // Over time
  e('trend-open', 'trend', 'Created vs finished', 'Tickets created and finished each week, and how many stay open', 'Over time', 'L', 2, { weeks: 8 }),
  e('throughput', 'throughput', 'Weekly throughput', 'Tickets finished each week', 'Over time', 'M', 2, { weeks: 8 }),
  e('aging', 'aging', 'Aging work in progress', 'How long tickets have been in progress', 'Over time', 'M', 2),
  e('due-calendar', 'due', 'Due dates, next 14 days', 'How many tickets fall due each day', 'Over time', 'L', 1),
  // Sprint
  e('burndown', 'burndown', 'Sprint burndown', 'Story points left in the sprint, day by day', 'Sprint', 'L', 2),
  e('burnup', 'burnup', 'Sprint burnup', 'Scope against work finished', 'Sprint', 'L', 2),
  e('cfd', 'cfd', 'Cumulative flow', 'Tickets in each status, day by day', 'Sprint', 'L', 2),
  // Lists
  e('list-attention', 'list', 'Needs attention', 'Overdue, blocked, stuck or urgent work', 'Lists', 'L', 2, { list: 'attention', limit: 8 }),
  e('list-overdue', 'list', 'Overdue tickets', 'Past the due date', 'Lists', 'M', 2, { list: 'overdue', limit: 8 }),
  e('list-due-soon', 'list', 'Due soon', 'Due in the next 7 days', 'Lists', 'M', 2, { list: 'due_soon', limit: 8 }),
  e('list-my-open', 'list', 'My open tickets', 'Assigned to me, not done', 'Lists', 'L', 2, { list: 'my_open', limit: 8 }),
  e('list-recent-done', 'list', 'Recently done', 'Finished in the last 14 days', 'Lists', 'M', 2, { list: 'recent_done', limit: 8 }),
  e('list-high', 'list', 'High priority', 'Highest and High, not done', 'Lists', 'M', 2, { list: 'high_priority', limit: 8 }),
  e('list-unassigned', 'list', 'Unassigned work', 'Open work with nobody on it', 'Lists', 'M', 2, { list: 'unassigned', limit: 8 }),
  e('list-stale', 'list', 'Stale tickets', 'No update for 14 days or more', 'Lists', 'M', 2, { list: 'stale', limit: 8 }),
  e('list-recent', 'list', 'Recently updated', 'The latest changes', 'Lists', 'M', 2, { list: 'recent', limit: 8 }),
  e('blocked', 'blocked', 'Blocked tickets', 'What is blocked, by what, and for how long', 'Lists', 'L', 2, { limit: 8 }),
  // People
  e('workload', 'workload', 'Team workload', 'Open tickets and points per person, with overload warnings', 'People', 'XL', 2),
  // Progress
  e('progress-epic', 'progress', 'Progress by epic', 'How far each epic is', 'Progress', 'L', 2, { progressBy: 'epic', limit: 8 }),
  e('progress-project', 'progress', 'Progress by project', 'How far each project is', 'Progress', 'L', 2, { progressBy: 'project', limit: 8 }),
  e('progress-sprint', 'progress', 'Progress by sprint', 'Done against planned in every sprint', 'Progress', 'L', 2, { progressBy: 'sprint', limit: 8 }),
  e('roadmap', 'roadmap', 'Roadmap status', 'Roadmap items, the ones needing attention first', 'Progress', 'L', 2, { limit: 8 }),
  // Summary
  e('summary', 'summary', 'Headline summary', 'A few plain sentences about the state of the work', 'Summary', 'XL', 1),
];

export const entryById = (id: string) => CATALOG.find(c => c.id === id);

/** The widgets that need a sprint: they follow the dashboard's sprint, or the current one. */
export const SPRINT_TYPES: WidgetType[] = ['burndown', 'burnup', 'cfd'];

export interface Scenario {
  id: ScenarioId;
  name: string;
  tagline: string;
  /** Who it is for. */
  audience: string;
  icon: 'user' | 'gauge' | 'users' | 'ban' | 'workflow' | 'folder' | 'map' | 'bug' | 'briefcase' | 'sliders';
  filters: Partial<DashboardFilters>;
  /** Catalog entries it starts with (in order). */
  widgets: string[];
}

export const SCENARIOS: Scenario[] = [
  { id: 'my-work', name: 'My work', tagline: 'What is on my plate, what is late, what I finished', audience: 'Me', icon: 'user', filters: { assignee: 'me' },
    widgets: ['stat-open', 'stat-overdue', 'stat-due-soon', 'stat-done-week', 'list-my-open', 'list-overdue', 'blocked', 'due-calendar', 'bar-status', 'list-recent-done'] },
  { id: 'sprint-health', name: 'Sprint health', tagline: 'Is the sprint on track: burndown, scope, carry-over', audience: 'Whoever runs the sprint', icon: 'gauge', filters: { sprint: 'current' },
    widgets: ['stat-completion', 'stat-points-left', 'stat-points-done', 'stat-blocked', 'burndown', 'burnup', 'cfd', 'bar-status', 'list-attention', 'workload'] },
  { id: 'team-workload', name: 'Team workload', tagline: 'Who has how much, who is overloaded, what has no owner', audience: 'Team lead', icon: 'users', filters: {},
    widgets: ['stat-open', 'stat-unassigned', 'stat-points-left', 'stat-in-progress', 'workload', 'bar-assignee', 'donut-priority', 'list-unassigned'] },
  { id: 'blocked-risks', name: 'Blocked and risks', tagline: 'What is stuck, late or urgent, and what is blocking it', audience: 'Anyone', icon: 'ban', filters: {},
    widgets: ['stat-blocked', 'stat-overdue', 'stat-high', 'stat-unassigned', 'blocked', 'list-attention', 'list-stale', 'aging'] },
  { id: 'delivery-flow', name: 'Delivery and flow', tagline: 'How fast work moves: throughput, lead time, aging', audience: 'Process improvement', icon: 'workflow', filters: { range: '90d' },
    widgets: ['stat-lead', 'stat-done-week', 'stat-created-week', 'stat-in-progress', 'throughput', 'trend-open', 'cfd', 'aging'] },
  { id: 'project-progress', name: 'Project progress', tagline: 'How far each project and epic has come', audience: 'Project owner', icon: 'folder', filters: {},
    widgets: ['stat-completion', 'stat-open', 'stat-due-soon', 'progress-project', 'progress-epic', 'due-calendar', 'list-due-soon'] },
  { id: 'roadmap', name: 'Roadmap view', tagline: 'Which roadmap items are on track, late or blocked', audience: 'Planning', icon: 'map', filters: {},
    widgets: ['summary', 'roadmap', 'progress-epic', 'stat-completion', 'list-due-soon'] },
  { id: 'quality-bugs', name: 'Quality and bugs', tagline: 'Open bugs, how urgent, how fast they get fixed', audience: 'QA and engineering', icon: 'bug', filters: { types: ['bug'] },
    widgets: ['stat-bugs', 'stat-done-week', 'stat-lead', 'bar-priority', 'throughput', 'trend-open', 'list-high', 'aging'] },
  { id: 'executive', name: 'Executive summary', tagline: 'One screen of headline numbers and what needs attention', audience: 'Managers, meetings', icon: 'briefcase', filters: {},
    widgets: ['summary', 'stat-completion', 'stat-open', 'stat-done-week', 'stat-blocked', 'stat-overdue', 'trend-open', 'donut-status', 'progress-project', 'list-attention', 'roadmap'] },
  { id: 'custom', name: 'Custom', tagline: 'Start empty and pick every widget yourself', audience: 'Anyone', icon: 'sliders', filters: {}, widgets: [] },
];

export const scenarioById = (id: ScenarioId) => SCENARIOS.find(s => s.id === id) ?? SCENARIOS[SCENARIOS.length - 1];

let counter = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** A widget placed on a dashboard from a catalog entry. */
export function widgetFromEntry(entryId: string, over: Partial<DashboardWidget> = {}): DashboardWidget | undefined {
  const entry = entryById(entryId);
  if (!entry) return undefined;
  return { id: newId('w'), entry: entry.id, type: entry.type, title: entry.title, size: entry.size, height: entry.height, config: { ...entry.config }, ...over };
}

export function scenarioFilters(s: Scenario): DashboardFilters {
  return { ...DEFAULT_FILTERS, ...s.filters };
}
