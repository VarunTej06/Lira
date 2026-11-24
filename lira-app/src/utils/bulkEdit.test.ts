import { describe, expect, it } from 'vitest';
import { makeIssue } from '../test/factories';
import { assigneesOf, beforeOf, isEmptyChange, patchOf, summary, UNASSIGNED } from './bulkEdit';

describe('what a bulk choice sets', () => {
  it('is empty until something is chosen, and sets only what was chosen', () => {
    expect(isEmptyChange({})).toBe(true);
    expect(isEmptyChange({ status: 'done' })).toBe(false);
    expect(patchOf({ priority: 'high' })).toEqual({ priority: 'high' });
    expect(patchOf({ status: 'done', priority: 'low' })).toEqual({ status: 'done', priority: 'low' });
  });
  it('gives a person with their initials, and clears both for Unassigned', () => {
    expect(patchOf({ assignee: 'Asha Rao' })).toEqual({ assignee: 'Asha Rao', assigneeInitials: 'AR' });
    expect(patchOf({ assignee: UNASSIGNED })).toEqual({ assignee: '', assigneeInitials: '' });
  });
  it('remembers only the fields the change touches, so Undo puts back exactly those', () => {
    const t = makeIssue({ status: 'todo', priority: 'low', assignee: 'Bo', assigneeInitials: 'B' });
    expect(beforeOf(t, patchOf({ status: 'done' }))).toEqual({ status: 'todo' });
    expect(beforeOf(t, patchOf({ assignee: 'Asha Rao' }))).toEqual({ assignee: 'Bo', assigneeInitials: 'B' });
  });
});

describe('the lists and the line shown afterwards', () => {
  it('lists each assignee once, in order, and skips tickets with nobody', () => {
    expect(assigneesOf([makeIssue({ assignee: 'Bo' }), makeIssue({ assignee: 'Asha' }), makeIssue({ assignee: 'Bo' }), makeIssue({ assignee: '' })])).toEqual(['Asha', 'Bo']);
  });
  it('says how many were updated, and how many were not', () => {
    expect(summary(1, 0)).toBe('Updated 1 ticket');
    expect(summary(3, 0)).toBe('Updated 3 tickets');
    expect(summary(2, 1)).toBe('Updated 2 tickets, 1 could not be changed');
  });
});
