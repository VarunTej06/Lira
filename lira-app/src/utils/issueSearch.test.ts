import { describe, expect, it } from 'vitest';
import { facetOptions, issuesToCsv, presetCounts, searchIssues, type SearchCriteria } from './issueSearch';
import { makeIssue } from '../test/factories';

const NOW = new Date(2026, 10, 9, 12).getTime();
const NONE: SearchCriteria = { query: '', spaces: [], statuses: [], priorities: [], types: [], assignees: [], labels: [], team: 'all', recentOnly: false, sort: 'key', ascending: false };
const day = (n: number) => new Date(NOW - n * 86400000);
const list = [
  makeIssue({ id: 1, key: 'T-1', title: 'Login page', status: 'todo', priority: 'high', labels: ['ui'], assigneeInitials: 'VY', spaceId: 1, updatedAt: day(1) }),
  makeIssue({ id: 2, key: 'T-10', title: 'Billing api', status: 'done', priority: 'low', labels: ['api'], assigneeInitials: 'AB', spaceId: 2, updatedAt: day(30) }),
  makeIssue({ id: 3, key: 'T-2', title: 'Stuck thing', status: 'inprogress', priority: 'high', blocked: true, labels: [], assigneeInitials: undefined, assignee: undefined, spaceId: 1, updatedAt: day(2) }),
];
const ids = (c: Partial<SearchCriteria>) => searchIssues(list, { ...NONE, ...c }, NOW).map(i => i.id);

describe('Filters page search', () => {
  it('with nothing chosen shows everything, keys in number order', () => expect(ids({})).toEqual([1, 3, 2]));
  it('searches key, title and label', () => {
    expect(ids({ query: 'billing' })).toEqual([2]);
    expect(ids({ query: 't-2' })).toEqual([3]);
    expect(ids({ query: 'ui' })).toEqual([1]);
  });
  it('combines filters: a ticket must match every kind chosen', () => {
    expect(ids({ spaces: [1], priorities: ['high'] })).toEqual([1, 3]);
    expect(ids({ spaces: [1], statuses: ['todo'] })).toEqual([1]);
  });
  it('treats Blocked as the flag, not a status', () => expect(ids({ statuses: ['blocked'] })).toEqual([3]));
  it('matches an unassigned ticket as UN', () => expect(ids({ assignees: ['UN'] })).toEqual([3]));
  it('shows only the last week when recent only is on', () => expect(ids({ recentOnly: true })).toEqual([1, 3]));
  it('sorts by priority (most urgent first), and reverses', () => {
    expect(ids({ sort: 'priority' })[2]).toBe(2);
    expect(ids({ sort: 'priority', ascending: true })[0]).toBe(2);
  });
});

describe('Filters page helpers', () => {
  it('counts for the quick filters', () => expect(presetCounts(list, NOW)).toEqual({ all: 3, open: 2, completed: 1, recent: 2 }));
  it('lists labels sorted, assignees and teams without blanks or repeats', () => {
    const f = facetOptions([...list, makeIssue({ id: 4, labels: ['api', 'zz'], team: 'Core', assigneeInitials: 'VY' })]);
    expect(f.labels).toEqual(['api', 'ui', 'zz']);
    expect(f.assignees).toEqual(['VY', 'AB']);
    expect(f.teams).toEqual(['Core']);
  });
  it('writes CSV with quoted cells and doubled quotes', () => {
    const csv = issuesToCsv([makeIssue({ id: 9, key: 'T-9', title: 'He said "hi"', labels: ['a', 'b'] })], () => 'Space');
    expect(csv.split('\n')[0]).toBe('Key,Title,Space,Type,Status,Priority,Assignee,Labels,Updated');
    expect(csv).toContain('"He said ""hi"""');
    expect(csv).toContain('"a, b"');
  });
});
