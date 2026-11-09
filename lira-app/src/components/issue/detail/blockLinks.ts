import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../db/db';
import { updateIssue } from '../../../hooks/useIssues';

/**
 * When a ticket's blockers change, keep the other end in step: each blocking ticket "blocks" this one.
 * `before` and `after` are the ids that blocked the ticket before and after the change.
 */
export async function syncBlockLinks(ticketId: number, before: number[], after: number[]) {
  const removed = before.filter(id => !after.includes(id));
  const added = after.filter(id => !before.includes(id));
  for (const id of removed) {
    const old = await db.issues.get(id);
    if (old) await updateIssue(id, { linkedIssues: (old.linkedIssues ?? []).filter(l => !(l.linkType === 'blocks' && l.issueId === ticketId)) });
  }
  for (const id of added) {
    const blocker = await db.issues.get(id);
    if (blocker && !(blocker.linkedIssues ?? []).some(l => l.linkType === 'blocks' && l.issueId === ticketId)) {
      await updateIssue(id, { linkedIssues: [...(blocker.linkedIssues ?? []), { id: uuidv4(), issueId: ticketId, linkType: 'blocks' as const }] });
    }
  }
}
