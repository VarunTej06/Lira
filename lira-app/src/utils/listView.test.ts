import { describe, expect, it } from 'vitest';
import type { Issue } from '../types/issue';
import { filterListIssues, pageWindow } from './listView';

const t = (over: Partial<Issue>) => ({ key: 'A-1', title: 'T', status: 'todo', priority: 'medium', labels: [], ...over }) as Issue;
const f = (statuses: string[] = [], priorities: string[] = [], labels: string[] = []) => ({ statuses, priorities, labels }) as never;
const keys = (l: Issue[]) => l.map(i => i.key);

describe('filterListIssues', () => {
  const list = [t({ key: 'A-1', title: 'Fix login', assignee: 'Bob', priority: 'high', labels: ['ui'] }), t({ key: 'B-2', title: 'Export', priority: 'low', labels: ['api'], status: 'done' })];
  it('keeps everything with no search and no filters', () => expect(filterListIssues(list, '')).toEqual(list));
  it('matches key, title and assignee (the caller lower-cases the search)', () => {
    expect(keys(filterListIssues(list, 'login'))).toEqual(['A-1']);
    expect(keys(filterListIssues(list, 'b-2'))).toEqual(['B-2']);
    expect(keys(filterListIssues(list, 'bob'))).toEqual(['A-1']);
    expect(filterListIssues(list, 'zzz')).toEqual([]);
  });
  it('filters by priority, label and status', () => {
    expect(keys(filterListIssues(list, '', f([], ['low'])))).toEqual(['B-2']);
    expect(keys(filterListIssues(list, '', f([], [], ['ui'])))).toEqual(['A-1']);
    expect(keys(filterListIssues(list, '', f(['done'])))).toEqual(['B-2']);
  });
  it('needs every filter to match, and ignores empty ones', () => {
    expect(filterListIssues(list, '', f(['done'], ['high']))).toEqual([]);
    expect(filterListIssues(list, '', f([], [], []))).toEqual(list);
  });
  it('copes with a ticket without labels', () => {
    expect(filterListIssues([t({ labels: undefined as never })], '', f([], [], ['x']))).toEqual([]);
  });
});

describe('pageWindow', () => {
  it('gives the slice bounds and page count', () => {
    expect(pageWindow(40, 2, 15)).toEqual({ totalPages: 3, current: 2, start: 15, end: 30 });
  });
  it('cuts the last page short', () => {
    expect(pageWindow(40, 3, 15)).toMatchObject({ start: 30, end: 40 });
  });
  it('keeps the page between 1 and the last', () => {
    expect(pageWindow(40, 0, 15).current).toBe(1);
    expect(pageWindow(40, 99, 15).current).toBe(3);
  });
  it('has one empty page for nothing', () => {
    expect(pageWindow(0, 1, 15)).toEqual({ totalPages: 1, current: 1, start: 0, end: 0 });
  });
});
