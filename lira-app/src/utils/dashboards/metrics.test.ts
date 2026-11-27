import { describe, expect, it } from 'vitest';
import { makeIssue } from '../../test/factories';
import {
  LIST_META, METRICS, METRIC_IDS, dueStrip, mergeFilters, roadmapRows, scopeIssues, workload,
} from './metrics';
import { DEFAULT_FILTERS } from './types';

const NOW = new Date(2026, 10, 9, 12);
const day = (n: number) => new Date(2026, 10, 9 + n, 12);

describe('merging filters', () => {
  it('puts the second on top of the first and leaves the first alone', () => {
    const merged = mergeFilters(DEFAULT_FILTERS, { priorities: ['high'] });
    expect(merged.priorities).toEqual(['high']);
    expect(merged.range).toBe('all');
    expect(DEFAULT_FILTERS.priorities).toEqual([]);
    expect(mergeFilters(DEFAULT_FILTERS)).toEqual(DEFAULT_FILTERS);
  });
});

describe('the tables that name things', () => {
  it('has a name and an explanation for every number', () => {
    expect(METRIC_IDS.length).toBeGreaterThan(5);
    METRIC_IDS.forEach(id => expect(METRICS[id].label, id).toBeTruthy());
  });
  it('has a name for every kind of list', () => {
    Object.values(LIST_META).forEach(m => { expect(m.label).toBeTruthy(); expect(m.description).toBeTruthy(); });
  });
});

describe('scoping by a person', () => {
  const list = [makeIssue({ id: 1, assignee: 'Ann' }), makeIssue({ id: 2, assignee: 'Bob' }), makeIssue({ id: 3, assignee: undefined, assigneeInitials: undefined })];
  const ids = (assignee: string, me = ['ann']) => scopeIssues(list, { ...DEFAULT_FILTERS, assignee }, { now: NOW, me }).map(i => i.id);
  it('finds mine by name or initials, one person by name, or the ones with nobody', () => {
    expect(ids('me')).toEqual([1]);
    expect(ids('bob')).toEqual([2]);
    expect(ids('unassigned')).toEqual([3]);
    expect(ids('all')).toEqual([1, 2, 3]);
  });
});

describe('workload', () => {
  it('counts open work, points and trouble per person, busiest first, and flags a person with three overdue', () => {
    const rows = workload([
      makeIssue({ assignee: 'Ann', storyPoints: 3, dueDate: day(-3) }), makeIssue({ assignee: 'Ann', storyPoints: 3, dueDate: day(-2) }),
      makeIssue({ assignee: 'Ann', storyPoints: 3, dueDate: day(-1) }), makeIssue({ assignee: 'Bob', storyPoints: 1 }),
      makeIssue({ assignee: 'Bob', status: 'done', resolvedAt: day(-1) }),
    ], NOW);
    expect(rows.map(r => r.name)).toEqual(['Ann', 'Bob']);
    expect(rows[0]).toMatchObject({ open: 3, points: 9, overdue: 3, overloaded: true });
    expect(rows[1]).toMatchObject({ open: 1, done: 1, overloaded: false });
  });
  it('groups tickets with nobody on them under Unassigned, never flagged', () => {
    const rows = workload([makeIssue({ storyPoints: 20 })], NOW);
    expect(rows[0]).toMatchObject({ name: 'Unassigned', overloaded: false });
  });
});

describe('the due strip', () => {
  it('has one entry per day from today and counts open tickets on their day only', () => {
    const strip = dueStrip([
      makeIssue({ dueDate: day(0) }), makeIssue({ dueDate: day(2) }), makeIssue({ dueDate: day(2) }),
      makeIssue({ dueDate: day(-1) }), makeIssue({ dueDate: day(20) }), makeIssue({ dueDate: day(1), status: 'done', resolvedAt: day(0) }),
    ], NOW);
    expect(strip).toHaveLength(14);
    expect(strip.map(d => d.count).slice(0, 4)).toEqual([1, 0, 2, 0]);
    expect(dueStrip([], NOW, 3)).toHaveLength(3);
  });
});

describe('roadmap rows', () => {
  it('is empty with no roadmaps, and leaves archived ones out', () => {
    expect(roadmapRows({ roadmaps: [], issues: [], now: NOW })).toEqual([]);
    const archived = { id: 'r', name: 'Old', archived: true, items: [{ id: 'i', title: 'T', start: '2026-01-01', end: '2026-02-01' }] };
    expect(roadmapRows({ roadmaps: [archived as never], issues: [], now: NOW })).toEqual([]);
  });
});
