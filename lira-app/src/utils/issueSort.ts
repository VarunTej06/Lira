import type { Issue } from '../types/issue';

export type SortField = 'key' | 'title' | 'type' | 'status' | 'priority' | 'assignee' | 'dueDate' | 'createdAt';

const PRIORITY_RANK: Record<string, number> = { highest: 5, high: 4, medium: 3, low: 2, lowest: 1 };
const time = (d?: Date | string) => (d ? new Date(d).getTime() : 0);

const text = (s: string | undefined) => s ?? '';

/** How to compare two tickets for each column of the list. Priority puts the most urgent first when ascending. */
const COMPARERS: Record<SortField, (a: Issue, b: Issue) => number> = {
  key: (a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }),
  title: (a, b) => a.title.localeCompare(b.title),
  type: (a, b) => a.type.localeCompare(b.type),
  status: (a, b) => a.status.localeCompare(b.status),
  priority: (a, b) => (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0),
  assignee: (a, b) => text(a.assignee || a.assigneeInitials).localeCompare(text(b.assignee || b.assigneeInitials)),
  dueDate: (a, b) => time(a.dueDate) - time(b.dueDate),
  createdAt: (a, b) => time(a.createdAt) - time(b.createdAt),
};

export function sortIssues(issues: Issue[], field: SortField, ascending: boolean): Issue[] {
  return [...issues].sort((a, b) => (ascending ? 1 : -1) * COMPARERS[field](a, b));
}
