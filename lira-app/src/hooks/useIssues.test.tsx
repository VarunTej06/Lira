import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import { makeIssue } from '../test/factories';
import { cleanup, mount, q, settle } from '../test/render';
import { createIssue, deleteIssue, getNextIssueKey, moveIssue, updateIssue, useAllIssues, useChildIssues, useIssue, useIssuesBySpace } from './useIssues';

const hosted = vi.hoisted(() => ({ on: false }));
vi.mock('../utils/edition', async importOriginal => ({ ...(await importOriginal<typeof import('../utils/edition')>()), isHosted: () => hosted.on }));
const sync = vi.hoisted(() => ({ createIssueHosted: vi.fn(async () => 77) }));
vi.mock('../services/hostedSync', () => sync);
const disk = vi.hoisted(() => ({ triggerDiskSync: vi.fn() }));
vi.mock('../services/localDiskSync', () => disk);

const add = (over: object) => db.issues.add({ ...makeIssue(over), id: undefined } as never) as Promise<number>;
const { id: _x, ...blank } = makeIssue();

beforeEach(async () => { hosted.on = false; sync.createIssueHosted.mockClear(); disk.triggerDiskSync.mockClear(); await db.issues.clear(); });
afterEach(cleanup);

describe('reading tickets', () => {
  it('lists the tickets of one space in rank order, all of them, one by id, and the ones under a parent', async () => {
    const epic = await add({ spaceId: 1, key: 'A-1', rank: 3 });
    await add({ spaceId: 1, key: 'A-2', rank: 1, parentId: epic });
    await add({ spaceId: 1, key: 'A-3', rank: 2, parentId: epic });
    await add({ spaceId: 2, key: 'B-1', rank: 1 });
    function Probe() {
      const ofSpace = useIssuesBySpace(1); const everything = useAllIssues(); const one = useIssue(epic); const under = useChildIssues(epic);
      const none = useIssuesBySpace(undefined); const noOne = useIssue(undefined); const noChildren = useChildIssues(undefined);
      return <p id="out">{[ofSpace.map(i => i.key), everything.length, one?.key, under.map(i => i.key), none.length, noOne === undefined, noChildren.length].join('|')}</p>;
    }
    mount(<Probe />);
    await settle(120);
    expect(q('#out')!.textContent).toBe('A-2,A-3,A-1|4|A-1|A-2,A-3|0|true|0');
  });
});

describe('changing tickets', () => {
  it('changes only the given fields, stamps the time, and asks for the data folder to be saved', async () => {
    const id = await add({ key: 'A-1', title: 'Old', priority: 'low', updatedAt: new Date(2020, 0, 1) });
    await updateIssue(id, { title: 'New' });
    const t = (await db.issues.get(id))!;
    expect(t).toMatchObject({ title: 'New', priority: 'low' });
    expect(t.updatedAt.getTime()).toBeGreaterThan(new Date(2020, 0, 1).getTime());
    expect(disk.triggerDiskSync).toHaveBeenCalledTimes(1);
  });

  it('moves a ticket to a status and a place in it', async () => {
    const id = await add({ key: 'A-1', status: 'todo', rank: 5 });
    await moveIssue(id, 'done', 9);
    expect(await db.issues.get(id)).toMatchObject({ status: 'done', rank: 9 });
    expect(disk.triggerDiskSync).toHaveBeenCalledTimes(1);
  });

  it('makes a ticket here in the local edition, putting it in this month\'s sprint when it has none', async () => {
    const id = await createIssue({ ...blank, key: 'A-1', sprint: undefined } as never);
    expect((await db.issues.get(id))!.sprint).toMatch(/^\d{4}-\d{2}$/);
    const own = await createIssue({ ...blank, key: 'A-2', sprint: '2026-03' } as never);
    expect((await db.issues.get(own))!.sprint).toBe('2026-03');
    expect(sync.createIssueHosted).not.toHaveBeenCalled();
  });

  it('makes a ticket through the server in the hosted edition and gives back the number the server gave', async () => {
    hosted.on = true;
    expect(await createIssue({ ...blank, key: 'A-1' } as never)).toBe(77);
    expect(sync.createIssueHosted).toHaveBeenCalledWith(expect.objectContaining({ key: 'A-1', sprint: expect.stringMatching(/^\d{4}-\d{2}$/) }));
    expect(await db.issues.count()).toBe(0);
  });

  it('deletes a ticket with everything under it, however deep, and nothing else', async () => {
    const epic = await add({ key: 'A-1' });
    const task = await add({ key: 'A-2', parentId: epic });
    await add({ key: 'A-3', parentId: task });
    await add({ key: 'A-4' });
    await deleteIssue(epic);
    expect((await db.issues.toArray()).map(i => i.key)).toEqual(['A-4']);
  });
});

describe('the next key of a space', () => {
  it('is one more than the highest number used, even when some were deleted', async () => {
    expect(await getNextIssueKey('LIRA')).toBe('LIRA-1');
    await add({ key: 'LIRA-1' }); await add({ key: 'LIRA-7' }); await add({ key: 'LIRA-3' });
    expect(await getNextIssueKey('LIRA')).toBe('LIRA-8');
  });
  it('counts only the space it was asked about, and not one whose key starts the same way', async () => {
    await add({ key: 'LIRA-4' }); await add({ key: 'LIRAX-90' }); await add({ key: 'OTHER-12' });
    expect(await getNextIssueKey('LIRA')).toBe('LIRA-5');
  });
  it('ignores a key that has no number', async () => {
    await add({ key: 'LIRA-x' });
    expect(await getNextIssueKey('LIRA')).toBe('LIRA-1');
  });
});
