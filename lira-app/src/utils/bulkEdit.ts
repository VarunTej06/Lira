import type { Issue, Priority } from '../types/issue';
import { initialsOf } from './hostedProfile';
import { STATUS_LIST } from './status';

export interface BulkChange { status?: string; priority?: Priority; assignee?: string }

export const BULK_PRIORITIES: readonly Priority[] = ['highest', 'high', 'medium', 'low', 'lowest'];
export const BULK_STATUSES: readonly string[] = STATUS_LIST.map(s => s.id);
export const UNASSIGNED = 'Unassigned';

/** True when the choice would change nothing, so Apply stays off. */
export const isEmptyChange = (c: BulkChange): boolean => !c.status && !c.priority && !c.assignee;

/** The fields a choice sets on a ticket; "Unassigned" clears the person. Only what was chosen is touched. */
export function patchOf(c: BulkChange): Partial<Issue> {
  const patch: Partial<Issue> = {};
  if (c.status) patch.status = c.status;
  if (c.priority) patch.priority = c.priority;
  if (c.assignee) { patch.assignee = c.assignee === UNASSIGNED ? '' : c.assignee; patch.assigneeInitials = c.assignee === UNASSIGNED ? '' : initialsOf(c.assignee); }
  return patch;
}

/** What the ticket held before, for exactly the fields a patch sets, so the change can be put back. */
export const beforeOf = (issue: Issue, patch: Partial<Issue>): Partial<Issue> =>
  Object.fromEntries(Object.keys(patch).map(k => [k, issue[k as keyof Issue]])) as Partial<Issue>;

/** The people the tickets are assigned to, once each, for the Assignee list. */
export const assigneesOf = (issues: readonly Issue[]): string[] =>
  [...new Set(issues.map(i => i.assignee).filter((a): a is string => !!a))].sort((a, b) => a.localeCompare(b));

/** One line for the toast: "Updated 3 tickets" or "Updated 2 tickets, 1 could not be changed". */
export function summary(done: number, failed: number): string {
  const n = (c: number) => `${c} ticket${c === 1 ? '' : 's'}`;
  return failed === 0 ? `Updated ${n(done)}` : `Updated ${n(done)}, ${failed} could not be changed`;
}
