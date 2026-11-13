import type { Issue, IssueType } from '../../types/issue';
import type { Space } from '../../types/space';
import { currentSprintKey, getSprintDefs, shiftSprint, sprintIncludesSpace } from '../../utils/sprintUtils';

/**
 * Hierarchy: an epic is top level (no parent); a task or bug may sit under an epic; a subtask must sit under a task or bug.
 * Returns the tickets that can be the parent of a new ticket of this type.
 */
export function parentCandidates(type: IssueType, issues: Issue[]): Issue[] {
  if (type === 'subtask') return issues.filter(i => i.type === 'task' || i.type === 'bug');
  if (type === 'task' || type === 'bug') return issues.filter(i => i.type === 'epic');
  return [];
}

/** The first line of the parent list: what to do, or why there is nothing to pick. */
export function parentPlaceholder(type: IssueType, space: Space | undefined, candidateCount: number): string {
  if (!space) return 'Select a space first…';
  if (candidateCount === 0) return `No ${type === 'subtask' ? 'tasks' : 'epics'} in ${space.name} yet`;
  return type === 'subtask' ? 'Select the parent task…' : 'No epic (standalone)';
}

/** The sprints offered: two before and three after the current one, every defined sprint, and the one the dialog was opened for. */
export function sprintChoices(defaultSprint?: string): string[] {
  return Array.from(new Set([
    ...[-2, -1, 0, 1, 2, 3].map(d => shiftSprint(currentSprintKey(), d)),
    ...Object.keys(getSprintDefs()),
    ...(defaultSprint ? [defaultSprint] : []),
  ])).sort();
}

/** A sprint only takes tickets from the spaces that work in it. */
export const sprintsOpenTo = (choices: string[], spaceId: number | undefined): string[] =>
  (spaceId ? choices.filter(k => sprintIncludesSpace(k, spaceId)) : choices);

/** The sprint that is really used: the one chosen if it is open, else the current one, else the first open one. */
export function effectiveSprint(chosen: string, open: string[]): string {
  if (open.includes(chosen)) return chosen;
  return open.includes(currentSprintKey()) ? currentSprintKey() : open[0] ?? chosen;
}

/** What is missing before the ticket can be saved, or an empty string when it is complete. */
export function missingForTicket({ title, hasSpace, type, parentId }: { title: string; hasSpace: boolean; type: IssueType; parentId: number | undefined }): string {
  if (!title.trim()) return 'Title is required';
  if (!hasSpace) return 'Please choose a space for this ticket';
  if (type === 'subtask' && !parentId) return 'Choose the task this subtask belongs to';
  return '';
}

/** Adds a label to the comma-separated list typed so far, once a trailing comma or space is tidied away. */
export const appendLabel = (labels: string, label: string): string => (labels.trim() ? `${labels.replace(/[,\s]+$/, '')}, ${label}` : label);
