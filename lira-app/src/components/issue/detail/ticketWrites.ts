import type { Issue, IssueType } from '../../../types/issue';
import { createIssue, getNextIssueKey, updateIssue } from '../../../hooks/useIssues';
import { buildNewIssue } from '../../../utils/newIssue';
import { db } from '../../../db/db';
import { syncBlockLinks, syncLinks } from './blockLinks';
import { parentFields, savedFields } from './ticketDraft';
import { labelsUnder, propagateLabels } from '../../../services/labelPropagation';

/**
 * Writes the edited ticket: detaches its children first when it became a subtask, saves the fields (with the labels of its parent),
 * keeps the other end of every link in step, then passes its labels down to everything under it.
 */
export async function commitTicket(opts: { local: Issue; original: Issue | null; title: string; description: string; detachChildren: boolean; children: Issue[] }): Promise<void> {
  const { local, original, title, description, detachChildren, children } = opts;
  const changes = { ...savedFields(local, title, description), ...(await labelsUnder(local, local.parentId)) };
  if (detachChildren) {
    for (const child of children) {
      if (child.id) await updateIssue(child.id, { parentId: undefined, epicId: undefined, epicLink: undefined });
    }
  }
  await updateIssue(local.id!, changes);
  await syncBlockLinks(local.id!, original?.blocked ? original.blockedByIds ?? [] : [], local.blocked ? local.blockedByIds ?? [] : []);
  await syncLinks(local.id!, original?.linkedIssues, local.linkedIssues);
  await propagateLabels(local.id!);
}

/** Creates a To Do child of the ticket, in its space, with the same assignee. Does nothing when the space is gone. */
export async function createChildOf(parent: Issue, title: string, type: IssueType): Promise<void> {
  if (!parent.id || !parent.spaceId) return;
  const space = await db.spaces.get(parent.spaceId);
  if (!space) return;
  await createIssue(buildNewIssue({
    spaceId: parent.spaceId, key: await getNextIssueKey(space.key), parentId: parent.id, spaceIssues: [parent],
    title, description: '', type, status: 'todo', priority: 'medium', dueDate: '', labels: '', attachments: [],
    assignee: { name: parent.assignee, initials: parent.assigneeInitials },
  }));
  await propagateLabels(parent.id);
}

/** Puts existing tickets under this one as its children (they leave any parent they had) and gives them its labels. */
export async function adoptChildren(parent: Issue, children: Issue[]): Promise<void> {
  if (!parent.id) return;
  for (const child of children) {
    if (child.id && child.id !== parent.id) await updateIssue(child.id, parentFields(parent));
  }
  await propagateLabels(parent.id);
}
