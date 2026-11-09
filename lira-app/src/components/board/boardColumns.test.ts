import { describe, expect, it } from 'vitest';
import { columnIdFor, columnsFor, filterBoardIssues, groupIntoColumns, rankForDrop, wipLimitFor } from './boardColumns';
import { makeIssue } from '../../test/factories';

describe('Board columns', () => {
  it('has the four statuses, five priorities, and one column per epic plus a standalone one', () => {
    expect(columnsFor('status', []).map(c => c.id)).toEqual(['backlog', 'todo', 'inprogress', 'done']);
    expect(columnsFor('priority', [])).toHaveLength(5);
    const epics = columnsFor('epic', [makeIssue({ id: 7, key: 'T-7', type: 'epic', title: 'Big' })]);
    expect(epics.map(c => c.id)).toEqual(['epic-7', 'no-epic']);
  });

  it('puts you and Unassigned in the assignee columns even when nobody has a ticket', () => {
    const ids = columnsFor('assignee', [makeIssue({ id: 1, assignee: 'Priya Rao' })]).map(c => c.id);
    expect(ids).toEqual(expect.arrayContaining(['Priya Rao', 'Varun Tej', 'Unassigned']));
  });

  it('finds the column of a ticket for each grouping', () => {
    const i = makeIssue({ id: 1, status: 'done', priority: 'high', assignee: ' Sam ', epicId: 9 });
    expect([columnIdFor(i, 'status'), columnIdFor(i, 'priority'), columnIdFor(i, 'assignee'), columnIdFor(i, 'epic')]).toEqual(['done', 'high', 'Sam', 'epic-9']);
    expect(columnIdFor(makeIssue({ id: 2, assignee: undefined, epicId: undefined }), 'assignee')).toBe('Unassigned');
  });

  it('groups tickets in rank order, and a card just dropped shows in its new column at once', () => {
    const a = makeIssue({ id: 1, status: 'todo', rank: 20 });
    const b = makeIssue({ id: 2, status: 'todo', rank: 10 });
    const cols = columnsFor('status', []);
    expect(groupIntoColumns(cols, [a, b], 'status', {}).todo.map(i => i.id)).toEqual([2, 1]);
    const moved = groupIntoColumns(cols, [a, b], 'status', { 1: 'done' });
    expect([moved.todo.map(i => i.id), moved.done.map(i => i.id)]).toEqual([[2], [1]]);
  });

  it('filters by search, only-mine, priority, status and label together', () => {
    const list = [
      makeIssue({ id: 1, key: 'T-1', title: 'Login page', priority: 'high', labels: ['ui'], assigneeInitials: 'VY' }),
      makeIssue({ id: 2, key: 'T-2', title: 'Login api', priority: 'low', labels: ['api'], assigneeInitials: 'AB' }),
    ];
    expect(filterBoardIssues(list, 'login', false).map(i => i.id)).toEqual([1, 2]);
    expect(filterBoardIssues(list, 't-2', false).map(i => i.id)).toEqual([2]);
    expect(filterBoardIssues(list, '', true).map(i => i.id)).toEqual([1]);
    expect(filterBoardIssues(list, '', false, { priorities: ['low'], statuses: [], labels: [] }).map(i => i.id)).toEqual([2]);
    expect(filterBoardIssues(list, '', false, { priorities: [], statuses: [], labels: ['ui'] }).map(i => i.id)).toEqual([1]);
  });

  it('ranks a dropped card between its neighbours, and at either end', () => {
    const col = [10, 20, 30].map((rank, n) => makeIssue({ id: n, rank }));
    expect(rankForDrop([], 0)).toBe(1000);
    expect(rankForDrop(col, 0)).toBe(-90);
    expect(rankForDrop(col, 3)).toBe(130);
    expect(rankForDrop(col, 1)).toBe(15);
    const tight = [makeIssue({ id: 1, rank: 5 }), makeIssue({ id: 2, rank: 6 })];
    expect(rankForDrop(tight, 1)).toBe(5.5);
  });

  it('finds a WIP limit by id or by the column title in any spelling, and ignores zero', () => {
    expect(wipLimitFor({ inprogress: 3 }, 'inprogress', 'In Progress')).toBe(3);
    expect(wipLimitFor({ 'In Progress': 4 }, 'x', 'In Progress')).toBe(4);
    expect(wipLimitFor({ inprogress: 2 }, 'x', 'In Progress')).toBe(2);
    expect(wipLimitFor({ todo: 0 }, 'todo', 'To Do')).toBeUndefined();
  });
});
