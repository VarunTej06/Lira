import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import {
  currentSprintKey, daysElapsed, getIssueSprint, getSprintMeta, isDone, isSprintWork, issuesInSprint, nextSprint,
  sprintDays, sprintIncludesSpace, sprintName, sprintPhase, sprintStats,
} from '../../utils/sprintUtils';
import { startedAt, suggestedCapacity } from '../../utils/sprintReports';

/** Pure helpers behind Viva's sprint answers: planning, summary, standup digest and the risk radar. */

const PRIORITY_RANK: Record<string, number> = { highest: 0, high: 1, medium: 2, low: 3, lowest: 4 };
const DEFAULT_CAPACITY = 20;
const UNESTIMATED_POINTS = 3;
const pts = (i: Issue) => (typeof i.storyPoints === 'number' ? i.storyPoints : UNESTIMATED_POINTS);
const DAY = 86_400_000;

export interface SprintPlan {
  target: string;
  picked: Issue[];
  skipped: Issue[];
  capacity: number;
  /** where the capacity came from */
  capacitySource: 'set' | 'history' | 'default';
  alreadyPoints: number;
  pickedPoints: number;
}

/**
 * Picks the backlog tickets that fit a sprint: highest priority first, until the capacity is used.
 * Only spaces that work in the sprint are considered; epics, subtasks and finished work are left out.
 */
export function planSprintFromBacklog(issues: Issue[], target: string, spaceId?: number): SprintPlan {
  const work = issues.filter(isSprintWork).filter(i => i.type !== 'subtask');
  const meta = getSprintMeta('all', target);
  const history = suggestedCapacity(work, Array.from(new Set(work.map(getIssueSprint))).sort());
  const capacity = meta.capacity ?? history ?? DEFAULT_CAPACITY;
  const capacitySource = meta.capacity !== undefined ? 'set' : history !== null ? 'history' : 'default';
  const alreadyPoints = issuesInSprint(work, target).reduce((a, i) => a + (i.storyPoints || 0), 0);
  const candidates = work
    .filter(i => i.status?.toLowerCase() === 'backlog' && !isDone(i) && getIssueSprint(i) !== target)
    .filter(i => sprintIncludesSpace(target, i.spaceId) && (spaceId === undefined || i.spaceId === spaceId))
    .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) || (a.rank ?? 0) - (b.rank ?? 0));
  const picked: Issue[] = [], skipped: Issue[] = [];
  let used = alreadyPoints;
  for (const i of candidates) {
    if (used + pts(i) <= capacity) { picked.push(i); used += pts(i); } else skipped.push(i);
  }
  return { target, picked, skipped, capacity, capacitySource, alreadyPoints, pickedPoints: used - alreadyPoints };
}

export type RiskLevel = 'ok' | 'watch' | 'atrisk';
export interface SprintRisk {
  key: string;
  level: RiskLevel;
  elapsedPct: number;
  donePct: number;
  open: number;
  reasons: string[];
}

/** Is the sprint on pace? Compares the share of the sprint that has passed with the share of work done. */
export function sprintRisk(list: Issue[], key: string): SprintRisk {
  const phase = sprintPhase(key);
  const stats = sprintStats(list);
  const usePoints = stats.points > 0;
  const donePct = usePoints ? Math.round((stats.donePoints / stats.points) * 100) : stats.percent;
  const elapsedPct = Math.round((daysElapsed(key) / sprintDays(key)) * 100);
  const reasons: string[] = [];
  let level: RiskLevel = 'ok';
  const raise = (l: RiskLevel) => { if (l === 'atrisk' || (l === 'watch' && level === 'ok')) level = l; };

  if (phase === 'past' && stats.open > 0) { raise('atrisk'); reasons.push(`ended with ${stats.open} unfinished ticket${stats.open === 1 ? '' : 's'}`); }
  if (phase === 'active' && stats.total > 0) {
    const behind = elapsedPct - donePct;
    if (elapsedPct >= 25 && behind >= 30) { raise('atrisk'); reasons.push(`${elapsedPct}% of the time has passed but only ${donePct}% is done`); }
    else if (elapsedPct >= 15 && behind >= 15) { raise('watch'); reasons.push(`${donePct}% done against ${elapsedPct}% of the time`); }
    const notStarted = stats.todo + stats.backlog;
    if (elapsedPct >= 50 && stats.total > 0 && notStarted / stats.total > 0.5) { raise('watch'); reasons.push(`${notStarted} of ${stats.total} tickets have not been started`); }
  }
  const meta = getSprintMeta('all', key);
  if (phase !== 'past' && meta.capacity !== undefined && stats.points > meta.capacity) {
    raise('watch'); reasons.push(`over-committed: ${stats.points} points against a capacity of ${meta.capacity}`);
  }
  return { key, level, elapsedPct, donePct, open: stats.open, reasons };
}

/** In-progress tickets nobody has touched for `days` days. */
export function idleTickets(issues: Issue[], now: Date, days = 5): { issue: Issue; idleDays: number }[] {
  return issues
    .filter(i => isSprintWork(i) && i.status?.toLowerCase() === 'inprogress')
    .map(issue => ({ issue, idleDays: Math.floor((now.getTime() - new Date(issue.updatedAt || issue.createdAt).getTime()) / DAY) }))
    .filter(x => x.idleDays >= days)
    .sort((a, b) => b.idleDays - a.idleDays);
}

const spaceTag = (i: Issue, spaces: Map<number, Space>) => spaces.get(i.spaceId)?.key ?? '';
const line = (i: Issue, spaces: Map<number, Space>, extra = '') => `- **${i.key}** ${i.title}${spaceTag(i, spaces) ? ` _(${spaceTag(i, spaces)})_` : ''}${extra}`;

/** Markdown risk radar across the active sprints plus idle tickets. */
export function riskRadarText(issues: Issue[], keys: string[], spaces: Space[], now: Date): string {
  const sm = new Map(spaces.filter(s => s.id).map(s => [s.id!, s]));
  const rows = keys.filter(k => sprintPhase(k) !== 'upcoming').map(k => ({ k, r: sprintRisk(issuesInSprint(issues, k), k) }))
    .filter(({ r, k }) => r.level !== 'ok' && (sprintPhase(k) === 'active' || !getSprintMeta('all', k).completedAt));
  const idle = idleTickets(issues, now);
  const out: string[] = ['### 🚨 Risk radar', ''];
  if (!rows.length) out.push('✅ No sprint looks at risk right now.');
  for (const { k, r } of rows) out.push(`- ${r.level === 'atrisk' ? '🔴' : '🟡'} **${sprintName(k)}**: ${r.reasons.join('; ')}`);
  out.push('', `**Idle tickets** (in progress, no change for 5 days or more): ${idle.length || 'none'}`);
  idle.slice(0, 8).forEach(x => out.push(line(x.issue, sm, ` — ${x.idleDays} days`)));
  const overdue = issues.filter(i => isSprintWork(i) && !isDone(i) && i.dueDate && new Date(i.dueDate) < now);
  if (overdue.length) {
    out.push('', `**Overdue** (${overdue.length}):`);
    overdue.slice(0, 8).forEach(i => out.push(line(i, sm, ` — due ${new Date(i.dueDate!).toLocaleDateString()}`)));
  }
  return out.join('\n');
}

/** Markdown summary of one sprint. */
export function sprintSummaryText(issues: Issue[], key: string, spaces: Space[]): string {
  const list = issuesInSprint(issues, key);
  const s = sprintStats(list);
  const risk = sprintRisk(list, key);
  const meta = getSprintMeta('all', key);
  const sm = new Map(spaces.filter(x => x.id).map(x => [x.id!, x]));
  const out = [`### 📊 ${sprintName(key)}`, ''];
  if (meta.goal) out.push(`**Goal:** ${meta.goal}`, '');
  out.push(`- **${s.done} of ${s.total}** tickets done (${s.percent}%), ${s.donePoints} of ${s.points} points`);
  out.push(`- To do ${s.todo + s.backlog} · In progress ${s.inprogress} · Done ${s.done}`);
  out.push(`- Time passed: ${risk.elapsedPct}% · Status: ${risk.level === 'ok' ? '🟢 on pace' : risk.level === 'watch' ? '🟡 watch' : '🔴 at risk'}`);
  risk.reasons.forEach(r => out.push(`  - ${r}`));
  const bySpace = new Map<number, Issue[]>();
  list.forEach(i => bySpace.set(i.spaceId, [...(bySpace.get(i.spaceId) || []), i]));
  if (bySpace.size > 1) {
    out.push('', '**By space**');
    for (const [id, l] of bySpace) out.push(`- ${sm.get(id)?.name ?? id}: ${l.filter(isDone).length}/${l.length} done`);
  }
  const open = list.filter(i => !isDone(i) && (i.priority === 'highest' || i.priority === 'high')).slice(0, 5);
  if (open.length) { out.push('', '**High-priority work still open**'); open.forEach(i => out.push(line(i, sm, ` — ${i.status}`))); }
  return out.join('\n');
}

/** The start of the window a standup covers: the last working day. */
export function standupSince(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const back = d.getDay() === 1 ? 3 : d.getDay() === 0 ? 2 : 1; // Monday looks back to Friday, Sunday to Friday
  d.setDate(d.getDate() - back);
  return d;
}

/** "Yesterday / Today / Blockers", written from what changed. */
export function standupDigestText(issues: Issue[], spaces: Space[], now: Date, assignee?: string): string {
  const sm = new Map(spaces.filter(s => s.id).map(s => [s.id!, s]));
  const since = standupSince(now);
  const mine = (i: Issue) => !assignee || !i.assignee || i.assignee === assignee;
  const work = issues.filter(i => isSprintWork(i) && mine(i));
  const done = work.filter(i => isDone(i) && i.resolvedAt && new Date(i.resolvedAt) >= since);
  const started = work.filter(i => !isDone(i) && (startedAt(i) ?? new Date(0)) >= since);
  const active = work.filter(i => i.status?.toLowerCase() === 'inprogress');
  const blockers = [
    ...idleTickets(work, now).map(x => ({ i: x.issue, why: `no change for ${x.idleDays} days` })),
    ...work.filter(i => !isDone(i) && i.dueDate && new Date(i.dueDate) < now).map(i => ({ i, why: 'overdue' })),
  ];
  const out = ['### 🗣️ Standup', '', `**Since ${since.toLocaleDateString('en-US', { weekday: 'long' })}**`];
  if (done.length) done.forEach(i => out.push(line(i, sm, ' — done ✅')));
  if (started.length) started.forEach(i => out.push(line(i, sm, ' — started')));
  if (!done.length && !started.length) out.push('- Nothing moved to In Progress or Done.');
  out.push('', '**Today**');
  if (active.length) active.slice(0, 8).forEach(i => out.push(line(i, sm)));
  else out.push('- Nothing is in progress. Pick something from To Do.');
  out.push('', '**Blockers and risks**');
  if (blockers.length) blockers.slice(0, 6).forEach(b => out.push(line(b.i, sm, ` — ${b.why}`)));
  else out.push('- None.');
  return out.join('\n');
}

export const currentAndNext = () => ({ current: currentSprintKey(), next: nextSprint(currentSprintKey()) });
