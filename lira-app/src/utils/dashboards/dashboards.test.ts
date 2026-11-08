import { beforeEach, describe, expect, it } from 'vitest';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { DEFAULT_FILTERS, type Dashboard } from './types';
import {
  agingGroups, blockedRows, dueStrip, evaluateGoal, groupIssues, listRows, metricIssues, metricValue, progressRows, scopeIssues, summaryLines, weeklySeries, workload,
  type DataCtx,
} from './metrics';
import { CATALOG, SCENARIOS, entryById, widgetFromEntry } from './catalog';
import { isDashboardRequest, planFromPrompt } from './promptBuilder';
import { lastScheduledMoment, nextScheduledMoment, snapshotDue, snapshotFileName, snapshotMarkdown } from './snapshot';
import { addDashboard, buildDashboard, duplicateDashboard, normalizeDashboard, readDashboards, removeDashboard, updateDashboard } from './store';
import { widgetData } from './data';

const NOW = new Date(2026, 10, 9, 12, 0, 0); // Mon 9 Nov 2026
const day = (n: number) => new Date(2026, 10, 9 + n, 12, 0, 0);
let seq = 0;
const issue = (o: Partial<Issue> = {}): Issue => ({
  id: ++seq, spaceId: 1, key: `LIRA-${seq}`, title: `Ticket ${seq}`, description: '', type: 'task', status: 'todo', priority: 'medium',
  reporter: 'VY', reporterInitials: 'VY', labels: [], subtasks: [], comments: [], activity: [], attachments: [], linkedIssues: [], rank: seq,
  createdAt: day(-20), updatedAt: day(-1), watchers: [], ...o,
}) as Issue;
const space: Space = { id: 1, name: 'Lira', key: 'LIRA', icon: 'x', color: '#0C66E4', createdAt: NOW, updatedAt: NOW };
const ctx = (issues: Issue[]): DataCtx => ({ issues, spaces: [space], projects: [], roadmaps: [], now: NOW, me: ['vy', 'varuntej yadla'] });

beforeEach(() => { seq = 0; localStorage.clear(); });

describe('scope and numbers', () => {
  it('counts open, done, blocked, overdue, unassigned and points', () => {
    const list = [
      issue({ status: 'inprogress', assignee: 'Ann', storyPoints: 5 }),
      issue({ status: 'todo', blocked: true, blockedByIds: [1], dueDate: day(-2), storyPoints: 3 }),
      issue({ status: 'done', resolvedAt: day(-2), assignee: 'Ann', storyPoints: 2 }),
      issue({ status: 'backlog' }),
      issue({ type: 'epic', status: 'inprogress' }),
    ];
    const m = (k: Parameters<typeof metricValue>[0]) => metricValue(k, list, NOW).value;
    expect(m('total')).toBe(4);
    expect(m('open')).toBe(3);
    expect(m('done')).toBe(1);
    expect(m('blocked')).toBe(1);
    expect(m('overdue')).toBe(1);
    expect(m('unassigned')).toBe(2);
    expect(m('points_open')).toBe(8);
    expect(m('points_done')).toBe(2);
    expect(m('completion')).toBe(25);
    expect(m('done_week')).toBe(1);
  });

  it('shows the change since last week', () => {
    const list = [issue({ createdAt: day(-30) }), issue({ createdAt: day(-3) }), issue({ createdAt: day(-2) })];
    const r = metricValue('open', list, NOW);
    expect(r.value).toBe(3);
    expect(r.trend).toBe(2); // two were added in the last 7 days
  });

  it('filters by space, person, priority, type, sprint, and keeps old finished work out of a period', () => {
    const list = [
      issue({ assignee: 'Varuntej Yadla', priority: 'high' }),
      issue({ assignee: 'Ann', priority: 'low', type: 'bug' }),
      issue({ status: 'done', resolvedAt: day(-60) }),
      issue({ status: 'done', resolvedAt: day(-3) }),
      issue({ spaceId: 2 }),
      issue({ sprint: '2026-10' }),
    ];
    const f = (p: Partial<typeof DEFAULT_FILTERS>) => scopeIssues(list, { ...DEFAULT_FILTERS, ...p }, ctx(list)).length;
    expect(f({})).toBe(6);
    expect(f({ spaceIds: [1] })).toBe(5);
    expect(f({ assignee: 'me' })).toBe(1);
    expect(f({ assignee: 'Ann' })).toBe(1);
    expect(f({ assignee: 'unassigned' })).toBe(4);
    expect(f({ priorities: ['high'] })).toBe(1);
    expect(f({ types: ['bug'] })).toBe(1);
    expect(f({ range: '30d' })).toBe(5); // the ticket finished 60 days ago is left out
    expect(f({ sprint: '2026-10' })).toBe(6); // tickets without a sprint count in the month they were created
    expect(f({ sprint: '2026-09' })).toBe(0);
  });

  it('opens the tickets behind a number', () => {
    const list = [issue({ blocked: true }), issue(), issue({ status: 'done' })];
    expect(metricIssues('blocked', list, NOW)).toHaveLength(1);
    expect(metricIssues('open', list, NOW)).toHaveLength(2);
  });

  it('evaluates alerts', () => {
    const list = [issue({ blocked: true }), issue({ blocked: true }), issue({ blocked: true }), issue({ blocked: true })];
    expect(evaluateGoal({ metric: 'blocked', op: 'above', value: 3 }, list, NOW).breached).toBe(true);
    expect(evaluateGoal({ metric: 'blocked', op: 'above', value: 4 }, list, NOW).breached).toBe(false);
    expect(evaluateGoal({ metric: 'done_week', op: 'below', value: 1 }, list, NOW).breached).toBe(true);
  });
});

describe('charts and lists', () => {
  it('groups by status, priority, assignee and label with counts or points', () => {
    const list = [issue({ status: 'todo', priority: 'high', assignee: 'Ann', labels: ['a', 'b'], storyPoints: 5 }), issue({ status: 'done', priority: 'high', labels: ['a'], storyPoints: 3 })];
    const g = (by: Parameters<typeof groupIssues>[1], measure: 'count' | 'points' = 'count') => groupIssues(list, by, measure, ctx(list));
    expect(g('status').map(x => [x.key, x.value])).toEqual([['todo', 1], ['done', 1]]);
    expect(g('priority')[0]).toMatchObject({ key: 'high', value: 2 });
    expect(g('assignee', 'points').map(x => [x.label, x.value])).toEqual([['Ann', 5], ['Unassigned', 3]]);
    expect(g('label').find(x => x.key === 'a')?.value).toBe(2);
    expect(g('status').every(x => !!x.color)).toBe(true);
  });

  it('builds weekly created / finished / open series', () => {
    const list = [issue({ createdAt: day(-30) }), issue({ createdAt: day(-3) }), issue({ createdAt: day(-30), status: 'done', resolvedAt: day(-2) })];
    const s = weeklySeries(list, 4, NOW);
    expect(s).toHaveLength(4);
    expect(s[3]).toMatchObject({ created: 1, done: 1, open: 2 });
    expect(s[0].open).toBe(2);
  });

  it('lists overdue, due soon, attention, stale and my tickets', () => {
    const list = [
      issue({ dueDate: day(-3), assignee: 'Varuntej Yadla' }),
      issue({ dueDate: day(2) }),
      issue({ blocked: true, blockedByIds: [2] }),
      issue({ status: 'inprogress', updatedAt: day(-20) }),
      issue({ status: 'done', resolvedAt: day(-1) }),
    ];
    const c = ctx(list);
    expect(listRows('overdue', list, c).map(r => r.note)).toEqual(['3d overdue']);
    expect(listRows('due_soon', list, c)[0].note).toBe('due in 2d');
    expect(listRows('stale', list, c)).toHaveLength(1);
    expect(listRows('my_open', list, c)).toHaveLength(1);
    expect(listRows('recent_done', list, c)).toHaveLength(1);
    const att = listRows('attention', list, c);
    expect(att.length).toBeGreaterThanOrEqual(3);
    expect(att[0].note).toMatch(/blocked by LIRA-2/);
  });

  it('shows blocked tickets with their blockers and how long', () => {
    const a = issue({ title: 'blocker' });
    const b = issue({ blocked: true, blockedByIds: [a.id!], blockedAt: day(-4).toISOString() });
    const rows = blockedRows([a, b], ctx([a, b]));
    expect(rows).toHaveLength(1);
    expect(rows[0].blockers[0].key).toBe(a.key);
    expect(rows[0].days).toBe(4);
  });

  it('flags an overloaded person', () => {
    const list = [
      ...Array.from({ length: 4 }, () => issue({ assignee: 'Ann', storyPoints: 8, status: 'inprogress' })),
      issue({ assignee: 'Bob', storyPoints: 2 }), issue({ assignee: 'Cy', storyPoints: 2 }),
    ];
    const rows = workload(list, NOW);
    expect(rows[0]).toMatchObject({ name: 'Ann', points: 32, overloaded: true });
    expect(rows.find(r => r.name === 'Bob')?.overloaded).toBe(false);
  });

  it('shows progress by epic and by sprint, aging and the due strip', () => {
    const epic = issue({ type: 'epic', title: 'Big' });
    const list = [epic, issue({ epicId: epic.id, status: 'done' }), issue({ epicId: epic.id }), issue({ status: 'inprogress', updatedAt: day(-8) }), issue({ dueDate: day(1) })];
    const c = ctx(list);
    expect(progressRows('epic', list, c)[0]).toMatchObject({ done: 1, total: 2, percent: 50 });
    expect(progressRows('sprint', list, c).length).toBeGreaterThan(0);
    expect(agingGroups(list, NOW).find(g => g.label === '6-10 days')?.value).toBe(1);
    expect(dueStrip(list, NOW)[1].count).toBe(1);
  });

  it('writes plain headline sentences', () => {
    const list = [issue({ blocked: true }), issue({ status: 'done', resolvedAt: day(-1) })];
    const lines = summaryLines(list, ctx(list));
    expect(lines[0]).toMatch(/1 open ticket, 1 done/);
    expect(lines.join(' ')).toMatch(/1 blocked/);
  });
});

describe('catalog and scenarios', () => {
  it('every scenario widget exists, and every catalog entry makes a widget', () => {
    SCENARIOS.forEach(s => s.widgets.forEach(id => expect(entryById(id), `${s.id} -> ${id}`).toBeDefined()));
    CATALOG.forEach(c => expect(widgetFromEntry(c.id)?.type).toBe(c.type));
    expect(new Set(CATALOG.map(c => c.id)).size).toBe(CATALOG.length);
  });

  it('every catalog widget can compute its data without errors, even with no tickets', () => {
    const d = buildDashboard({ name: 'x', scenario: 'custom', filters: DEFAULT_FILTERS, entryIds: [] });
    const some = [issue({ status: 'inprogress', assignee: 'Ann' }), issue({ blocked: true })];
    for (const items of [[], some]) {
      CATALOG.forEach(c => expect(() => widgetData(d, widgetFromEntry(c.id)!, ctx(items)), c.id).not.toThrow());
    }
  });
});

describe('build from a description', () => {
  it('recognises dashboard requests', () => {
    expect(isDashboardRequest('create a dashboard of blocked tickets')).toBe(true);
    expect(isDashboardRequest('show me my tickets')).toBe(false);
  });

  it('picks widgets and filters from the words', () => {
    const p = planFromPrompt('build a dashboard of what is blocked in the current sprint and who is overloaded', [space]);
    expect(p.entries).toEqual(expect.arrayContaining(['stat-blocked', 'blocked', 'workload']));
    expect(p.filters.sprint).toBe('current');
    const mine = planFromPrompt('make a dashboard of my overdue tickets this week', [space]);
    expect(mine.filters.assignee).toBe('me');
    expect(mine.filters.range).toBe('7d');
    expect(mine.entries).toContain('list-overdue');
    const bugs = planFromPrompt('dashboard for bugs in Lira', [space]);
    expect(bugs.filters.types).toEqual(['bug']);
    expect(bugs.filters.spaceIds).toEqual([1]);
  });

  it('falls back to an overview and says so', () => {
    const p = planFromPrompt('create a dashboard', []);
    expect(p.scenario).toBe('executive');
    expect(p.understood.join(' ')).toMatch(/general overview/);
  });
});

describe('weekly snapshot schedule', () => {
  const sched = { enabled: true, day: 1, hour: 9 }; // Mondays 09:00
  it('finds the last and next scheduled moment', () => {
    const last = lastScheduledMoment(sched, NOW); // Mon 9 Nov 12:00 -> Mon 9 Nov 09:00
    expect(last.getDate()).toBe(9); expect(last.getHours()).toBe(9);
    const before = new Date(2026, 10, 9, 8, 0); // before 09:00 -> previous Monday
    expect(lastScheduledMoment(sched, before).getDate()).toBe(2);
    expect(nextScheduledMoment(sched, NOW).getDate()).toBe(16);
  });
  it('is due when the moment passed without a snapshot, and not again afterwards', () => {
    expect(snapshotDue(undefined, NOW)).toBe(false);
    expect(snapshotDue({ ...sched, enabled: false }, NOW)).toBe(false);
    expect(snapshotDue(sched, NOW)).toBe(true);
    expect(snapshotDue({ ...sched, lastRun: new Date(2026, 10, 9, 9, 5).toISOString() }, NOW)).toBe(false);
    expect(snapshotDue({ ...sched, lastRun: new Date(2026, 10, 2, 9, 5).toISOString() }, NOW)).toBe(true); // missed this Monday
  });
  it('writes a Markdown file name and a readable summary', () => {
    expect(snapshotFileName({ id: 'x', name: 'Sprint Health!' }, NOW)).toBe('sprint-health-2026-11-09.md');
    const d = buildDashboard({ name: 'Weekly', scenario: 'executive', filters: DEFAULT_FILTERS, entryIds: ['summary', 'stat-open', 'bar-status', 'list-attention', 'workload'] });
    d.goals = [{ id: 'g', metric: 'blocked', op: 'above', value: 0 }];
    const list = [issue({ blocked: true, assignee: 'Ann' })];
    const md = snapshotMarkdown(d as Dashboard, ctx(list));
    expect(md).toMatch(/^# Weekly/);
    expect(md).toMatch(/ALERT: Blocked/);
    expect(md).toMatch(/\| Ann /);
  });
});

describe('saved dashboards', () => {
  it('fills in missing fields, saves, updates, duplicates and removes', () => {
    expect(normalizeDashboard({}).name).toBe('Untitled dashboard');
    expect(readDashboards()).toEqual([]);
    const d = addDashboard(buildDashboard({ name: 'One', scenario: 'custom', filters: DEFAULT_FILTERS, entryIds: ['stat-open', 'bar-status'] }));
    expect(readDashboards()).toHaveLength(1);
    updateDashboard(d.id, x => ({ ...x, name: 'Renamed' }));
    expect(readDashboards()[0].name).toBe('Renamed');
    const copy = duplicateDashboard(d.id)!;
    expect(copy.widgets[0].id).not.toBe(d.widgets[0].id);
    expect(readDashboards()).toHaveLength(2);
    removeDashboard(d.id);
    expect(readDashboards().map(x => x.id)).toEqual([copy.id]);
  });

  it('survives a damaged saved value', () => {
    localStorage.setItem('lira_dashboards', '{not json');
    expect(readDashboards()).toEqual([]);
  });
});
