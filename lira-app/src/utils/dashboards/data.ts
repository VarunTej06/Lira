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
export const widgetFilters = (d: Pick<Dashboard, 'filters'>, w: DashboardWidget): DashboardFilters => mergeFilters(d.filters, w.filters);

export function widgetScope(d: Pick<Dashboard, 'filters'>, w: DashboardWidget, ctx: DataCtx, ignoreRange = false): Issue[] {
  const f = widgetFilters(d, w);
  return scopeIssues(ctx.issues, ignoreRange ? { ...f, range: 'all' } : f, ctx);
}

export function weeksFor(d: Pick<Dashboard, 'filters'>, w: DashboardWidget): number {
  if (w.config.weeks) return w.config.weeks;
  const r = widgetFilters(d, w).range;
  return r === '7d' ? 4 : r === '30d' ? 5 : r === '90d' ? 13 : 8;
}

export function widgetData(d: Pick<Dashboard, 'filters'>, w: DashboardWidget, ctx: DataCtx): WidgetData {
  const limit = w.config.limit ?? 8;
  switch (w.type) {
    case 'stat':
      return { kind: 'stat', result: metricValue(w.config.metric ?? 'open', widgetScope(d, w, ctx), ctx.now) };
    case 'bar':
    case 'donut': {
      const measure = w.config.measure ?? 'count';
      const groups = groupIssues(widgetScope(d, w, ctx), w.config.groupBy ?? 'status', measure, ctx, w.type === 'donut' ? 6 : Math.max(limit, 4));
      return { kind: 'groups', groups, measure, total: groups.reduce((a, g) => a + g.value, 0) };
    }
    case 'aging': {
      const groups = agingGroups(widgetScope(d, w, ctx), ctx.now);
      return { kind: 'groups', groups, measure: 'count', total: groups.reduce((a, g) => a + g.value, 0) };
    }
    case 'trend':
    case 'throughput':
      return { kind: 'series', points: weeklySeries(widgetScope(d, w, ctx, true), weeksFor(d, w), ctx.now) };
    case 'burndown':
    case 'burnup':
    case 'cfd': {
      const f = widgetFilters(d, w);
      const sprint = f.sprint === 'all' || f.sprint === 'current' ? currentSprintKey() : f.sprint;
      const inSprint = issuesInSprint(scopeIssues(ctx.issues, { ...f, sprint: 'all', range: 'all' }, ctx), sprint);
      return w.type === 'cfd'
        ? { kind: 'cfd', points: cumulativeFlow(inSprint, sprint), sprint }
        : { kind: 'burn', points: burnup(inSprint, sprint), sprint };
    }
    case 'list': {
      const rows = listRows(w.config.list ?? 'attention', widgetScope(d, w, ctx), ctx);
      return { kind: 'rows', rows: rows.slice(0, limit), total: rows.length, all: rows.map(r => r.issue) };
    }
    case 'blocked':
      return { kind: 'blocked', rows: blockedRows(widgetScope(d, w, ctx), ctx).slice(0, limit) };
    case 'progress':
      return { kind: 'progress', rows: progressRows(w.config.progressBy ?? 'epic', widgetScope(d, w, ctx), ctx, limit) };
    case 'workload':
      return { kind: 'workload', rows: workload(widgetScope(d, w, ctx), ctx.now) };
    case 'due':
      return { kind: 'due', days: dueStrip(widgetScope(d, w, ctx), ctx.now, 14) };
    case 'roadmap':
      return { kind: 'roadmap', rows: roadmapRows(ctx, limit) };
    case 'summary':
      return { kind: 'summary', lines: summaryLines(widgetScope(d, w, ctx), ctx) };
  }
}
