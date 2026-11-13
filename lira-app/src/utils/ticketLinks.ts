import { v4 as uuidv4 } from 'uuid';
import type { Issue, LinkedIssue } from '../types/issue';

export type LinkType = LinkedIssue['linkType'];

/** How one ticket can be linked to another, in the words shown to people. */
export const LINK_LABEL: Record<LinkType, string> = {
  relates_to: 'relates to',
  blocks: 'blocks',
  blocked_by: 'is blocked by',
  duplicates: 'duplicates',
  duplicated_by: 'is duplicated by',
  cloned_by: 'is cloned by',
};

/** The relations offered when linking a ticket. ("is duplicated by" and "is cloned by" only appear as the other end of a link.) */
export const LINK_CHOICES: readonly { value: LinkType; label: string }[] =
  (['relates_to', 'blocks', 'blocked_by', 'duplicates'] as const).map(value => ({ value, label: LINK_LABEL[value] }));

const REVERSE: Partial<Record<LinkType, LinkType>> = {
  relates_to: 'relates_to', blocks: 'blocked_by', blocked_by: 'blocks', duplicates: 'duplicated_by', duplicated_by: 'duplicates',
};

/** What the other ticket shows for this link: A "blocks" B means B "is blocked by" A. Nothing for a link that has no other end. */
export const reverseLink = (type: LinkType): LinkType | undefined => REVERSE[type];

const same = (l: LinkedIssue, issueId: number, type: LinkType) => l.issueId === issueId && l.linkType === type;

/** The links with one more; a link that is already there is not added twice. */
export function withLink(links: LinkedIssue[] | undefined, issueId: number, type: LinkType): LinkedIssue[] {
  const list = links ?? [];
  return list.some(l => same(l, issueId, type)) ? list : [...list, { id: uuidv4(), issueId, linkType: type }];
}

/** The links without the one to that ticket of that kind. */
export const withoutLink = (links: LinkedIssue[] | undefined, issueId: number, type: LinkType): LinkedIssue[] =>
  (links ?? []).filter(l => !same(l, issueId, type));

/** The links that were added and removed between two versions of a ticket (compared by ticket and kind, not by their own ids). */
export function linkChanges(before: LinkedIssue[] | undefined, after: LinkedIssue[] | undefined) {
  const a = before ?? [];
  const b = after ?? [];
  return {
    added: b.filter(l => !a.some(o => same(o, l.issueId, l.linkType))),
    removed: a.filter(l => !b.some(o => same(o, l.issueId, l.linkType))),
  };
}

/** The tickets that can still be linked to this one: every other ticket, of any type and status. */
export const linkCandidates = (issue: Pick<Issue, 'id'>, all: Issue[]): Issue[] => all.filter(i => i.id !== undefined && i.id !== issue.id);
