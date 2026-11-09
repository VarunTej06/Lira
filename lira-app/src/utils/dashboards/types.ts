/**
 * Dashboards: what is saved (data/dashboards.json, through the disk mirror) and the vocabulary the wizard and the
 * widgets share. Everything here is plain data, so a dashboard can be copied, exported and rebuilt.
 */

export type WidgetType =
  | 'stat' | 'bar' | 'donut' | 'trend' | 'throughput' | 'burndown' | 'burnup' | 'cfd'
  | 'list' | 'progress' | 'workload' | 'due' | 'blocked' | 'aging' | 'roadmap' | 'summary';

export type GroupBy = 'status' | 'priority' | 'type' | 'assignee' | 'label' | 'epic' | 'sprint' | 'space';
export type Measure = 'count' | 'points';
export type StatMetric =
  | 'open' | 'total' | 'done' | 'in_progress' | 'blocked' | 'overdue' | 'due_soon' | 'unassigned' | 'high_priority'
  | 'bugs_open' | 'points_open' | 'points_done' | 'done_week' | 'created_week' | 'lead_days' | 'completion';
export type ListKind = 'attention' | 'overdue' | 'due_soon' | 'my_open' | 'recent_done' | 'high_priority' | 'unassigned' | 'stale' | 'recent';
export type ProgressBy = 'epic' | 'project' | 'sprint';

export interface WidgetConfig {
  metric?: StatMetric;
  groupBy?: GroupBy;
  measure?: Measure;
  list?: ListKind;
  progressBy?: ProgressBy;
  /** How many rows or bars to show. */
  limit?: number;
  /** Weeks shown by the trend and throughput charts. */
  weeks?: number;
}

export type DateRange = 'all' | '7d' | '30d' | '90d';

export interface DashboardFilters {
  /** Empty = every space. */
  spaceIds: number[];
  /** 'all', 'current' (the sprint running now) or a sprint key such as 2026-11. */
  sprint: string;
  /** Open work plus whatever was finished in this period. */
  range: DateRange;
  /** 'all', 'me', 'unassigned' or a person's name. */
  assignee: string;
  priorities: string[];
  labels: string[];
  /** Ticket types: epic, task, bug, subtask. Empty = all. */
  types: string[];
}

export const DEFAULT_FILTERS: DashboardFilters = { spaceIds: [], sprint: 'all', range: 'all', assignee: 'all', priorities: [], labels: [], types: [] };

/** Widget width on a 12-column grid. */
export type WidgetSize = 'S' | 'M' | 'L' | 'XL';
export const SIZE_LABEL: Record<WidgetSize, string> = { S: 'Small', M: 'Medium', L: 'Large', XL: 'Full width' };
export const SIZE_ORDER: WidgetSize[] = ['S', 'M', 'L', 'XL'];

export interface DashboardWidget {
  id: string;
  /** The catalog entry it came from (for the "Add widget" gallery). */
  entry: string;
  type: WidgetType;
  title: string;
  size: WidgetSize;
  /** Height in steps of about 150px: 1 (short), 2, 3 (tall). */
  height: 1 | 2 | 3;
  config: WidgetConfig;
  /** Settings of this widget only, laid over the dashboard's own filters. */
  filters?: Partial<DashboardFilters>;
}

/** "Tell me when ..." rule. `above`: warn when the number is more than the limit. `below`: warn when it is fewer. */
export interface DashboardGoal {
  id: string;
  metric: StatMetric;
  op: 'above' | 'below';
  value: number;
}

export interface SnapshotSchedule {
  enabled: boolean;
  /** 0 = Sunday ... 6 = Saturday */
  day: number;
  /** Hour of the day, 0-23 */
  hour: number;
  /** ISO time of the last snapshot taken */
  lastRun?: string;
}

export type ScenarioId =
  | 'my-work' | 'sprint-health' | 'team-workload' | 'blocked-risks' | 'delivery-flow'
  | 'project-progress' | 'roadmap' | 'quality-bugs' | 'executive' | 'custom';

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  scenario: ScenarioId;
  filters: DashboardFilters;
  widgets: DashboardWidget[];
  goals: DashboardGoal[];
  snapshot?: SnapshotSchedule;
  starred?: boolean;
  createdAt: string;
  updatedAt: string;
}
