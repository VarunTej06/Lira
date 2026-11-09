import { describe, expect, it } from 'vitest';
import type { Issue } from '../../types/issue';
import { DEFAULT_FILTERS, type StatMetric } from './types';
import { METRIC_IDS, groupIssues, metricIssues, metricValue, scopeIssues } from './metrics';

const NOW = new Date(2026, 10, 9, 12, 0, 0);
const day = (offset: number) => new Date(2026, 10, 9 + offset, 9, 0, 0);

let n = 0;
const issue = (over: Partial<Issue>): Issue => ({
  id: ++n, spaceId: 1, key: `T-${n}`, title: `t${n}`, description: '', type: 'task', status: 'todo', priority: 'medium',
  reporter: 'A', reporterInitials: 'A', labels: [], subtasks: [], comments: [], activity: [], attachments: [], linkedIssues: [],
  rank: n, watchers: [], createdAt: day(-20), updatedAt: day(-1), ...over,
} as Issue);

const ISSUES: Issue[] = [
  issue({ status: 'backlog', assignee: 'Ann', priority: 'low', labels: ['x'] }),
  issue({ status: 'todo', dueDate: day(-3), priority: 'highest' }),
  issue({ status: 'todo', dueDate: day(3), assignee: 'Bob', assigneeInitials: 'BB', storyPoints: 3 }),
  issue({ status: 'inprogress', blocked: true, type: 'bug', priority: 'high', assignee: 'Ann', storyPoints: 5 }),
  issue({ status: 'done', resolvedAt: day(-2), createdAt: day(-12), assignee: 'Ann', storyPoints: 2 }),
  issue({ status: 'done', resolvedAt: day(-30), createdAt: day(-40), type: 'bug', labels: ['x', 'y'] }),
  issue({ type: 'epic', status: 'inprogress' }),
];

const ctx = { issues: ISSUES, spaces: [{ id: 1, key: 'S', name: 'Space', icon: '', color: '#123456', createdAt: new Date(0), updatedAt: new Date(0) }] };

describe('stat cards: the number and the tickets behind it agree', () => {
  const countMetrics = METRIC_IDS.filter(m => !['points_open', 'points_done', 'lead_days', 'completion'].includes(m));

  it.each(countMetrics)('%s', metric => {
    expect(metricValue(metric as StatMetric, ISSUES, NOW).value).toBe(metricIssues(metric as StatMetric, ISSUES, NOW).length);
  });

  it('the point metrics add up the story points of the tickets behind them', () => {
    const sum = (m: StatMetric) => metricIssues(m, ISSUES, NOW).reduce((a, i) => a + (i.storyPoints ?? 0), 0);
    expect(metricValue('points_open', ISSUES, NOW).value).toBe(sum('points_open'));
    expect(metricValue('points_done', ISSUES, NOW).value).toBe(sum('points_done'));
  });

  it('knows each count by hand (epics are not work items)', () => {
    const v = (m: StatMetric) => metricValue(m, ISSUES, NOW).value;
    expect([v('total'), v('open'), v('done'), v('in_progress'), v('blocked')]).toEqual([6, 4, 2, 1, 1]);
    expect([v('overdue'), v('due_soon'), v('unassigned'), v('high_priority'), v('bugs_open')]).toEqual([1, 1, 1, 2, 1]);
    expect([v('done_week'), v('completion'), v('points_open'), v('points_done')]).toEqual([1, 33, 8, 2]);
  });

  it('lead time is the average days from created to done, to one decimal', () => {
    expect(metricValue('lead_days', ISSUES, NOW).value).toBe(10); // both finished tickets took 10 days
  });
});

describe('groupIssues', () => {
  it('lists statuses in the board order, not by size', () => {
    const keys = groupIssues(ISSUES, 'status', 'count', ctx).map(g => g.key);
    expect(keys).toEqual(['backlog', 'todo', 'inprogress', 'done']);
  });

  it('lists priorities from highest to lowest', () => {
    const keys = groupIssues(ISSUES, 'priority', 'count', ctx).map(g => g.key);
    expect(keys).toEqual(['highest', 'high', 'medium', 'low']);
  });

  it('sorts other groupings by size and counts a ticket under each of its labels', () => {
    const groups = groupIssues(ISSUES, 'label', 'count', ctx);
    expect(groups[0]).toMatchObject({ key: '(none)', value: 4 });
    expect(groups.find(g => g.key === 'x')!.value).toBe(2);
    expect(groups.find(g => g.key === 'y')!.value).toBe(1);
  });

  it('can count story points instead of tickets', () => {
    const groups = groupIssues(ISSUES, 'assignee', 'points', ctx);
    expect(groups.find(g => g.key === 'Ann')!.value).toBe(7);
  });

  it('folds the smallest groups into one "Other" group when there are too many', () => {
    const many = Array.from({ length: 6 }, (_, k) => issue({ labels: [`l${k}`] }));
    const groups = groupIssues(many, 'label', 'count', ctx, 4);
    expect(groups).toHaveLength(4);
    expect(groups[3]).toMatchObject({ key: '(other)', label: 'Other (3)', value: 3 });
  });

  it('gives every group a colour', () => {
    expect(groupIssues(ISSUES, 'label', 'count', ctx).every(g => !!g.color)).toBe(true);
  });
});

describe('scopeIssues: each filter on its own', () => {
  const scope = (over: Partial<typeof DEFAULT_FILTERS>) => scopeIssues(ISSUES, { ...DEFAULT_FILTERS, ...over }, { now: NOW, me: ['ann'] }).length;

  it('keeps everything with no filters', () => expect(scope({})).toBe(7));
  it('filters by space', () => { expect(scope({ spaceIds: [1] })).toBe(7); expect(scope({ spaceIds: [2] })).toBe(0); });
  it('filters by priority', () => expect(scope({ priorities: ['highest', 'high'] })).toBe(2));
  it('filters by type', () => expect(scope({ types: ['bug'] })).toBe(2));
  it('filters by label', () => expect(scope({ labels: ['y'] })).toBe(1));
  it('filters to my tickets', () => expect(scope({ assignee: 'me' })).toBe(3));
  it('filters to unassigned tickets', () => expect(scope({ assignee: 'unassigned' })).toBe(3));
  it('filters to a named person, ignoring case', () => expect(scope({ assignee: 'BOB' })).toBe(1));
  it('drops work finished before the time window, but keeps open work', () => expect(scope({ range: '7d' })).toBe(6));
});
