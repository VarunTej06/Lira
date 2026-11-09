import type { Issue, IssueType } from '../../../types/issue';
import { createIssue, getNextIssueKey, updateIssue } from '../../../hooks/useIssues';
import { buildNewIssue } from '../../../utils/newIssue';
import { db } from '../../../db/db';
import { syncBlockLinks } from './blockLinks';
import { savedFields } from './ticketDraft';

/**
 * Writes the edited ticket: detaches its children first when it became a subtask, saves the fields, then keeps the other end of
 * every block link in step (the blocking ticket "blocks" this one).
 */
export async function commitTicket(opts: { local: Issue; original: Issue | null; title: string; description: string; detachChildren: boolean; children: Issue[] }): Promise<void> {
  const { local, original, title, description, detachChildren, children } = opts;
  const changes = savedFields(local, title, description);
  if (detachChildren) {
    for (const child of children) {
      if (child.id) await updateIssue(child.id, { parentId: undefined, epicId: undefined, epicLink: undefined });
    }
  }
  await updateIssue(local.id!, changes);
  await syncBlockLinks(local.id!, original?.blocked ? original.blockedByIds ?? [] : [], local.blocked ? local.blockedByIds ?? [] : []);
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
}
