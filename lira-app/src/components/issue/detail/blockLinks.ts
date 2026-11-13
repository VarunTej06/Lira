import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../db/db';
import { updateIssue } from '../../../hooks/useIssues';
import type { LinkedIssue } from '../../../types/issue';
import { linkChanges, reverseLink, withLink, withoutLink } from '../../../utils/ticketLinks';
import { withBlockers } from './ticketDraft';

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

/** Writes or removes the other end of one link on the ticket it points to. */
async function setOtherEnd(ticketId: number, link: LinkedIssue, on: boolean) {
  const reverse = reverseLink(link.linkType);
  if (!reverse || link.linkType === 'blocked_by') return; // "is blocked by" is the Blocked switch: syncBlockLinks keeps its other end
  const other = await db.issues.get(link.issueId);
  if (!other) return;
  if (reverse === 'blocked_by') {
    // this ticket blocks the other one, so the other's Blocked switch follows
    const rest = (other.blocked ? other.blockedByIds ?? [] : []).filter(id => id !== ticketId);
    const next = withBlockers(other, on ? [...rest, ticketId] : rest);
    await updateIssue(link.issueId, { blocked: next.blocked, blockedByIds: next.blockedByIds, blockedAt: next.blockedAt, linkedIssues: next.linkedIssues });
    return;
  }
  await updateIssue(link.issueId, { linkedIssues: on ? withLink(other.linkedIssues, ticketId, reverse) : withoutLink(other.linkedIssues, ticketId, reverse) });
}

/**
 * When a ticket's links change, keep the other end of each in step: "relates to" on both, "blocks" as "is blocked by",
 * "duplicates" as "is duplicated by". `before` and `after` are the ticket's links before and after the change.
 */
export async function syncLinks(ticketId: number, before: LinkedIssue[] | undefined, after: LinkedIssue[] | undefined) {
  const { added, removed } = linkChanges(before, after);
  for (const link of removed) await setOtherEnd(ticketId, link, false);
  for (const link of added) await setOtherEnd(ticketId, link, true);
}
