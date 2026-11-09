import type { Issue } from '../types/issue';

/** Whether `other` may be the parent of `issue`: a subtask goes under a task or bug, a task under an epic, a bug under an epic or task. Epics have no parent. */
export function canBeParent(issue: Pick<Issue, 'id' | 'type'>, other: Pick<Issue, 'id' | 'type'>): boolean {
  if (other.id === issue.id) return false;
  if (issue.type === 'subtask') return other.type === 'task' || other.type === 'bug';
  if (issue.type === 'task') return other.type === 'epic';
  if (issue.type === 'bug') return other.type === 'epic' || other.type === 'task';
  return false;
}
