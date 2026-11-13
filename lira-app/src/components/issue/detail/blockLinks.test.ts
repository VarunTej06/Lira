import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db/db';
import { makeIssue } from '../../../test/factories';
import type { LinkedIssue } from '../../../types/issue';
import { syncBlockLinks, syncLinks } from './blockLinks';

beforeEach(async () => {
  vi.stubGlobal('fetch', async () => new Response('{}'));
  await db.issues.clear();
  await db.issues.bulkAdd([makeIssue({ id: 1 }), makeIssue({ id: 2 }), makeIssue({ id: 3 })]);
});
afterEach(() => vi.unstubAllGlobals());

const link = (issueId: number, linkType: LinkedIssue['linkType']): LinkedIssue => ({ id: `${issueId}-${linkType}`, issueId, linkType });
const linksOf = async (id: number) => ((await db.issues.get(id))!.linkedIssues ?? []).map(l => [l.issueId, l.linkType]);

describe('syncLinks: the other end of each link', () => {
  it('"relates to" appears on both tickets', async () => {
    await syncLinks(1, [], [link(2, 'relates_to')]);
    expect(await linksOf(2)).toEqual([[1, 'relates_to']]);
  });

  it('"duplicates" appears on the other ticket as "is duplicated by"', async () => {
    await syncLinks(1, [], [link(2, 'duplicates')]);
    expect(await linksOf(2)).toEqual([[1, 'duplicated_by']]);
  });

  it('"blocks" switches the other ticket to Blocked, waiting on this one', async () => {
    await syncLinks(1, [], [link(2, 'blocks')]);
    const other = (await db.issues.get(2))!;
    expect(other).toMatchObject({ blocked: true, blockedByIds: [1] });
    expect(typeof other.blockedAt).toBe('string');
    expect(await linksOf(2)).toEqual([[1, 'blocked_by']]);
  });

  it('a second blocker is added to the first, not put in its place', async () => {
    await syncLinks(1, [], [link(2, 'blocks')]);
    await syncLinks(3, [], [link(2, 'blocks')]);
    expect((await db.issues.get(2))!.blockedByIds).toEqual([1, 3]);
  });

  it('removing "blocks" takes this ticket off the other one; it is unblocked when nothing else blocks it', async () => {
    await syncLinks(1, [], [link(2, 'blocks')]);
    await syncLinks(3, [], [link(2, 'blocks')]);
    await syncLinks(1, [link(2, 'blocks')], []);
    expect((await db.issues.get(2))!).toMatchObject({ blocked: true, blockedByIds: [3] });
    await syncLinks(3, [link(2, 'blocks')], []);
    expect((await db.issues.get(2))!).toMatchObject({ blocked: false, blockedByIds: [] });
    expect(await linksOf(2)).toEqual([]);
  });

  it('removing a link removes only its own other end', async () => {
    await syncLinks(1, [], [link(2, 'relates_to'), link(2, 'duplicates')]);
    await syncLinks(1, [link(2, 'relates_to'), link(2, 'duplicates')], [link(2, 'duplicates')]);
    expect(await linksOf(2)).toEqual([[1, 'duplicated_by']]);
  });

  it('writes nothing when the links did not change, even if their ids did', async () => {
    const before = (await db.issues.get(2))!.updatedAt;
    await syncLinks(1, [{ id: 'a', issueId: 2, linkType: 'relates_to' }], [{ id: 'b', issueId: 2, linkType: 'relates_to' }]);
    expect((await db.issues.get(2))!.updatedAt).toEqual(before);
  });

  it('leaves "is blocked by" to the Blocked switch, and skips links to deleted tickets', async () => {
    await syncLinks(1, [], [link(2, 'blocked_by'), link(404, 'relates_to')]);
    expect(await linksOf(2)).toEqual([]);
  });

  it('does not add the same other end twice', async () => {
    await syncLinks(1, [], [link(2, 'relates_to')]);
    await syncLinks(1, [], [link(2, 'relates_to')]);
    expect(await linksOf(2)).toEqual([[1, 'relates_to']]);
  });
});

describe('syncBlockLinks: the Blocked switch', () => {
  it('each ticket that blocks this one shows "blocks", and loses it when it no longer does', async () => {
    await syncBlockLinks(1, [], [2, 3]);
    expect(await linksOf(2)).toEqual([[1, 'blocks']]);
    expect(await linksOf(3)).toEqual([[1, 'blocks']]);
    await syncBlockLinks(1, [2, 3], [3]);
    expect(await linksOf(2)).toEqual([]);
    expect(await linksOf(3)).toEqual([[1, 'blocks']]);
  });
});
