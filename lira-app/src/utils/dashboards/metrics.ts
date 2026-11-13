import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import type { Project } from '../../types/project';
import type { Roadmap } from '../roadmap/types';
import { ISSUE_TYPE_CONFIG } from '../../types/issue';
import { PRIORITY_CONFIG } from '../priorityUtils';
import { STATUS_LIST } from '../status';
import { currentSprintKey, getIssueSprint, sprintName } from '../sprintUtils';
import { startedAt } from '../sprintReports';
import { resolveItem } from '../roadmap/progress';
import type { DashboardFilters, GroupBy, ListKind, Measure, ProgressBy, StatMetric } from './types';
import { PALETTE as BASE_COLORS } from '../../theme/palette';
import { appStorage } from '../appStorage';

/**
 * Everything a dashboard shows is worked out here from the tickets, projects and roadmaps: pure functions, no screens.
 * "Work items" are all tickets except epics (epics are shown through progress and roadmap widgets).
 */

const DAY = 86_400_000;

export interface DataCtx {
  issues: Issue[];
  spaces: Space[];
  projects: Project[];
  roadmaps: Roadmap[];
  now: Date;
  /** Names and initials that mean "me" (from the profile). */
  me: string[];
}

const PALETTE = [BASE_COLORS.link, BASE_COLORS.successSoft, BASE_COLORS.warning, '#8F7EE7', BASE_COLORS.info, BASE_COLORS.criticalDeep, '#B38600', BASE_COLORS.textMuted, '#E774BB', '#2E7D6B'];

const toDate = (v: unknown): Date | undefined => {
  if (!v) return undefined;
  const d = v instanceof Date ? v : new Date(v as string);
  return Number.isNaN(d.getTime()) ? undefined : d;
};
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const isDone = (i: Issue) => i.status?.toLowerCase() === 'done';
const isOpen = (i: Issue) => !isDone(i);
const workItems = (list: Issue[]) => list.filter(i => i.type !== 'epic');
/** When a finished ticket was finished. */
const doneAt = (i: Issue): Date | undefined => (isDone(i) ? toDate(i.resolvedAt) ?? toDate(i.updatedAt) : undefined);
const points = (i: Issue) => i.storyPoints || 0;
const priorityRank = (i: Issue) => ['highest', 'high', 'medium', 'low', 'lowest'].indexOf(i.priority);

/** The names and initials that mean "me". */
export function myNames(): string[] {
  const out = new Set<string>(['vy']);
  try {
    const n = appStorage.get('lira_user_name'); if (n) out.add(n.toLowerCase());
    const i = appStorage.get('lira_user_initials'); if (i) out.add(i.toLowerCase());
  } catch { /* storage unavailable */ }
  return [...out];
}

const isMine = (i: Issue, me: string[]) =>
  me.includes((i.assigneeInitials || '').toLowerCase()) || me.includes((i.assignee || '').toLowerCase());

export function mergeFilters(base: DashboardFilters, over?: Partial<DashboardFilters>): DashboardFilters {
  return { ...base, ...(over ?? {}) };
}

const RANGE_DAYS: Record<string, number | null> = { all: null, '7d': 7, '30d': 30, '90d': 90 };
const rangeDays = (r: DashboardFilters['range']) => RANGE_DAYS[r] ?? null;

type ScopeMe = Pick<DataCtx, 'me'>['me'];

const inSpaces = (i: Issue, f: DashboardFilters) => !f.spaceIds.length || f.spaceIds.includes(i.spaceId);
/** Epics never match a sprint filter; every other ticket must be in the chosen sprint. */
const inSprint = (i: Issue, sprint: string | undefined) => !sprint || sprint === 'all' || (i.type !== 'epic' && getIssueSprint(i) === sprint);
/** Tickets finished before the time window began are out. */
const inRange = (i: Issue, since: Date | undefined) => {
  if (!since || !isDone(i)) return true;
  const d = doneAt(i);
  return !d || !(d < since);
};
const matchesAssignee = (i: Issue, f: DashboardFilters, me: ScopeMe) => {
  if (f.assignee === 'me') return isMine(i, me);
  if (f.assignee === 'unassigned') return !i.assignee && !i.assigneeInitials;
  return f.assignee === 'all' || (i.assignee || '').toLowerCase() === f.assignee.toLowerCase();
};
const hasPriority = (i: Issue, f: DashboardFilters) => !f.priorities.length || f.priorities.includes(i.priority);
const hasType = (i: Issue, f: DashboardFilters) => !f.types?.length || f.types.includes(i.type);
const hasLabel = (i: Issue, f: DashboardFilters) => !f.labels.length || (i.labels || []).some(l => f.labels.includes(l));

/** The tickets a dashboard (or one widget) looks at, after its filters. */
export function scopeIssues(all: Issue[], f: DashboardFilters, ctx: Pick<DataCtx, 'now' | 'me'>): Issue[] {
  const days = rangeDays(f.range);
  const since = days ? new Date(ctx.now.getTime() - days * DAY) : undefined;
  const sprint = f.sprint === 'current' ? currentSprintKey() : f.sprint;
  return all.filter(i =>
    inSpaces(i, f) && inSprint(i, sprint) && inRange(i, since) && matchesAssignee(i, f, ctx.me) &&
    hasPriority(i, f) && hasType(i, f) && hasLabel(i, f));
}

// ── Numbers (stat cards, goals) ────────────────────────────────────────────────

export interface MetricMeta {
  label: string;
  description: string;
  /** Which direction is good news. null = neither. */
  better: 'up' | 'down' | null;
  suffix?: string;
}

export const METRICS: Record<StatMetric, MetricMeta> = {
  open: { label: 'Open tickets', description: 'Everything not done', better: 'down' },
  total: { label: 'All tickets', description: 'Every ticket in scope', better: null },
  done: { label: 'Done', description: 'Finished tickets', better: 'up' },
  in_progress: { label: 'In progress', description: 'Work being done now', better: null },
  blocked: { label: 'Blocked', description: 'Tickets switched to Blocked', better: 'down' },
  overdue: { label: 'Overdue', description: 'Past their due date and not done', better: 'down' },
  due_soon: { label: 'Due in 7 days', description: 'Due within the next week', better: null },
  unassigned: { label: 'Unassigned', description: 'Open tickets with nobody on them', better: 'down' },
  high_priority: { label: 'High priority open', description: 'Highest and High, not done', better: 'down' },
  bugs_open: { label: 'Open bugs', description: 'Bugs not yet fixed', better: 'down' },
  points_open: { label: 'Points left', description: 'Story points not done', better: 'down' },
  points_done: { label: 'Points done', description: 'Story points finished', better: 'up' },
  done_week: { label: 'Done this week', description: 'Finished in the last 7 days', better: 'up' },
  created_week: { label: 'Created this week', description: 'Added in the last 7 days', better: null },
  lead_days: { label: 'Average lead time', description: 'Days from created to done', better: 'down', suffix: 'd' },
  completion: { label: 'Completion', description: 'Share of tickets done', better: 'up', suffix: '%' },
};

export const METRIC_IDS = Object.keys(METRICS) as StatMetric[];

const inWindow = (d: Date | undefined, from: number, to: number) => !!d && d.getTime() > from && d.getTime() <= to;

/** The number for a metric, as it stood at `at` when that can be worked out from dates (used for the trend arrow). */
function metricAt(metric: StatMetric, work: Issue[], at: number): number | undefined {
  const created = (i: Issue) => (toDate(i.createdAt)?.getTime() ?? 0) <= at;
  const doneBy = (i: Issue) => { const d = doneAt(i); return !!d && d.getTime() <= at; };
  switch (metric) {
    case 'open': return work.filter(i => created(i) && !doneBy(i)).length;
    case 'total': return work.filter(created).length;
    case 'done': return work.filter(doneBy).length;
    case 'points_open': return work.filter(i => created(i) && !doneBy(i)).reduce((a, i) => a + points(i), 0);
    case 'points_done': return work.filter(doneBy).reduce((a, i) => a + points(i), 0);
    case 'done_week': return work.filter(i => inWindow(doneAt(i), at - 7 * DAY, at)).length;
    case 'created_week': return work.filter(i => inWindow(toDate(i.createdAt), at - 7 * DAY, at)).length;
    default: return undefined;
  }
}

export interface MetricResult { value: number; suffix: string; label: string; trend?: number; meta: MetricMeta }

interface MetricInput { work: Issue[]; open: Issue[]; now: Date; today: number }

const sumPoints = (list: Issue[]) => list.reduce((a, i) => a + points(i), 0);
const dueTime = (i: Issue) => toDate(i.dueDate)?.getTime();

/** Average days from created to done, to one decimal; 0 when nothing is done. */
function leadDays(work: Issue[]): number {
  const spans = work.filter(isDone)
    .map(i => { const d = doneAt(i), c = toDate(i.createdAt); return d && c ? Math.max(0, (d.getTime() - c.getTime()) / DAY) : undefined; })
    .filter((n): n is number => n !== undefined);
  return spans.length ? Math.round((spans.reduce((a, b) => a + b, 0) / spans.length) * 10) / 10 : 0;
}

/** How each number is worked out. */
const COMPUTE: Record<StatMetric, (c: MetricInput) => number> = {
  open: c => c.open.length,
  total: c => c.work.length,
  done: c => c.work.filter(isDone).length,
  in_progress: c => c.work.filter(i => i.status === 'inprogress').length,
  blocked: c => c.open.filter(i => i.blocked).length,
  overdue: c => c.open.filter(i => { const d = dueTime(i); return d !== undefined && d < c.today; }).length,
  due_soon: c => c.open.filter(i => { const d = dueTime(i); return d !== undefined && d >= c.today && d <= c.today + 7 * DAY; }).length,
  unassigned: c => c.open.filter(i => !i.assignee && !i.assigneeInitials).length,
  high_priority: c => c.open.filter(i => i.priority === 'highest' || i.priority === 'high').length,
  bugs_open: c => c.open.filter(i => i.type === 'bug').length,
  points_open: c => sumPoints(c.open),
  points_done: c => sumPoints(c.work.filter(isDone)),
  done_week: c => c.work.filter(i => inWindow(doneAt(i), c.now.getTime() - 7 * DAY, c.now.getTime())).length,
  created_week: c => c.work.filter(i => inWindow(toDate(i.createdAt), c.now.getTime() - 7 * DAY, c.now.getTime())).length,
  lead_days: c => leadDays(c.work),
  completion: c => (c.work.length ? Math.round((c.work.filter(isDone).length / c.work.length) * 100) : 0),
};

export function metricValue(metric: StatMetric, scoped: Issue[], now: Date): MetricResult {
  const work = workItems(scoped);
  const value = COMPUTE[metric]({ work, open: work.filter(isOpen), now, today: startOfDay(now).getTime() });
  const meta = METRICS[metric];
  const before = metricAt(metric, work, now.getTime() - 7 * DAY);
  return { value, suffix: meta.suffix ?? '', label: meta.label, trend: before === undefined ? undefined : value - before, meta };
}

// ── Goals ──────────────────────────────────────────────────────────────────────

interface GoalStatus { goal: { metric: StatMetric; op: 'above' | 'below'; value: number }; value: number; breached: boolean; text: string }

export function evaluateGoal(goal: GoalStatus['goal'], scoped: Issue[], now: Date): GoalStatus {
  const { value, meta } = (() => { const r = metricValue(goal.metric, scoped, now); return { value: r.value, meta: r.meta }; })();
  const breached = goal.op === 'above' ? value > goal.value : value < goal.value;
  const word = goal.op === 'above' ? 'more than' : 'fewer than';
  return { goal, value, breached, text: `${meta.label}: ${value}${meta.suffix ?? ''} (alert when ${word} ${goal.value}${meta.suffix ?? ''})` };
}

// ── Grouped counts (bars, donuts, drill-down) ──────────────────────────────────

export interface Group { key: string; label: string; value: number; color: string; issues: Issue[] }

const epicOf = (i: Issue, all: Issue[]) => {
  const id = i.epicId ?? i.parentId;
  const e = id ? all.find(x => x.id === id) : undefined;
  return e && e.type === 'epic' ? e : undefined;
};

interface Bucket { key: string; label: string; color: string }
type GroupCtx = Pick<DataCtx, 'issues' | 'spaces'>;
const UNSET = '';

/** For each way of grouping: which group (or groups) a ticket falls in. */
const BUCKETS: Record<GroupBy, (i: Issue, ctx: GroupCtx) => Bucket[]> = {
  status: i => { const s = STATUS_LIST.find(x => x.id === i.status); return [{ key: i.status, label: s?.label ?? i.status, color: s?.color ?? BASE_COLORS.textMuted }]; },
  priority: i => { const p = PRIORITY_CONFIG[i.priority]; return [{ key: i.priority, label: p?.label ?? i.priority, color: p?.color ?? BASE_COLORS.textMuted }]; },
  type: i => { const t = ISSUE_TYPE_CONFIG[i.type]; return [{ key: i.type, label: t?.label ?? i.type, color: t?.color ?? BASE_COLORS.textMuted }]; },
  assignee: i => [{ key: i.assignee || 'Unassigned', label: i.assignee || 'Unassigned', color: i.assignee ? UNSET : BASE_COLORS.textFaint }],
  label: i => ((i.labels || []).length === 0
    ? [{ key: '(none)', label: 'No label', color: BASE_COLORS.textFaint }]
    : i.labels.map(l => ({ key: l, label: l, color: UNSET }))),
  epic: (i, ctx) => { const e = epicOf(i, ctx.issues); return [{ key: e ? e.key : '(none)', label: e ? `${e.key} ${e.title}` : 'No epic', color: e ? UNSET : BASE_COLORS.textFaint }]; },
  sprint: i => { const k = getIssueSprint(i); return [{ key: k, label: sprintName(k), color: UNSET }]; },
  space: (i, ctx) => { const s = ctx.spaces.find(x => x.id === i.spaceId); return [{ key: String(i.spaceId), label: s?.name ?? 'Space', color: s?.color || UNSET }]; },
};

/** Groups that always come in one fixed order, not by size. */
const FIXED_ORDERS: Partial<Record<GroupBy, string[]>> = {
  priority: ['highest', 'high', 'medium', 'low', 'lowest'],
  type: ['task', 'bug', 'subtask', 'epic'],
};
const fixedOrderFor = (by: GroupBy): string[] | null => (by === 'status' ? STATUS_LIST.map(s => s.id as string) : FIXED_ORDERS[by] ?? null);

/** Keeps the biggest `limit - 1` groups and folds the rest into one "Other" group. */
function foldSmallGroups(groups: Group[], limit: number): Group[] {
  if (groups.length <= limit) return groups;
  const rest = groups.slice(limit - 1);
  return [...groups.slice(0, limit - 1), {
    key: '(other)', label: `Other (${rest.length})`, value: rest.reduce((a, g) => a + g.value, 0), color: BASE_COLORS.textFaint,
    issues: [...new Set(rest.flatMap(g => g.issues))],
  }];
}

export function groupIssues(list: Issue[], by: GroupBy, measure: Measure, ctx: GroupCtx, limit = 8): Group[] {
  const map = new Map<string, Group>();
  const add = (b: Bucket, i: Issue) => {
    let g = map.get(b.key);
    if (!g) { g = { key: b.key, label: b.label, value: 0, color: b.color, issues: [] }; map.set(b.key, g); }
    g.issues.push(i);
    g.value += measure === 'points' ? points(i) : 1;
  };
  workItems(list).forEach(i => BUCKETS[by](i, ctx).forEach(b => add(b, i)));

  const fixedOrder = fixedOrderFor(by);
  let groups = [...map.values()];
  if (fixedOrder) groups.sort((a, b) => fixedOrder.indexOf(a.key) - fixedOrder.indexOf(b.key));
  else groups = foldSmallGroups(groups.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)), limit);

  let n = 0;
  groups.forEach(g => { if (!g.color) g.color = PALETTE[n++ % PALETTE.length]; });
  return groups;
}

// ── Over time ──────────────────────────────────────────────────────────────────

export interface WeekPoint { label: string; end: Date; created: number; done: number; open: number }

/** Created, finished and still-open tickets for each of the last `weeks` weeks. */
export function weeklySeries(list: Issue[], weeks: number, now: Date): WeekPoint[] {
  const work = workItems(list);
  const out: WeekPoint[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = now.getTime() - w * 7 * DAY;
    const start = end - 7 * DAY;
    out.push({
      label: new Date(end).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
      end: new Date(end),
      created: work.filter(i => inWindow(toDate(i.createdAt), start, end)).length,
      done: work.filter(i => inWindow(doneAt(i), start, end)).length,
      open: work.filter(i => (toDate(i.createdAt)?.getTime() ?? 0) <= end && !(doneAt(i) && doneAt(i)!.getTime() <= end)).length,
    });
  }
  return out;
}

// ── Lists ──────────────────────────────────────────────────────────────────────

export interface Row { issue: Issue; note: string; tone?: 'bad' | 'warn' | 'good' | 'neutral' }

const daysBetween = (a: number, b: number) => Math.floor((a - b) / DAY);
const idle = (i: Issue, now: Date) => daysBetween(now.getTime(), toDate(i.updatedAt)?.getTime() ?? now.getTime());

export const LIST_META: Record<ListKind, { label: string; description: string }> = {
  attention: { label: 'Needs attention', description: 'Overdue, blocked, stuck or urgent work' },
  overdue: { label: 'Overdue', description: 'Past the due date' },
  due_soon: { label: 'Due soon', description: 'Due in the next 7 days' },
  my_open: { label: 'My open tickets', description: 'Assigned to me, not done' },
  recent_done: { label: 'Recently done', description: 'Finished in the last 14 days' },
  high_priority: { label: 'High priority', description: 'Highest and High, not done' },
  unassigned: { label: 'Unassigned', description: 'Open work with nobody on it' },
  stale: { label: 'Stale', description: 'No update for 14 days or more' },
  recent: { label: 'Recently updated', description: 'The latest changes' },
};

export function listRows(kind: ListKind, scoped: Issue[], ctx: Pick<DataCtx, 'now' | 'me' | 'issues'>): Row[] {
  const work = workItems(scoped);
  const open = work.filter(isOpen);
  const now = ctx.now;
  const today = startOfDay(now).getTime();
  const due = (i: Issue) => toDate(i.dueDate)?.getTime();
  const overdueBy = (i: Issue) => { const d = due(i); return d !== undefined && d < today ? Math.ceil((today - d) / DAY) : 0; };
  const byPriorityThenDue = (a: Row, b: Row) => priorityRank(a.issue) - priorityRank(b.issue) || (due(a.issue) ?? Infinity) - (due(b.issue) ?? Infinity);

  switch (kind) {
    case 'overdue':
      return open.filter(i => overdueBy(i) > 0).map(i => ({ issue: i, note: `${overdueBy(i)}d overdue`, tone: 'bad' as const })).sort((a, b) => overdueBy(b.issue) - overdueBy(a.issue));
    case 'due_soon':
      return open.filter(i => { const d = due(i); return d !== undefined && d >= today && d <= today + 7 * DAY; })
        .map(i => { const n = Math.round((startOfDay(new Date(due(i)!)).getTime() - today) / DAY); return { issue: i, note: n === 0 ? 'due today' : `due in ${n}d`, tone: n <= 1 ? 'warn' as const : 'neutral' as const }; })
        .sort((a, b) => (due(a.issue) ?? 0) - (due(b.issue) ?? 0));
    case 'my_open':
      return open.filter(i => isMine(i, ctx.me)).map(i => ({ issue: i, note: i.status === 'inprogress' ? 'in progress' : i.status === 'todo' ? 'to do' : 'backlog', tone: 'neutral' as const })).sort(byPriorityThenDue);
    case 'recent_done':
      return work.filter(i => { const d = doneAt(i); return !!d && now.getTime() - d.getTime() <= 14 * DAY; })
        .map(i => ({ issue: i, note: `done ${Math.max(0, daysBetween(now.getTime(), doneAt(i)!.getTime()))}d ago`, tone: 'good' as const }))
        .sort((a, b) => (doneAt(b.issue)?.getTime() ?? 0) - (doneAt(a.issue)?.getTime() ?? 0));
    case 'high_priority':
      return open.filter(i => i.priority === 'highest' || i.priority === 'high').map(i => ({ issue: i, note: i.priority, tone: 'warn' as const })).sort(byPriorityThenDue);
    case 'unassigned':
      return open.filter(i => !i.assignee && !i.assigneeInitials).map(i => ({ issue: i, note: 'no assignee', tone: 'warn' as const })).sort(byPriorityThenDue);
    case 'stale':
      return open.filter(i => i.status !== 'backlog' && idle(i, now) >= 14).map(i => ({ issue: i, note: `no update for ${idle(i, now)}d`, tone: 'warn' as const })).sort((a, b) => idle(b.issue, now) - idle(a.issue, now));
    case 'recent':
      return [...work].sort((a, b) => (toDate(b.updatedAt)?.getTime() ?? 0) - (toDate(a.updatedAt)?.getTime() ?? 0)).map(i => ({ issue: i, note: `updated ${Math.max(0, idle(i, now))}d ago`, tone: 'neutral' as const }));
    case 'attention': {
      const rows = new Map<number | string, Row & { score: number }>();
      const put = (i: Issue, note: string, score: number, tone: Row['tone']) => {
        const k = i.id ?? i.key;
        const cur = rows.get(k);
        if (!cur || score > cur.score) rows.set(k, { issue: i, note: cur ? `${note} · ${cur.note}` : note, tone, score });
        else cur.note = `${cur.note} · ${note}`;
      };
      open.forEach(i => {
        const od = overdueBy(i);
        if (i.blocked) {
          const by = (i.blockedByIds ?? []).map(id => ctx.issues.find(x => x.id === id)?.key).filter(Boolean);
          put(i, by.length ? `blocked by ${by.join(', ')}` : 'blocked', 90, 'bad');
        }
        if (od > 0) put(i, `${od}d overdue`, 80 + Math.min(od, 10), 'bad');
        if (i.status === 'inprogress' && idle(i, now) >= 7) put(i, `idle ${idle(i, now)}d`, 60, 'warn');
        if (i.priority === 'highest' && i.status !== 'inprogress') put(i, 'highest priority, not started', 55, 'warn');
        if (i.status === 'inprogress' && !i.assignee && !i.assigneeInitials) put(i, 'nobody assigned', 50, 'warn');
      });
      return [...rows.values()].sort((a, b) => b.score - a.score).map(({ score: _s, ...r }) => r);
    }
  }
}

// ── Blocked ────────────────────────────────────────────────────────────────────

export interface BlockedRow { issue: Issue; blockers: Issue[]; days: number }

export function blockedRows(scoped: Issue[], ctx: Pick<DataCtx, 'issues' | 'now'>): BlockedRow[] {
  return workItems(scoped).filter(i => i.blocked && isOpen(i)).map(i => {
    const since = toDate(i.blockedAt) ?? toDate(i.updatedAt) ?? ctx.now;
    return {
      issue: i,
      blockers: (i.blockedByIds ?? []).map(id => ctx.issues.find(x => x.id === id)).filter((x): x is Issue => !!x),
      days: Math.max(0, daysBetween(ctx.now.getTime(), since.getTime())),
    };
  }).sort((a, b) => b.days - a.days);
}

// ── People ─────────────────────────────────────────────────────────────────────

export interface WorkloadRow { name: string; open: number; points: number; inProgress: number; blocked: number; overdue: number; done: number; overloaded: boolean; issues: Issue[] }

export function workload(scoped: Issue[], now: Date): WorkloadRow[] {
  const today = startOfDay(now).getTime();
  const map = new Map<string, WorkloadRow>();
  workItems(scoped).forEach(i => {
    const name = i.assignee || 'Unassigned';
    let r = map.get(name);
    if (!r) { r = { name, open: 0, points: 0, inProgress: 0, blocked: 0, overdue: 0, done: 0, overloaded: false, issues: [] }; map.set(name, r); }
    if (isDone(i)) { r.done++; return; }
    r.open++; r.points += points(i); r.issues.push(i);
    if (i.status === 'inprogress') r.inProgress++;
    if (i.blocked) r.blocked++;
    const d = toDate(i.dueDate)?.getTime();
    if (d !== undefined && d < today) r.overdue++;
  });
  const rows = [...map.values()];
  const people = rows.filter(r => r.name !== 'Unassigned' && r.open > 0);
  const avg = people.length ? people.reduce((a, r) => a + r.points, 0) / people.length : 0;
  rows.forEach(r => { r.overloaded = r.name !== 'Unassigned' && ((people.length > 1 && r.points >= avg * 1.5 && r.points >= 8) || r.overdue >= 3 || r.inProgress >= 5); });
  return rows.sort((a, b) => b.points - a.points || b.open - a.open);
}

// ── Progress, aging, due strip, roadmap, summary ───────────────────────────────

export interface ProgressRow { key: string; label: string; done: number; total: number; percent: number; color: string; issues: Issue[]; href?: string }

export function progressRows(by: ProgressBy, scoped: Issue[], ctx: Pick<DataCtx, 'issues' | 'projects' | 'spaces'>, limit = 8): ProgressRow[] {
  const work = workItems(scoped);
  const mk = (key: string, label: string, list: Issue[], color: string, href?: string): ProgressRow => {
    const done = list.filter(isDone).length;
    return { key, label, done, total: list.length, percent: list.length ? Math.round((done / list.length) * 100) : 0, color, issues: list, href };
  };
  let rows: ProgressRow[] = [];
  if (by === 'epic') {
    const epics = scoped.filter(i => i.type === 'epic');
    rows = epics.map((e, n) => mk(e.key, `${e.key} ${e.title}`, work.filter(i => i.epicId === e.id || i.parentId === e.id), PALETTE[n % PALETTE.length])).filter(r => r.total > 0);
  } else if (by === 'project') {
    rows = ctx.projects.map((p, n) => mk(p.id, p.name, work.filter(i => (p.spaceId && i.spaceId === p.spaceId) || (p.key && i.key.startsWith(`${p.key}-`))), PALETTE[n % PALETTE.length], `/projects/${encodeURIComponent(p.id)}`)).filter(r => r.total > 0);
  } else {
    const keys = [...new Set(work.map(getIssueSprint))].sort();
    rows = keys.map((k, n) => mk(k, sprintName(k), work.filter(i => getIssueSprint(i) === k), PALETTE[n % PALETTE.length], `/sprints/${k}`));
  }
  return rows.sort((a, b) => (by === 'sprint' ? a.key.localeCompare(b.key) : b.total - a.total)).slice(0, limit);
}

const AGING_BUCKETS = [{ label: '0-2 days', max: 2, color: BASE_COLORS.successSoft }, { label: '3-5 days', max: 5, color: '#B38600' }, { label: '6-10 days', max: 10, color: BASE_COLORS.warning }, { label: 'Over 10 days', max: Infinity, color: BASE_COLORS.criticalDeep }];

/** Tickets in progress, grouped by how long they have been in progress. */
export function agingGroups(scoped: Issue[], now: Date): Group[] {
  const groups: Group[] = AGING_BUCKETS.map(b => ({ key: b.label, label: b.label, value: 0, color: b.color, issues: [] }));
  workItems(scoped).filter(i => i.status === 'inprogress').forEach(i => {
    const from = startedAt(i) ?? toDate(i.updatedAt) ?? now;
    const days = Math.max(0, daysBetween(now.getTime(), from.getTime()));
    const idx = AGING_BUCKETS.findIndex(b => days <= b.max);
    groups[idx].value++; groups[idx].issues.push(i);
  });
  return groups;
}

export interface DueDay { date: Date; count: number; issues: Issue[] }

export function dueStrip(scoped: Issue[], now: Date, days = 14): DueDay[] {
  const start = startOfDay(now);
  const out: DueDay[] = Array.from({ length: days }, (_, n) => ({ date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + n), count: 0, issues: [] }));
  workItems(scoped).filter(isOpen).forEach(i => {
    const d = toDate(i.dueDate);
    if (!d) return;
    const n = Math.round((startOfDay(d).getTime() - start.getTime()) / DAY);
    if (n >= 0 && n < days) { out[n].count++; out[n].issues.push(i); }
  });
  return out;
}

export interface RoadmapRow { roadmap: string; roadmapId: string; title: string; status: string; progress: number; end: string }

export function roadmapRows(ctx: Pick<DataCtx, 'roadmaps' | 'issues' | 'now'>, limit = 8): RoadmapRow[] {
  const rank: Record<string, number> = { blocked: 0, atrisk: 1, inprogress: 2, planned: 3, done: 4 };
  const rows: RoadmapRow[] = [];
  ctx.roadmaps.filter(r => !r.archived).forEach(r => (r.items || []).forEach(item => {
    const res = resolveItem(item, ctx.issues, ctx.now);
    rows.push({ roadmap: r.name, roadmapId: r.id, title: item.title, status: res.status, progress: Math.round(res.progress), end: item.end });
  }));
  return rows.sort((a, b) => (rank[a.status] ?? 5) - (rank[b.status] ?? 5) || a.end.localeCompare(b.end)).slice(0, limit);
}

/** A few plain sentences about the scope, for the headline widget and the weekly snapshot. */
export function summaryLines(scoped: Issue[], ctx: Pick<DataCtx, 'now' | 'me' | 'issues'>): string[] {
  const m = (k: StatMetric) => metricValue(k, scoped, ctx.now);
  const open = m('open'), done = m('done_week'), overdue = m('overdue'), blocked = m('blocked'), unassigned = m('unassigned');
  const lines: string[] = [];
  lines.push(`${open.value} open ticket${open.value === 1 ? '' : 's'}, ${m('done').value} done (${m('completion').value}%).`);
  const t = done.trend;
  lines.push(`${done.value} finished in the last 7 days${t === undefined || t === 0 ? '' : t > 0 ? `, up ${t} on the week before` : `, down ${-t} on the week before`}.`);
  const flags = [overdue.value && `${overdue.value} overdue`, blocked.value && `${blocked.value} blocked`, unassigned.value && `${unassigned.value} unassigned`].filter(Boolean);
  lines.push(flags.length ? `Watch: ${flags.join(', ')}.` : 'Nothing overdue, blocked or unassigned.');
  const busiest = workload(scoped, ctx.now).find(r => r.name !== 'Unassigned');
  if (busiest) lines.push(`Busiest: ${busiest.name} with ${busiest.open} open (${busiest.points} points)${busiest.overloaded ? ', which looks overloaded' : ''}.`);
  return lines;
}


const dueBefore = (i: Issue, limit: number) => { const d = dueTime(i); return d !== undefined && d < limit; };
const dueWithin = (i: Issue, from: number, to: number) => { const d = dueTime(i); return d !== undefined && d >= from && d <= to; };

/** The tickets behind each number, so a stat card can open them. */
const BEHIND: Record<StatMetric, (c: MetricInput) => Issue[]> = {
  open: c => c.open,
  points_open: c => c.open,
  total: c => c.work,
  completion: c => c.work,
  done: c => c.work.filter(isDone),
  points_done: c => c.work.filter(isDone),
  lead_days: c => c.work.filter(isDone),
  in_progress: c => c.work.filter(i => i.status === 'inprogress'),
  blocked: c => c.open.filter(i => i.blocked),
  overdue: c => c.open.filter(i => dueBefore(i, c.today)),
  due_soon: c => c.open.filter(i => dueWithin(i, c.today, c.today + 7 * DAY)),
  unassigned: c => c.open.filter(i => !i.assignee && !i.assigneeInitials),
  high_priority: c => c.open.filter(i => i.priority === 'highest' || i.priority === 'high'),
  bugs_open: c => c.open.filter(i => i.type === 'bug'),
  done_week: c => c.work.filter(i => inWindow(doneAt(i), c.now.getTime() - 7 * DAY, c.now.getTime())),
  created_week: c => c.work.filter(i => inWindow(toDate(i.createdAt), c.now.getTime() - 7 * DAY, c.now.getTime())),
};

export function metricIssues(metric: StatMetric, scoped: Issue[], now: Date): Issue[] {
  const work = workItems(scoped);
  return BEHIND[metric]({ work, open: work.filter(isOpen), now, today: startOfDay(now).getTime() });
}
