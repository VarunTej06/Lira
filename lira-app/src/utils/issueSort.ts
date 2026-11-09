import type { Issue } from '../types/issue';

export type SortField = 'key' | 'title' | 'type' | 'status' | 'priority' | 'assignee' | 'dueDate' | 'createdAt';

const PRIORITY_RANK: Record<string, number> = { highest: 5, high: 4, medium: 3, low: 2, lowest: 1 };
const time = (d?: Date | string) => (d ? new Date(d).getTime() : 0);

/** Compares two tickets for a column of the list. Priority puts the most urgent first when ascending. */
function compareIssues(field: SortField, a: Issue, b: Issue): number {
  switch (field) {
    case 'key': return a.key.localeCompare(b.key, undefined, { numeric: true });
    case 'title': return a.title.localeCompare(b.title);
    case 'type': return a.type.localeCompare(b.type);
    case 'status': return a.status.localeCompare(b.status);
    case 'priority': return (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
    case 'assignee': return (a.assignee || a.assigneeInitials || '').localeCompare(b.assignee || b.assigneeInitials || '');
    case 'dueDate': return time(a.dueDate) - time(b.dueDate);
    case 'createdAt': return time(a.createdAt) - time(b.createdAt);
  }
}

export function sortIssues(issues: Issue[], field: SortField, ascending: boolean): Issue[] {
  return [...issues].sort((a, b) => (ascending ? 1 : -1) * compareIssues(field, a, b));
}
