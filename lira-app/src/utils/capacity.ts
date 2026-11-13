import type { Issue } from '../types/issue';
import { PALETTE } from '../theme/palette';
import { isMine } from './currentUser';
import { matchesStatusFilter, type SpaceFilters } from './spaceFilters';

export type QuickFilter = 'all' | 'vy' | 'inprogress' | 'blocked' | 'high' | 'overdue';

export interface MemberWorkload {
  name: string;
  initials: string;
  avatarColor: string;
  total: number;
  backlog: number;
  todo: number;
  inProgress: number;
  blocked: number;
  done: number;
  overdue: number;
  storyPoints: number;
  issues: Issue[];
}

/** A ticket without story points counts as 1. */
const points = (i: Issue): number => i.storyPoints || 1;

const isOverdue = (i: Issue, now: Date): boolean => i.status !== 'done' && !!i.dueDate && new Date(i.dueDate) < now;

/** What each quick-filter chip keeps. */
const QUICK: Record<Exclude<QuickFilter, 'all'>, (i: Issue, now: Date) => boolean> = {
  vy: i => isMine(i),
  blocked: i => !!i.blocked,
  inprogress: i => i.status === 'inprogress',
  high: i => i.priority === 'high' || i.priority === 'highest',
  overdue: isOverdue,
};

export interface CapacityFilter {
  searchQuery: string;
  mineOnly: boolean;
  active?: SpaceFilters;
  assignee: string | null;
  quick: QuickFilter;
}

const matchesSearch = (i: Issue, query: string): boolean => {
  const q = query.toLowerCase();
  return i.title.toLowerCase().includes(q) || i.key.toLowerCase().includes(q) || !!i.labels?.some(l => l.toLowerCase().includes(q));
};

/** The tickets that pass the search box, the top-bar "me" toggle, the status/priority/label filters, the chosen person and the quick chip. */
export function filterCapacityIssues(issues: Issue[], f: CapacityFilter, now: Date): Issue[] {
  let list = issues;
  if (f.searchQuery.trim()) list = list.filter(i => matchesSearch(i, f.searchQuery));
  if (f.mineOnly) list = list.filter(i => isMine(i));
  list = list.filter(i => matchesStatusFilter(i, f.active?.statuses));
  const priorities = f.active?.priorities;
  if (priorities && priorities.length > 0) list = list.filter(i => priorities.includes(i.priority));
  const labels = f.active?.labels;
  if (labels && labels.length > 0) list = list.filter(i => i.labels?.some(l => labels.includes(l)));
  if (f.assignee) list = list.filter(i => (i.assigneeInitials || i.assignee) === f.assignee);
  const quick = f.quick;
  if (quick !== 'all') list = list.filter(i => QUICK[quick](i, now));
  return list;
}

/** True when any filter narrows the list. */
export const hasCapacityFilters = (f: CapacityFilter): boolean =>
  f.searchQuery.trim().length > 0 || f.mineOnly || !!f.active?.priorities?.length || !!f.active?.labels?.length || !!f.active?.statuses?.length || f.assignee !== null || f.quick !== 'all';

const avatarColor = (initials: string): string => (initials === 'VY' ? PALETTE.brand : initials === 'UN' ? PALETTE.textMuted : PALETTE.successDeep);

const blankWorkload = (name: string, initials: string): MemberWorkload => ({
  name, initials, avatarColor: avatarColor(initials), total: 0, backlog: 0, todo: 0, inProgress: 0, blocked: 0, done: 0, overdue: 0, storyPoints: 0, issues: [],
});

/** Which status counter a ticket adds to; anything that is not done, in progress or to do counts as backlog. */
const STATUS_COUNTER: Record<string, 'done' | 'inProgress' | 'todo'> = { done: 'done', inprogress: 'inProgress', todo: 'todo' };

/** One row per person, busiest first, with their counts, points and overdue tickets. */
export function buildWorkloads(issues: Issue[], now: Date): { workloads: MemberWorkload[]; totalOverdue: number } {
  const byPerson: Record<string, MemberWorkload> = {};
  let totalOverdue = 0;
  issues.forEach(issue => {
    const initials = issue.assigneeInitials || (issue.assignee ? issue.assignee.slice(0, 2).toUpperCase() : 'UN');
    const m = (byPerson[initials] ??= blankWorkload(issue.assignee || 'Unassigned', initials));
    m.total += 1;
    m.storyPoints += points(issue);
    m.issues.push(issue);
    if (issue.blocked) m.blocked += 1;
    m[STATUS_COUNTER[issue.status] ?? 'backlog'] += 1;
    if (isOverdue(issue, now)) { m.overdue += 1; totalOverdue += 1; }
  });
  return { workloads: Object.values(byPerson).sort((a, b) => b.total - a.total), totalOverdue };
}

/** Totals for the whole filtered list. */
export const teamTotals = (issues: Issue[]) => ({
  teamTotal: issues.length,
  teamDone: issues.filter(i => i.status === 'done').length,
  teamInProgress: issues.filter(i => i.status === 'inprogress').length,
  teamPoints: issues.reduce((acc, i) => acc + points(i), 0),
});

const STATUS_GROUPS = [
  { id: 'backlog', label: 'Backlog Pool', desc: 'Items awaiting refinement & sprint commitment', dot: PALETTE.textMuted, color: 'border-slate-200 bg-white' },
  { id: 'todo', label: 'Ready (To Do)', desc: 'Prioritized & groomed items ready for active pickup', dot: PALETTE.textStrong, color: 'border-lira-border bg-white' },
  { id: 'inprogress', label: 'In Flight (In Progress)', desc: 'Active development and implementation', dot: PALETTE.amber, color: 'border-amber-200 bg-white' },
  { id: 'blocked', label: 'Blocked', desc: 'Work that cannot move until something else is resolved', dot: PALETTE.critical, color: 'border-red-200 bg-white' },
  { id: 'done', label: 'Completed (Done)', desc: 'Verified, tested, and resolved work items', dot: PALETTE.success, color: 'border-emerald-200 bg-white' },
];

/** The five status columns with their tickets, points and share of the team's points. */
export function groupByStatus(issues: Issue[], teamPoints: number) {
  return STATUS_GROUPS.map(s => {
    const items = issues.filter(i => (s.id === 'blocked' ? !!i.blocked : i.status === s.id));
    const pts = items.reduce((sum, i) => sum + points(i), 0);
    return { ...s, items, points: pts, pct: teamPoints > 0 ? Math.round((pts / teamPoints) * 100) : 0 };
  });
}

const PRIORITY_GROUPS = [
  { id: 'highest', label: 'Highest Priority', dot: '#EF4444', color: 'border-red-200 bg-white', badge: 'bg-red-50 text-red-700' },
  { id: 'high', label: 'High Priority', dot: '#F97316', color: 'border-orange-200 bg-white', badge: 'bg-orange-50 text-orange-700' },
  { id: 'medium', label: 'Medium Priority', dot: '#FBBF24', color: 'border-amber-200 bg-white', badge: 'bg-amber-50 text-amber-700' },
  { id: 'low', label: 'Low / Lowest Priority', dot: '#34D399', color: 'border-emerald-200 bg-white', badge: 'bg-emerald-50 text-emerald-700' },
];

/** Four priority groups; low and lowest share the last one. */
export function groupByPriority(issues: Issue[]) {
  return PRIORITY_GROUPS.map(g => {
    const items = issues.filter(i => (g.id === 'low' ? i.priority === 'low' || i.priority === 'lowest' : i.priority === g.id));
    return { ...g, items, points: items.reduce((a, b) => a + points(b), 0) };
  });
}

/** Each epic with its filtered children, how many are done (or 100 / 0 for a childless epic by its own status) and their points. */
export function groupByEpic(allIssues: Issue[], filtered: Issue[]) {
  return allIssues.filter(i => i.type === 'epic').map(epic => {
    const children = filtered.filter(i => i.parentId === epic.id || i.epicId === epic.id);
    const done = children.filter(c => c.status === 'done').length;
    const progress = children.length > 0 ? Math.round((done / children.length) * 100) : (epic.status === 'done' ? 100 : 0);
    return { epic, children, done, progress, points: children.reduce((sum, c) => sum + points(c), 0) };
  });
}
