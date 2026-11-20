import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import { makeIssue, makeSpace } from '../test/factories';
import { setActiveOrg } from '../utils/hostedOrg';
import { createIssueHosted, createSpaceHosted, flushHostedSync, initHostedSync, resetHostedSync } from './hostedSync';

const api = vi.hoisted(() => ({
  listSpaces: vi.fn(), listTickets: vi.fn(), createSpaceOnServer: vi.fn(), createTicketOnServer: vi.fn(),
  updateSpaceOnServer: vi.fn(), updateTicketOnServer: vi.fn(), deleteSpaceOnServer: vi.fn(), deleteTicketOnServer: vi.fn(),
}));
vi.mock('./workspaceApi', () => api);

const ok = <T,>(data: T) => ({ ok: true as const, data });
const refused = (status: number, message = 'no') => ({ ok: false as const, status, message });
const serverSpace = makeSpace({ id: 1, key: 'LIRA', version: 1 });
const serverTicket = makeIssue({ id: 10, spaceId: 1, key: 'LIRA-1', title: 'From the server', version: 1 });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); // the fake database schedules with other timers, which must keep running
  Object.values(api).forEach(f => f.mockReset());
  await db.issues.clear(); await db.spaces.clear(); // clearing fires the delete hooks once they are registered, so reset the queue after
  resetHostedSync();
  setActiveOrg('org-1');
  api.listSpaces.mockResolvedValue(ok([serverSpace]));
  api.listTickets.mockResolvedValue(ok([serverTicket]));
});
afterEach(() => { vi.useRealTimers(); setActiveOrg(null); });

/** Lets the delay pass, then waits for the send that the timer started. */
const delayPasses = async () => { await vi.advanceTimersByTimeAsync(400); await flushHostedSync(); };

describe('loading from the server', () => {
  it('replaces whatever the cache held with the server\'s spaces and tickets, and seeds nothing', async () => {
    await db.issues.add(makeIssue({ spaceId: 9, title: 'Stale browser copy' }));
    await initHostedSync();
    expect((await db.issues.toArray()).map(i => i.title)).toEqual(['From the server']);
    expect((await db.spaces.toArray()).map(s => s.key)).toEqual(['LIRA']);
    expect(api.listTickets).toHaveBeenCalledWith('org-1', 1);
  });

  it('does not send the server\'s own data back to it', async () => {
    await initHostedSync();
    await flushHostedSync();
    for (const name of ['updateTicketOnServer', 'updateSpaceOnServer', 'deleteTicketOnServer', 'deleteSpaceOnServer'] as const) expect(api[name]).not.toHaveBeenCalled();
  });

  it('fails clearly when the server does not answer, and when nobody is signed in to an organisation', async () => {
    api.listSpaces.mockResolvedValue(refused(0, 'Could not reach the server.'));
    await expect(initHostedSync()).rejects.toThrow('Could not reach the server.');
    setActiveOrg(null);
    await expect(initHostedSync()).rejects.toThrow(/organisation/);
  });
});

describe('sending changes', () => {
  beforeEach(async () => { await initHostedSync(); });

  it('sends a changed ticket with the version it was based on, then keeps the version the server returns', async () => {
    api.updateTicketOnServer.mockResolvedValue(ok({ ...serverTicket, version: 2 }));
    await db.issues.update(10, { status: 'done' });
    await delayPasses();
    expect(api.updateTicketOnServer).toHaveBeenCalledTimes(1);
    const [org, id, version, body] = api.updateTicketOnServer.mock.calls[0];
    expect([org, id, version, body.status]).toEqual(['org-1', 10, 1, 'done']);
    expect((await db.issues.get(10))!.version).toBe(2);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(api.updateTicketOnServer).toHaveBeenCalledTimes(1);
  });

  it('sends one request for several quick changes to the same ticket', async () => {
    api.updateTicketOnServer.mockResolvedValue(ok({ ...serverTicket, version: 2 }));
    await db.issues.update(10, { status: 'inprogress' });
    await db.issues.update(10, { title: 'Renamed' });
    await delayPasses();
    expect(api.updateTicketOnServer).toHaveBeenCalledTimes(1);
    expect(api.updateTicketOnServer.mock.calls[0][3]).toMatchObject({ status: 'inprogress', title: 'Renamed' });
  });

  it('sends a changed space', async () => {
    api.updateSpaceOnServer.mockResolvedValue(ok({ ...serverSpace, version: 2 }));
    await db.spaces.update(1, { name: 'New name' });
    await delayPasses();
    expect(api.updateSpaceOnServer).toHaveBeenCalledWith('org-1', 1, 1, expect.objectContaining({ name: 'New name' }));
    expect((await db.spaces.get(1))!.version).toBe(2);
  });

  it('takes the server\'s copy when someone else changed the ticket first', async () => {
    api.updateTicketOnServer.mockResolvedValue(refused(409));
    api.listTickets.mockResolvedValue(ok([{ ...serverTicket, title: 'Their change', version: 5 }]));
    await db.issues.update(10, { title: 'My change' });
    await delayPasses();
    const row = (await db.issues.get(10))!;
    expect([row.title, row.version]).toEqual(['Their change', 5]);
  });

  it('keeps a change that could not be sent and tries again', async () => {
    api.updateTicketOnServer.mockResolvedValueOnce(refused(0)).mockResolvedValue(ok({ ...serverTicket, version: 2 }));
    await db.issues.update(10, { status: 'done' });
    await vi.advanceTimersByTimeAsync(400);
    await vi.waitFor(() => expect(api.updateTicketOnServer).toHaveBeenCalledTimes(1));
    expect((await db.issues.get(10))!.version).toBe(1);
    await vi.advanceTimersByTimeAsync(6000);
    await vi.waitFor(() => expect(api.updateTicketOnServer).toHaveBeenCalledTimes(2));
    await vi.waitFor(async () => expect((await db.issues.get(10))!.version).toBe(2));
  });

  it('sends a delete with the version, and does not mind that the server no longer has it', async () => {
    api.deleteTicketOnServer.mockResolvedValue(refused(404));
    await db.issues.delete(10);
    await delayPasses();
    expect(api.deleteTicketOnServer).toHaveBeenCalledWith('org-1', 10, 1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(api.deleteTicketOnServer).toHaveBeenCalledTimes(1);
  });

  it('does not update a ticket that was deleted straight after it was changed', async () => {
    api.deleteTicketOnServer.mockResolvedValue(ok(undefined));
    await db.issues.update(10, { status: 'done' });
    await db.issues.delete(10);
    await flushHostedSync();
    expect(api.updateTicketOnServer).not.toHaveBeenCalled();
    expect(api.deleteTicketOnServer).toHaveBeenCalledTimes(1);
  });

  it('flush sends at once, without waiting for the delay', async () => {
    api.updateTicketOnServer.mockResolvedValue(ok({ ...serverTicket, version: 2 }));
    await db.issues.update(10, { status: 'done' });
    await flushHostedSync();
    expect(api.updateTicketOnServer).toHaveBeenCalledTimes(1);
  });
});

describe('creating', () => {
  it('creates a ticket on the server first and keeps the server\'s row, number and key in the cache', async () => {
    api.createTicketOnServer.mockResolvedValue(ok({ ...serverTicket, id: 77, key: 'LIRA-9', version: 1 }));
    const { id: _id, ...draft } = makeIssue({ spaceId: 1, key: 'LIRA-LOCAL' });
    const id = await createIssueHosted(draft);
    expect(id).toBe(77);
    expect((await db.issues.get(77))!.key).toBe('LIRA-9');
    expect(api.createTicketOnServer).toHaveBeenCalledWith('org-1', 1, expect.objectContaining({ spaceId: 1 }));
  });

  it('creates a space the same way', async () => {
    api.createSpaceOnServer.mockResolvedValue(ok({ ...serverSpace, id: 5 }));
    const { id: _id, ...draft } = makeSpace({ key: 'NEW' });
    expect(await createSpaceHosted(draft)).toBe(5);
    expect((await db.spaces.get(5))!.key).toBe('LIRA');
  });

  it('stores nothing and says why when the server refuses', async () => {
    api.createTicketOnServer.mockResolvedValue(refused(403, 'You do not have access to this.'));
    const { id: _id, ...draft } = makeIssue({ spaceId: 1 });
    await expect(createIssueHosted(draft)).rejects.toThrow('You do not have access to this.');
    expect(await db.issues.count()).toBe(0);
  });

  it('does not queue the row it just stored for sending', async () => {
    api.createTicketOnServer.mockResolvedValue(ok({ ...serverTicket, id: 78, version: 1 }));
    await initHostedSync();
    const { id: _id, ...draft } = makeIssue({ spaceId: 1 });
    await createIssueHosted(draft);
    await flushHostedSync();
    expect(api.updateTicketOnServer).not.toHaveBeenCalled();
  });
});
