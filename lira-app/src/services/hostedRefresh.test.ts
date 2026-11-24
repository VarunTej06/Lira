import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import { makeIssue, makeSpace } from '../test/factories';
import { setActiveOrg } from '../utils/hostedOrg';
import { flushHostedSync, initHostedSync, resetHostedSync } from './hostedSync';
import { refreshFromServer } from './hostedRefresh';

const api = vi.hoisted(() => ({
  listSpaces: vi.fn(), listTickets: vi.fn(), createSpaceOnServer: vi.fn(), createTicketOnServer: vi.fn(),
  updateSpaceOnServer: vi.fn(), updateTicketOnServer: vi.fn(), deleteSpaceOnServer: vi.fn(), deleteTicketOnServer: vi.fn(),
}));
vi.mock('./workspaceApi', () => api);

const ok = <T,>(data: T) => ({ ok: true as const, data });
const space1 = makeSpace({ id: 1, key: 'AAA', version: 1 });
const space2 = makeSpace({ id: 2, key: 'BBB', version: 1 });
const t = (id: number, spaceId: number, over: object = {}) => makeIssue({ id, spaceId, key: `K-${id}`, title: `Ticket ${id}`, version: 1, ...over });
const titles = async () => (await db.issues.toArray()).map(i => i.title).sort();

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  Object.values(api).forEach(f => f.mockReset());
  await db.issues.clear(); await db.spaces.clear();
  resetHostedSync();
  setActiveOrg('org-1');
  api.listSpaces.mockResolvedValue(ok([space1, space2]));
  api.listTickets.mockImplementation(async (_org: string, id: number) => ok(id === 1 ? [t(10, 1), t(11, 1)] : [t(20, 2)]));
  await initHostedSync(); // fills the cache and registers the hooks
});
afterEach(() => { vi.useRealTimers(); setActiveOrg(null); });

describe('bringing other people\'s changes into the cache', () => {
  it('adds what was added, updates what is newer, and removes what was deleted, in the one space that changed', async () => {
    api.listTickets.mockClear();
    api.listTickets.mockResolvedValue(ok([t(10, 1, { title: 'Renamed', version: 2 }), t(12, 1, { title: 'New one' })])); // 11 is gone
    await refreshFromServer(1);
    expect(await titles()).toEqual(['New one', 'Renamed', 'Ticket 20']);
    expect(api.listTickets).toHaveBeenCalledTimes(1);
    expect(api.listTickets).toHaveBeenCalledWith('org-1', 1);
  });

  it('refreshes every space when none is named, and does not touch a row that is already as new', async () => {
    api.listTickets.mockClear();
    const put = vi.spyOn(db.issues, 'bulkPut');
    await refreshFromServer(null);
    expect(api.listTickets).toHaveBeenCalledTimes(2);
    expect(put.mock.calls.every(([rows]) => (rows as unknown[]).length === 0)).toBe(true);
    put.mockRestore();
  });

  it('keeps a change of this person\'s own that is still waiting to be sent, instead of overwriting it', async () => {
    api.updateTicketOnServer.mockResolvedValue(ok({ version: 2 }));
    await db.issues.update(10, { title: 'Mine, not sent yet' });
    api.listTickets.mockResolvedValue(ok([t(10, 1, { title: 'Theirs', version: 2 }), t(11, 1)]));
    await refreshFromServer(1);
    expect((await db.issues.get(10))!.title).toBe('Mine, not sent yet');
    await flushHostedSync();
    expect(api.updateTicketOnServer).toHaveBeenCalledTimes(1); // and it is still sent
  });

  it('drops a space, and its tickets, that this person can no longer see, and adds one they were just given', async () => {
    api.listSpaces.mockResolvedValue(ok([space1, makeSpace({ id: 3, key: 'CCC', version: 1 })]));
    api.listTickets.mockImplementation(async (_org: string, id: number) => ok(id === 1 ? [t(10, 1), t(11, 1)] : [t(30, 3)]));
    await refreshFromServer(null);
    expect((await db.spaces.toArray()).map(s => s.key).sort()).toEqual(['AAA', 'CCC']);
    expect(await titles()).toEqual(['Ticket 10', 'Ticket 11', 'Ticket 30']);
  });

  it('does not send what it brings in back to the server', async () => {
    api.listTickets.mockResolvedValue(ok([t(10, 1, { title: 'Renamed', version: 2 })]));
    await refreshFromServer(1);
    await flushHostedSync();
    for (const name of ['updateTicketOnServer', 'updateSpaceOnServer', 'deleteTicketOnServer', 'deleteSpaceOnServer'] as const) expect(api[name]).not.toHaveBeenCalled();
  });

  it('changes nothing when the server cannot be reached, or when nobody is signed in to an organisation', async () => {
    api.listSpaces.mockResolvedValue({ ok: false, status: 0, message: 'offline' });
    await refreshFromServer(null);
    expect(await titles()).toEqual(['Ticket 10', 'Ticket 11', 'Ticket 20']);
    api.listSpaces.mockResolvedValue(ok([space1, space2]));
    api.listTickets.mockResolvedValue({ ok: false, status: 500, message: 'x' });
    await refreshFromServer(null);
    expect(await titles()).toEqual(['Ticket 10', 'Ticket 11', 'Ticket 20']);
    setActiveOrg(null);
    api.listSpaces.mockClear();
    await refreshFromServer(null);
    expect(api.listSpaces).not.toHaveBeenCalled();
  });
});
