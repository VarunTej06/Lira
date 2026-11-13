import { describe, expect, it } from 'vitest';
import { sortIssues } from './issueSort';
import { makeIssue } from '../test/factories';

const ids = (list: { id?: number }[]) => list.map(i => i.id);

describe('Sorting the list view', () => {
  it('sorts keys in number order, not text order', () => {
    const list = [makeIssue({ id: 1, key: 'T-10' }), makeIssue({ id: 2, key: 'T-2' }), makeIssue({ id: 3, key: 'T-1' })];
    expect(ids(sortIssues(list, 'key', true))).toEqual([3, 2, 1]);
    expect(ids(sortIssues(list, 'key', false))).toEqual([1, 2, 3]);
  });

  it('puts the most urgent priority first when ascending', () => {
    const list = [makeIssue({ id: 1, priority: 'low' }), makeIssue({ id: 2, priority: 'highest' }), makeIssue({ id: 3, priority: 'medium' })];
    expect(ids(sortIssues(list, 'priority', true))).toEqual([2, 3, 1]);
  });

  it('sorts by due date, with no date counting as earliest', () => {
    const list = [makeIssue({ id: 1, dueDate: new Date('2026-12-01') }), makeIssue({ id: 2 }), makeIssue({ id: 3, dueDate: new Date('2026-11-01') })];
    expect(ids(sortIssues(list, 'dueDate', true))).toEqual([2, 3, 1]);
  });

  it('sorts by assignee name, falling back to initials, and does not change the list it was given', () => {
    const list = [makeIssue({ id: 1, assignee: 'Zed' }), makeIssue({ id: 2, assignee: undefined, assigneeInitials: 'AB' }), makeIssue({ id: 3, assignee: 'Mia' })];
    expect(ids(sortIssues(list, 'assignee', true))).toEqual([2, 3, 1]);
    expect(ids(list)).toEqual([1, 2, 3]);
  });
});
