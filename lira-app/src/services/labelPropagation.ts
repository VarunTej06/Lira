import { db } from '../db/db';
import { updateIssue } from '../hooks/useIssues';
import { inheritLabels, sameLabels } from '../utils/labels';

/** The labels a ticket has under this parent, or under none (see utils/labels.ts). */
export async function labelsUnder(ticket: { labels?: string[]; inheritedLabels?: string[] }, parentId: number | undefined) {
  const parent = parentId ? await db.issues.get(parentId) : undefined;
  return inheritLabels(ticket, parent?.labels ?? []);
}

/**
 * Brings the labels of everything under a ticket in step with it: its children, their children, and so on
 * (epic to tasks and bugs, task to subtasks and bugs). Only tickets whose labels really change are written.
 */
export async function propagateLabels(parentId: number): Promise<void> {
  const queue = [parentId];
  const seen = new Set<number>(); // a parent loop in damaged data must not run forever
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const parent = await db.issues.get(id);
    if (!parent) continue;
    for (const child of await db.issues.where('parentId').equals(id).toArray()) {
      if (child.id === undefined) continue;
      const next = inheritLabels(child, parent.labels ?? []);
      if (!sameLabels(child, next)) await updateIssue(child.id, next);
      queue.push(child.id);
    }
  }
}
