import type { Issue } from '../../types/issue';
import { burnup, cumulativeFlow, type BurnupPoint, type FlowPoint } from '../sprintReports';
import { currentSprintKey, issuesInSprint } from '../sprintUtils';
import {
  agingGroups, blockedRows, dueStrip, groupIssues, listRows, mergeFilters, metricValue, progressRows, roadmapRows, scopeIssues, summaryLines,
  weeklySeries, workload,
  type BlockedRow, type DataCtx, type DueDay, type Group, type MetricResult, type ProgressRow, type RoadmapRow, type Row, type WeekPoint, type WorkloadRow,
} from './metrics';
import type { Dashboard, DashboardFilters, DashboardWidget } from './types';

/** What a widget shows, worked out from the tickets. The screens and the weekly snapshot both read this. */
export type WidgetData =
  | { kind: 'stat'; result: MetricResult }
  | { kind: 'groups'; groups: Group[]; measure: 'count' | 'points'; total: number }
  | { kind: 'series'; points: WeekPoint[] }
  | { kind: 'burn'; points: BurnupPoint[]; sprint: string }
  | { kind: 'cfd'; points: FlowPoint[]; sprint: string }
  | { kind: 'rows'; rows: Row[]; total: number; all: Issue[] }
  | { kind: 'blocked'; rows: BlockedRow[] }
  | { kind: 'progress'; rows: ProgressRow[] }
  | { kind: 'workload'; rows: WorkloadRow[] }
  | { kind: 'due'; days: DueDay[] }
  | { kind: 'roadmap'; rows: RoadmapRow[] }
  | { kind: 'summary'; lines: string[] };

/** The filters that apply to one widget: the dashboard's, with the widget's own settings on top. */
const widgetFilters = (d: Pick<Dashboard, 'filters'>, w: DashboardWidget): DashboardFilters => mergeFilters(d.filters, w.filters);

export function widgetScope(d: Pick<Dashboard, 'filters'>, w: DashboardWidget, ctx: DataCtx, ignoreRange = false): Issue[] {
  const f = widgetFilters(d, w);
  return scopeIssues(ctx.issues, ignoreRange ? { ...f, range: 'all' } : f, ctx);
}

function weeksFor(d: Pick<Dashboard, 'filters'>, w: DashboardWidget): number {
  if (w.config.weeks) return w.config.weeks;
  const r = widgetFilters(d, w).range;
  return r === '7d' ? 4 : r === '30d' ? 5 : r === '90d' ? 13 : 8;
}

/** Everything a widget's data builder may need. */
interface Build { d: Pick<Dashboard, 'filters'>; w: DashboardWidget; ctx: DataCtx; limit: number }

const scopeOf = (b: Build, ignoreRange = false) => widgetScope(b.d, b.w, b.ctx, ignoreRange);

const groupsData = (groups: Group[], measure: 'count' | 'points'): WidgetData =>
  ({ kind: 'groups', groups, measure, total: groups.reduce((a, g) => a + g.value, 0) });

/** Burndown, burnup and cumulative flow all look at the tickets of one sprint, whatever the dashboard's time range says. */
function sprintData(b: Build): WidgetData {
  const f = widgetFilters(b.d, b.w);
  const sprint = f.sprint === 'all' || f.sprint === 'current' ? currentSprintKey() : f.sprint;
  const inSprint = issuesInSprint(scopeIssues(b.ctx.issues, { ...f, sprint: 'all', range: 'all' }, b.ctx), sprint);
  return b.w.type === 'cfd'
    ? { kind: 'cfd', points: cumulativeFlow(inSprint, sprint), sprint }
    : { kind: 'burn', points: burnup(inSprint, sprint), sprint };
}

function listData(b: Build): WidgetData {
  const rows = listRows(b.w.config.list ?? 'attention', scopeOf(b), b.ctx);
  return { kind: 'rows', rows: rows.slice(0, b.limit), total: rows.length, all: rows.map(r => r.issue) };
}

function barData(b: Build): WidgetData {
  const measure = b.w.config.measure ?? 'count';
  const size = b.w.type === 'donut' ? 6 : Math.max(b.limit, 4);
  return groupsData(groupIssues(scopeOf(b), b.w.config.groupBy ?? 'status', measure, b.ctx, size), measure);
}

/** How each kind of widget turns the tickets into what it shows. */
const BUILDERS: Record<DashboardWidget['type'], (b: Build) => WidgetData> = {
  stat: b => ({ kind: 'stat', result: metricValue(b.w.config.metric ?? 'open', scopeOf(b), b.ctx.now) }),
  bar: barData,
  donut: barData,
  aging: b => groupsData(agingGroups(scopeOf(b), b.ctx.now), 'count'),
  trend: b => ({ kind: 'series', points: weeklySeries(scopeOf(b, true), weeksFor(b.d, b.w), b.ctx.now) }),
  throughput: b => ({ kind: 'series', points: weeklySeries(scopeOf(b, true), weeksFor(b.d, b.w), b.ctx.now) }),
  burndown: sprintData,
  burnup: sprintData,
  cfd: sprintData,
  list: listData,
  blocked: b => ({ kind: 'blocked', rows: blockedRows(scopeOf(b), b.ctx).slice(0, b.limit) }),
  progress: b => ({ kind: 'progress', rows: progressRows(b.w.config.progressBy ?? 'epic', scopeOf(b), b.ctx, b.limit) }),
  workload: b => ({ kind: 'workload', rows: workload(scopeOf(b), b.ctx.now) }),
  due: b => ({ kind: 'due', days: dueStrip(scopeOf(b), b.ctx.now, 14) }),
  roadmap: b => ({ kind: 'roadmap', rows: roadmapRows(b.ctx, b.limit) }),
  summary: b => ({ kind: 'summary', lines: summaryLines(scopeOf(b), b.ctx) }),
};

export function widgetData(d: Pick<Dashboard, 'filters'>, w: DashboardWidget, ctx: DataCtx): WidgetData {
  return BUILDERS[w.type]({ d, w, ctx, limit: w.config.limit ?? 8 });
}
