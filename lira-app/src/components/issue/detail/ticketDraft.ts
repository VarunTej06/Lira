import type { ActivityEntry, Issue, IssueType, LinkedIssue } from '../../../types/issue';
import { withLink, withoutLink, type LinkType } from '../../../utils/ticketLinks';
import { ISSUE_TYPE_CONFIG } from '../../../types/issue';
import { v4 as uuidv4 } from 'uuid';
import { currentUser } from '../../../utils/currentUser';
import { STATUS_BANNER, STATUS_BUTTON_STYLE, safeArr } from './issueOptions';
import { canBeParent } from '../../../utils/hierarchy';
import { PALETTE } from '../../../theme/palette';

/** The ticket fields that are edited in the popup and written together when "Save changes" is pressed. */
export const DRAFT_FIELDS = [
  'status', 'priority', 'assignee', 'assigneeInitials', 'labels', 'dueDate', 'startDate', 'storyPoints', 'type',
  'parentId', 'epicId', 'epicLink', 'attachments', 'subtasks', 'activity', 'timeEstimate', 'blocked', 'blockedByIds', 'blockedAt', 'linkedIssues',
] as const satisfies readonly (keyof Issue)[];

/** Has anything been changed since the ticket was opened? */
export function isDirty(issue: Issue | null, local: Issue | null, titleVal: string, descVal: string, detachChildren: boolean): boolean {
  if (!issue || !local) return false;
  return titleVal.trim() !== issue.title ||
    descVal !== (issue.description ?? '') ||
    detachChildren ||
    DRAFT_FIELDS.some(k => JSON.stringify(local[k] ?? null) !== JSON.stringify(issue[k] ?? null));
}

/** The ticket with its Blocked switch turned on (with the tickets it waits on) or off (no ids). Only the draft changes. */
export function withBlockers(prev: Issue, ids: number[]): Issue {
  const unique = [...new Set(ids)];
  const others = safeArr(prev.linkedIssues).filter(l => l.linkType !== 'blocked_by');
  if (unique.length === 0) return { ...prev, blocked: false, blockedByIds: [], blockedAt: undefined, linkedIssues: others };
  return { ...prev, blocked: true, blockedByIds: unique, blockedAt: prev.blocked && prev.blockedAt ? prev.blockedAt : new Date().toISOString(), linkedIssues: [...others, ...unique.map(id => ({ id: uuidv4(), issueId: id, linkType: 'blocked_by' as const }))] };
}

const blockerIds = (t: Issue) => (t.blocked ? t.blockedByIds ?? [] : []);

/** The draft with these links added. "Is blocked by" is the Blocked switch, so it goes through the same door. */
export function withLinks(prev: Issue, picks: { issueId: number; linkType: LinkType }[]): Issue {
  return picks.reduce<Issue>((t, p) => (p.issueId === t.id ? t
    : p.linkType === 'blocked_by' ? withBlockers(t, [...blockerIds(t), p.issueId])
    : { ...t, linkedIssues: withLink(t.linkedIssues, p.issueId, p.linkType) }), prev);
}

/** The draft without one link. Removing an "is blocked by" link unblocks the ticket from that one. */
export function withoutLinkTo(prev: Issue, link: Pick<LinkedIssue, 'issueId' | 'linkType'>): Issue {
  if (link.linkType === 'blocked_by') return withBlockers(prev, blockerIds(prev).filter(id => id !== link.issueId));
  return { ...prev, linkedIssues: withoutLink(prev.linkedIssues, link.issueId, link.linkType) };
}

/** The fields changed by switching the type, including the history entry. (Whether to detach children is decided by the caller.) */
export function typeChangeFields(local: Issue, newType: IssueType): Partial<Issue> {
  const oldTypeCfg = ISSUE_TYPE_CONFIG[local.type]?.label || local.type;
  const newTypeCfg = ISSUE_TYPE_CONFIG[newType]?.label || newType;
  const changes: Partial<Issue> = { type: newType };

  // An epic is top level: it has no parents
  if (newType === 'epic') {
    changes.parentId = undefined;
    changes.epicId = undefined;
    changes.epicLink = undefined;
  }

  const activityEntry: ActivityEntry = {
    id: uuidv4(),
    type: 'field_change',
    author: currentUser().initials,
    authorInitials: currentUser().initials,
    description: `changed issue type from ${oldTypeCfg} to ${newTypeCfg}`,
    oldValue: oldTypeCfg,
    newValue: newTypeCfg,
    createdAt: new Date(),
  };
  changes.activity = [activityEntry, ...safeArr(local.activity)];
  return changes;
}

/** The parent fields for the chosen parent, or for no parent at all. */
export function parentFields(parent: Issue | undefined): Partial<Issue> {
  if (!parent) return { parentId: undefined, epicId: undefined, epicLink: undefined };
  return {
    parentId: parent.id,
    epicId: parent.type === 'epic' ? parent.id : (parent.epicId || undefined),
    epicLink: parent.title,
  };
}

/** Everything that is written when "Save changes" is pressed. */
export function savedFields(local: Issue, titleVal: string, descVal: string): Partial<Issue> {
  const changes: Partial<Issue> = { title: titleVal.trim(), description: descVal, updatedAt: new Date() };
  for (const k of DRAFT_FIELDS) (changes as Record<string, unknown>)[k] = local[k];
  return changes;
}

/** How many children there are, how many are done, and the percentage. */
export function childStats(children: Issue[]) {
  const childCount = children.length;
  const doneChildCount = children.filter(c => c.status === 'done').length;
  return { childCount, doneChildCount, childProgress: childCount > 0 ? Math.round((doneChildCount / childCount) * 100) : 0 };
}

/** The tickets around this one: the ones blocking it, the ones waiting on it, and those that could be its parent. */
export function relatedTickets(local: Issue | null, everyIssue: Issue[], spaceIssues: Issue[]) {
  const blockers = (local?.blocked ? local.blockedByIds ?? [] : []).map(id => everyIssue.find(i => i.id === id)).filter((i): i is Issue => !!i);
  const blocking = local?.id ? everyIssue.filter(i => i.blocked && i.blockedByIds?.includes(local.id!)) : [];
  const eligibleParents = local?.id ? spaceIssues.filter(i => canBeParent(local, i)) : [];
  return { blockers, blocking, eligibleParents };
}

/** The colours and type icon for the status and type of the draft. */
export function lookFor(local: Issue) {
  return {
    bannerColor: STATUS_BANNER[local.status] ?? PALETTE.border,
    statusStyle: STATUS_BUTTON_STYLE[local.status] ?? STATUS_BUTTON_STYLE.todo,
    typeConfig: ISSUE_TYPE_CONFIG[local.type] ?? ISSUE_TYPE_CONFIG.task,
  };
}
