import { describe, expect, it } from 'vitest';
import type { Issue } from '../types/issue';
import { buildWorkloads, filterCapacityIssues, groupByEpic, groupByPriority, groupByStatus, hasCapacityFilters, teamTotals, type CapacityFilter } from './capacity';
import { PALETTE } from '../theme/palette';

const NOW = new Date(2026, 10, 10);
let n = 0;
const t = (over: Partial<Issue> = {}) => ({ id: ++n, key: `A-${n}`, title: `Ticket ${n}`, status: 'todo', priority: 'medium', type: 'task', labels: [], ...over }) as unknown as Issue;
const none: CapacityFilter = { searchQuery: '', mineOnly: false, active: undefined, assignee: null, quick: 'all' };
const keys = (list: Issue[]) => list.map(i => i.key);

describe('filterCapacityIssues', () => {
  const a = t({ key: 'A-1', title: 'Fix login', labels: ['Auth'], priority: 'high', assigneeInitials: 'VY' });
  const b = t({ key: 'B-2', title: 'Export', labels: ['data'], priority: 'low', assignee: 'Bob' });
  const all = [a, b];
  it('keeps everything with no filter', () => expect(filterCapacityIssues(all, none, NOW)).toEqual(all));
  it('searches title, key and label, ignoring case', () => {
    expect(keys(filterCapacityIssues(all, { ...none, searchQuery: 'LOGIN' }, NOW))).toEqual(['A-1']);
    expect(keys(filterCapacityIssues(all, { ...none, searchQuery: 'b-2' }, NOW))).toEqual(['B-2']);
    expect(keys(filterCapacityIssues(all, { ...none, searchQuery: 'auth' }, NOW))).toEqual(['A-1']);
    expect(filterCapacityIssues(all, { ...none, searchQuery: '  ' }, NOW)).toEqual(all);
  });
  it('filters by priority and label from the popover', () => {
    expect(keys(filterCapacityIssues(all, { ...none, active: { statuses: [], priorities: ['low'], labels: [] } as never }, NOW))).toEqual(['B-2']);
    expect(keys(filterCapacityIssues(all, { ...none, active: { statuses: [], priorities: [], labels: ['Auth'] } as never }, NOW))).toEqual(['A-1']);
  });
  it('filters by the chosen person, by initials or name', () => {
    expect(keys(filterCapacityIssues(all, { ...none, assignee: 'VY' }, NOW))).toEqual(['A-1']);
    expect(keys(filterCapacityIssues(all, { ...none, assignee: 'Bob' }, NOW))).toEqual(['B-2']);
  });
  it('applies each quick chip', () => {
    const blocked = t({ blocked: true });
    const prog = t({ status: 'inprogress' });
    const late = t({ dueDate: new Date(2026, 10, 1) as never });
    const lateDone = t({ status: 'done', dueDate: new Date(2026, 10, 1) as never });
    const highest = t({ priority: 'highest' });
    const list = [blocked, prog, late, lateDone, highest, a];
    expect(filterCapacityIssues(list, { ...none, quick: 'blocked' }, NOW)).toEqual([blocked]);
    expect(filterCapacityIssues(list, { ...none, quick: 'inprogress' }, NOW)).toEqual([prog]);
    expect(filterCapacityIssues(list, { ...none, quick: 'overdue' }, NOW)).toEqual([late]);
    expect(filterCapacityIssues(list, { ...none, quick: 'high' }, NOW)).toEqual([highest, a]);
    expect(filterCapacityIssues(list, { ...none, quick: 'vy' }, NOW)).toContain(a);
  });
  it('does not change the list it is given', () => {
    const copy = [...all];
    filterCapacityIssues(all, { ...none, searchQuery: 'login' }, NOW);
    expect(all).toEqual(copy);
  });
});

describe('hasCapacityFilters', () => {
  it('is false with nothing set', () => expect(hasCapacityFilters(none)).toBe(false));
  it('is true for each kind of filter', () => {
    expect(hasCapacityFilters({ ...none, searchQuery: 'x' })).toBe(true);
    expect(hasCapacityFilters({ ...none, mineOnly: true })).toBe(true);
    expect(hasCapacityFilters({ ...none, assignee: 'VY' })).toBe(true);
    expect(hasCapacityFilters({ ...none, quick: 'high' })).toBe(true);
    expect(hasCapacityFilters({ ...none, active: { statuses: ['todo'], priorities: [], labels: [] } as never })).toBe(true);
    expect(hasCapacityFilters({ ...none, active: { statuses: [], priorities: [], labels: [] } as never })).toBe(false);
  });
});

describe('buildWorkloads', () => {
  it('has one row per person, busiest first, with counts, points and colour', () => {
    const list = [
      t({ assigneeInitials: 'VY', assignee: 'Varun', status: 'done', storyPoints: 3 }),
      t({ assigneeInitials: 'VY', assignee: 'Varun', status: 'inprogress', blocked: true }),
      t({ assigneeInitials: 'BO', assignee: 'Bob', status: 'todo' }),
      t({ assigneeInitials: 'VY', assignee: 'Varun', status: 'backlog' }),
    ];
    const { workloads } = buildWorkloads(list, NOW);
    expect(workloads.map(w => w.initials)).toEqual(['VY', 'BO']);
    expect(workloads[0]).toMatchObject({ name: 'Varun', total: 3, done: 1, inProgress: 1, backlog: 1, todo: 0, blocked: 1, storyPoints: 5, avatarColor: PALETTE.brand });
    expect(workloads[1].avatarColor).toBe(PALETTE.successDeep);
  });
  it('derives initials from the name, and uses UN for nobody', () => {
    const { workloads } = buildWorkloads([t({ assignee: 'zed' }), t()], NOW);
    expect(workloads.map(w => [w.initials, w.name]).sort()).toEqual([['UN', 'Unassigned'], ['ZE', 'zed']]);
    expect(workloads.find(w => w.initials === 'UN')!.avatarColor).toBe(PALETTE.textMuted);
  });
  it('counts overdue tickets that are not done, per person and in total', () => {
    const past = new Date(2026, 10, 1) as never;
    const { workloads, totalOverdue } = buildWorkloads([t({ assigneeInitials: 'VY', dueDate: past }), t({ assigneeInitials: 'VY', dueDate: past, status: 'done' }), t({ assigneeInitials: 'VY' })], NOW);
    expect(totalOverdue).toBe(1);
    expect(workloads[0].overdue).toBe(1);
  });
  it('is empty for no tickets', () => expect(buildWorkloads([], NOW)).toEqual({ workloads: [], totalOverdue: 0 }));
});

describe('teamTotals', () => {
  it('counts tickets, done, in progress and points (1 when unestimated)', () => {
    expect(teamTotals([t({ status: 'done', storyPoints: 5 }), t({ status: 'inprogress' }), t()])).toEqual({ teamTotal: 3, teamDone: 1, teamInProgress: 1, teamPoints: 7 });
  });
});

describe('groupByStatus', () => {
  it('has five columns; blocked is a flag, not a status', () => {
    const list = [t({ status: 'todo', blocked: true }), t({ status: 'done', storyPoints: 3 }), t({ status: 'backlog' })];
    const g = groupByStatus(list, 5);
    expect(g.map(x => x.id)).toEqual(['backlog', 'todo', 'inprogress', 'blocked', 'done']);
    expect(g.find(x => x.id === 'blocked')!.items).toHaveLength(1);
    expect(g.find(x => x.id === 'todo')!.items).toHaveLength(1);
    expect(g.find(x => x.id === 'done')).toMatchObject({ points: 3, pct: 60 });
  });
  it('gives 0 percent when the team has no points', () => {
    expect(groupByStatus([], 0).every(x => x.pct === 0)).toBe(true);
  });
});

describe('groupByPriority', () => {
  it('has four groups and puts low and lowest together', () => {
    const g = groupByPriority([t({ priority: 'highest', storyPoints: 2 }), t({ priority: 'low' }), t({ priority: 'lowest' }), t({ priority: 'medium' })]);
    expect(g.map(x => x.id)).toEqual(['highest', 'high', 'medium', 'low']);
    expect(g.find(x => x.id === 'low')!.items).toHaveLength(2);
    expect(g.find(x => x.id === 'highest')!.points).toBe(2);
  });
});

describe('groupByEpic', () => {
  it('lists each epic with the filtered children linked by parent or epic id', () => {
    const epic = t({ type: 'epic', id: 100 });
    const a = t({ parentId: 100, status: 'done' });
    const b = t({ epicId: 100 });
    const other = t();
    const [g] = groupByEpic([epic, a, b, other], [a, b, other]);
    expect(g.children).toEqual([a, b]);
    expect(g).toMatchObject({ done: 1, progress: 50, points: 2 });
  });
  it('uses the epic\'s own status for 100 or 0 percent when it has no children in view', () => {
    const done = t({ type: 'epic', status: 'done' });
    const open = t({ type: 'epic', status: 'todo' });
    expect(groupByEpic([done, open], []).map(g => g.progress)).toEqual([100, 0]);
  });
  it('has nothing without epics', () => expect(groupByEpic([t()], [t()])).toEqual([]));
});
