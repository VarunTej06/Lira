import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import { makeIssue, makeSpace } from '../test/factories';
import { cleanup, mount, q, settle } from '../test/render';
import { createSpace, deleteSpace, updateSpace, useSpaces } from './useSpaces';

const hosted = vi.hoisted(() => ({ on: false }));
vi.mock('../utils/edition', async importOriginal => ({ ...(await importOriginal<typeof import('../utils/edition')>()), isHosted: () => hosted.on }));
const sync = vi.hoisted(() => ({ createSpaceHosted: vi.fn(async () => 42) }));
vi.mock('../services/hostedSync', () => sync);
const disk = vi.hoisted(() => ({ triggerDiskSync: vi.fn() }));
vi.mock('../services/localDiskSync', () => disk);

const base = (over: object = {}) => { const { id: _id, ...rest } = makeSpace({ name: 'Alpha', key: 'ALP', createdAt: new Date(2026, 0, 2), ...over }); return rest; };

beforeEach(async () => { hosted.on = false; sync.createSpaceHosted.mockClear(); disk.triggerDiskSync.mockClear(); await db.spaces.clear(); await db.issues.clear(); });
afterEach(cleanup);

describe('the list of spaces', () => {
  it('lists the spaces oldest first', async () => {
    await db.spaces.bulkAdd([{ ...base({ name: 'Newer', key: 'NEW', createdAt: new Date(2026, 5, 1) }) }, { ...base({ name: 'Older', key: 'OLD', createdAt: new Date(2026, 1, 1) }) }]);
    function Probe() { return <p id="out">{(useSpaces() ?? []).map(s => s.name).join(',')}</p>; }
    mount(<Probe />);
    await settle(60);
    expect(q('#out')!.textContent).toBe('Older,Newer');
  });
});

describe('making, changing and deleting a space', () => {
  it('makes a space on this computer in the local edition, and asks for it to be saved to the data folder', async () => {
    const id = await createSpace(base());
    expect((await db.spaces.get(id))!.name).toBe('Alpha');
    expect(sync.createSpaceHosted).not.toHaveBeenCalled();
    expect(disk.triggerDiskSync).toHaveBeenCalledTimes(1);
  });

  it('makes it through the server in the hosted edition, and gives back the number the server gave', async () => {
    hosted.on = true;
    expect(await createSpace(base())).toBe(42);
    expect(sync.createSpaceHosted).toHaveBeenCalledTimes(1);
    expect(await db.spaces.count()).toBe(0); // the cache is filled by the sync, not here
    expect(disk.triggerDiskSync).toHaveBeenCalledTimes(1);
  });

  it('changes only what it is told to and stamps the time', async () => {
    const id = await createSpace(base());
    const before = (await db.spaces.get(id))!;
    await updateSpace(id, { name: 'Renamed' });
    const after = (await db.spaces.get(id))!;
    expect(after).toMatchObject({ name: 'Renamed', key: 'ALP' });
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
    expect(disk.triggerDiskSync).toHaveBeenCalledTimes(2);
  });

  it('deletes a space with every ticket in it, and no ticket of another space', async () => {
    const a = await createSpace(base());
    const b = await createSpace(base({ name: 'Other', key: 'OTH' }));
    await db.issues.bulkAdd([makeIssue({ id: undefined, spaceId: a, key: 'ALP-1' }), makeIssue({ id: undefined, spaceId: a, key: 'ALP-2' }), makeIssue({ id: undefined, spaceId: b, key: 'OTH-1' })]);
    await deleteSpace(a);
    expect(await db.spaces.get(a)).toBeUndefined();
    expect((await db.issues.toArray()).map(i => i.key)).toEqual(['OTH-1']);
    expect(await db.spaces.get(b)).toBeDefined();
  });
});
