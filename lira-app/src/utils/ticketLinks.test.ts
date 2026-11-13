import { describe, expect, it } from 'vitest';
import type { Issue, LinkedIssue } from '../types/issue';
import { LINK_CHOICES, LINK_LABEL, linkCandidates, linkChanges, reverseLink, withLink, withoutLink } from './ticketLinks';

const link = (issueId: number, linkType: LinkedIssue['linkType'], id = `${issueId}-${linkType}`): LinkedIssue => ({ id, issueId, linkType });

describe('ticket links', () => {
  it('offers the four relations a person can choose, in plain words', () => {
    expect(LINK_CHOICES.map(c => c.label)).toEqual(['relates to', 'blocks', 'is blocked by', 'duplicates']);
    expect(LINK_LABEL.duplicated_by).toBe('is duplicated by');
  });

  it('knows the other end of each link', () => {
    expect(reverseLink('relates_to')).toBe('relates_to');
    expect(reverseLink('blocks')).toBe('blocked_by');
    expect(reverseLink('blocked_by')).toBe('blocks');
    expect(reverseLink('duplicates')).toBe('duplicated_by');
    expect(reverseLink('duplicated_by')).toBe('duplicates');
    expect(reverseLink('cloned_by')).toBeUndefined();
  });

  it('every relation that can be chosen has an other end, and reversing twice comes back', () => {
    for (const { value } of LINK_CHOICES) expect(reverseLink(reverseLink(value)!)).toBe(value);
  });

  it('adds a link once', () => {
    const one = withLink(undefined, 7, 'relates_to');
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({ issueId: 7, linkType: 'relates_to' });
    expect(withLink(one, 7, 'relates_to')).toBe(one);
    expect(withLink(one, 7, 'blocks')).toHaveLength(2); // the same ticket can be linked in another way
    expect(withLink(one, 8, 'relates_to')).toHaveLength(2);
  });

  it('removes only the link to that ticket of that kind', () => {
    const links = [link(7, 'relates_to'), link(7, 'blocks'), link(8, 'relates_to')];
    expect(withoutLink(links, 7, 'relates_to')).toEqual([links[1], links[2]]);
    expect(withoutLink(undefined, 7, 'relates_to')).toEqual([]);
  });

  it('finds what was added and removed, whatever ids the links carry', () => {
    const before = [link(1, 'relates_to', 'a'), link(2, 'blocks', 'b')];
    const after = [link(1, 'relates_to', 'other-id'), link(3, 'duplicates', 'c')];
    const { added, removed } = linkChanges(before, after);
    expect(added.map(l => [l.issueId, l.linkType])).toEqual([[3, 'duplicates']]);
    expect(removed.map(l => [l.issueId, l.linkType])).toEqual([[2, 'blocks']]);
    expect(linkChanges(undefined, undefined)).toEqual({ added: [], removed: [] });
  });

  it('lets any other saved ticket be linked, whatever its type or status', () => {
    const all = [{ id: 1, status: 'done', type: 'epic' }, { id: 2, status: 'backlog', type: 'bug' }, { status: 'todo', type: 'task' }] as Issue[];
    expect(linkCandidates({ id: 1 }, all).map(i => i.id)).toEqual([2]);
  });
});
