import { describe, expect, it } from 'vitest';
import type { Issue } from '../../../types/issue';
import { DRAFT_FIELDS, childStats, isDirty, lookFor, parentFields, relatedTickets, savedFields, typeChangeFields, withBlockers, withLinks, withoutLinkTo } from './ticketDraft';

const ticket = (over: Partial<Issue> = {}): Issue => ({
  id: 10, spaceId: 1, key: 'LIRA-10', title: 'Board', description: 'Text', type: 'task', status: 'todo', priority: 'medium',
  reporter: 'A', reporterInitials: 'A', labels: [], subtasks: [], comments: [], activity: [], attachments: [], linkedIssues: [],
  rank: 1, watchers: [], createdAt: new Date(2026, 10, 1), updatedAt: new Date(2026, 10, 2), ...over,
} as Issue);

describe('isDirty', () => {
  const t = ticket();
  it('is false without a ticket or a draft', () => {
    expect(isDirty(null, t, 'x', 'y', false)).toBe(false);
    expect(isDirty(t, null, 'x', 'y', false)).toBe(false);
  });
  it('is false for an untouched draft, even with extra spaces around the title', () => {
    expect(isDirty(t, { ...t }, 'Board', 'Text', false)).toBe(false);
    expect(isDirty(t, { ...t }, '  Board ', 'Text', false)).toBe(false);
  });
  it('is true for a changed title, description, or a pending detach', () => {
    expect(isDirty(t, { ...t }, 'Other', 'Text', false)).toBe(true);
    expect(isDirty(t, { ...t }, 'Board', 'Other', false)).toBe(true);
    expect(isDirty(t, { ...t }, 'Board', 'Text', true)).toBe(true);
  });
  it('treats a missing description as empty', () => {
    const none = ticket({ description: undefined as unknown as string });
    expect(isDirty(none, { ...none }, 'Board', '', false)).toBe(false);
  });
  it.each(DRAFT_FIELDS)('is true when the draft field "%s" differs', field => {
    const changed = { ...t, [field]: field === 'labels' ? ['x'] : field === 'storyPoints' ? 8 : `changed-${field}` } as Issue;
    expect(isDirty(t, changed, 'Board', 'Text', false)).toBe(true);
  });
  it('compares fields by content, not by identity', () => {
    const a = ticket({ labels: ['a', 'b'] });
    expect(isDirty(a, { ...a, labels: ['a', 'b'] }, 'Board', 'Text', false)).toBe(false);
  });
  it('does not count comments as draft changes (they are saved at once)', () => {
    expect(isDirty(t, { ...t, comments: [{ id: 'c' } as never] }, 'Board', 'Text', false)).toBe(false);
  });
});

describe('withBlockers', () => {
  it('switches Blocked on with the unique blockers, and links each one', () => {
    const r = withBlockers(ticket(), [3, 4, 3]);
    expect(r).toMatchObject({ blocked: true, blockedByIds: [3, 4] });
    expect(r.blockedAt).toBeTruthy();
    expect(r.linkedIssues.filter(l => l.linkType === 'blocked_by').map(l => l.issueId)).toEqual([3, 4]);
  });
  it('keeps the original time when it was already blocked', () => {
    const first = withBlockers(ticket(), [3]);
    expect(withBlockers(first, [3, 4]).blockedAt).toBe(first.blockedAt);
  });
  it('replaces the old blocker links and keeps other links', () => {
    const base = ticket({ linkedIssues: [{ id: 'k', issueId: 9, linkType: 'relates_to' }, { id: 'b', issueId: 3, linkType: 'blocked_by' }] });
    const r = withBlockers(base, [5]);
    expect(r.linkedIssues.map(l => [l.issueId, l.linkType])).toEqual([[9, 'relates_to'], [5, 'blocked_by']]);
  });
  it('switches off with no blockers', () => {
    const r = withBlockers(withBlockers(ticket(), [3]), []);
    expect(r).toMatchObject({ blocked: false, blockedByIds: [], blockedAt: undefined });
    expect(r.linkedIssues).toEqual([]);
  });
});

describe('typeChangeFields', () => {
  it('sets the type and adds a history entry in front', () => {
    const old = { id: 'old', type: 'comment', description: 'x' } as never;
    const c = typeChangeFields(ticket({ activity: [old] }), 'bug');
    expect(c.type).toBe('bug');
    expect(c.activity).toHaveLength(2);
    expect(c.activity![0]).toMatchObject({ type: 'field_change', oldValue: 'Task', newValue: 'Bug', description: 'changed issue type from Task to Bug' });
    expect(c.activity![1]).toBe(old);
  });
  it('an epic loses its parent fields', () => {
    expect(typeChangeFields(ticket({ parentId: 4 }), 'epic')).toMatchObject({ parentId: undefined, epicId: undefined, epicLink: undefined });
    expect('parentId' in typeChangeFields(ticket({ parentId: 4 }), 'bug')).toBe(false);
  });
});

describe('parentFields', () => {
  it('clears everything when there is no parent', () => {
    expect(parentFields(undefined)).toEqual({ parentId: undefined, epicId: undefined, epicLink: undefined });
  });
  it('an epic parent is its own epic', () => {
    expect(parentFields(ticket({ id: 5, type: 'epic', title: 'Big' }))).toEqual({ parentId: 5, epicId: 5, epicLink: 'Big' });
  });
  it('a task parent passes its epic along (or none)', () => {
    expect(parentFields(ticket({ id: 6, epicId: 5, title: 'T' }))).toEqual({ parentId: 6, epicId: 5, epicLink: 'T' });
    expect(parentFields(ticket({ id: 7, title: 'U' })).epicId).toBeUndefined();
  });
});

describe('savedFields', () => {
  it('trims the title, keeps the description, stamps the time, and copies every draft field', () => {
    const local = ticket({ priority: 'high', labels: ['a'] });
    const c = savedFields(local, '  New  ', 'Desc');
    expect(c).toMatchObject({ title: 'New', description: 'Desc', priority: 'high', labels: ['a'] });
    expect(c.updatedAt).toBeInstanceOf(Date);
    for (const f of DRAFT_FIELDS) expect(f in c).toBe(true);
    expect('comments' in c).toBe(false);
  });
});

describe('childStats', () => {
  it('counts and rounds the percentage', () => {
    const kids = [{ status: 'done' }, { status: 'todo' }, { status: 'todo' }] as Issue[];
    expect(childStats(kids)).toEqual({ childCount: 3, doneChildCount: 1, childProgress: 33 });
  });
  it('is zero without children', () => expect(childStats([])).toEqual({ childCount: 0, doneChildCount: 0, childProgress: 0 }));
});

describe('relatedTickets', () => {
  const all = [{ id: 3, key: 'A' }, { id: 4, key: 'B', blocked: true, blockedByIds: [10] }, { id: 5, key: 'C', type: 'epic' }] as Issue[];
  it('finds what blocks and what waits', () => {
    const r = relatedTickets(ticket({ blocked: true, blockedByIds: [3, 99] }), all, []);
    expect(r.blockers.map(i => i.key)).toEqual(['A']);
    expect(r.blocking.map(i => i.key)).toEqual(['B']);
  });
  it('lists no blockers when the ticket is not blocked', () => {
    expect(relatedTickets(ticket({ blocked: false, blockedByIds: [3] }), all, []).blockers).toEqual([]);
  });
  it('is empty without a ticket', () => {
    expect(relatedTickets(null, all, all)).toEqual({ blockers: [], blocking: [], eligibleParents: [] });
  });
  it('offers epics as parents for a task', () => {
    const r = relatedTickets(ticket(), [], all);
    expect(r.eligibleParents.map(i => i.key)).toContain('C');
  });
});

describe('lookFor', () => {
  it('gives the banner, button style and type for the status and type', () => {
    const r = lookFor(ticket({ status: 'done', type: 'bug' }));
    expect(r.bannerColor).toBeTruthy();
    expect(r.statusStyle).toBeTruthy();
    expect(r.typeConfig.label).toBe('Bug');
  });
  it('falls back for an unknown status or type', () => {
    const r = lookFor(ticket({ status: 'weird', type: 'odd' as never }));
    expect(r.bannerColor).toBeTruthy();
    expect(r.typeConfig.label).toBe('Task');
  });
});

describe('withLinks / withoutLinkTo', () => {
  const base = { id: 1, linkedIssues: [], blocked: false } as unknown as Issue;
  const pairs = (t: Issue) => (t.linkedIssues ?? []).map(l => [l.issueId, l.linkType]);

  it('adds each link once and never links a ticket to itself', () => {
    const t = withLinks(base, [{ issueId: 2, linkType: 'relates_to' }, { issueId: 2, linkType: 'relates_to' }, { issueId: 1, linkType: 'blocks' }, { issueId: 3, linkType: 'duplicates' }]);
    expect(pairs(t)).toEqual([[2, 'relates_to'], [3, 'duplicates']]);
    expect(base.linkedIssues).toEqual([]); // the ticket it was given is not changed
  });
  it('"is blocked by" goes through the Blocked switch: several blockers add up', () => {
    const t = withLinks(base, [{ issueId: 2, linkType: 'blocked_by' }, { issueId: 3, linkType: 'blocked_by' }]);
    expect(t).toMatchObject({ blocked: true, blockedByIds: [2, 3] });
    expect(pairs(t)).toEqual([[2, 'blocked_by'], [3, 'blocked_by']]);
  });
  it('removing one blocker keeps the ticket blocked by the other; removing the last unblocks it', () => {
    const two = withLinks(base, [{ issueId: 2, linkType: 'blocked_by' }, { issueId: 3, linkType: 'blocked_by' }, { issueId: 4, linkType: 'relates_to' }]);
    const one = withoutLinkTo(two, { issueId: 2, linkType: 'blocked_by' });
    expect(one).toMatchObject({ blocked: true, blockedByIds: [3] });
    const none = withoutLinkTo(one, { issueId: 3, linkType: 'blocked_by' });
    expect(none).toMatchObject({ blocked: false, blockedByIds: [] });
    expect(pairs(none)).toEqual([[4, 'relates_to']]); // other links are kept
  });
  it('removes an ordinary link without touching the Blocked switch', () => {
    const t = withLinks(base, [{ issueId: 2, linkType: 'blocked_by' }, { issueId: 4, linkType: 'relates_to' }]);
    expect(withoutLinkTo(t, { issueId: 4, linkType: 'relates_to' })).toMatchObject({ blocked: true, blockedByIds: [2] });
  });
});
