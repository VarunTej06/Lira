import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect } from 'react';
import { cleanup, mount, q, settle } from '../../test/render';
import { setActiveOrg } from '../../utils/hostedOrg';
import type { StoryBox } from '../../utils/storybox';
import { useStoryRoom } from './useStoryRoom';

const hosted = vi.hoisted(() => ({ on: false }));
vi.mock('../../utils/edition', async importOriginal => ({ ...(await importOriginal<typeof import('../../utils/edition')>()), isHosted: () => hosted.on }));
const api = vi.hoisted(() => ({ getRoom: vi.fn(), roundAction: vi.fn(), confirmRound: vi.fn(), putVote: vi.fn() }));
vi.mock('../../services/storyVotesApi', () => api);

const box = (over: Partial<StoryBox> = {}): StoryBox => ({ id: 'b1', name: 'Box', scope: { type: 'space', spaceId: 1 }, status: 'open', scale: [1, 2, 3], createdAt: 'now', createdBy: 'A', votingMinutes: 2, ...over });

let latest: ReturnType<typeof useStoryRoom>;
let changed: StoryBox | null = null;
function Probe({ b }: { b: StoryBox }) {
  const room = useStoryRoom(b, next => { changed = next; });
  useEffect(() => { latest = room; });
  return <p id="state">{room.room.activeTicketId ?? 'none'}|{room.room.offsetMs}|{room.problem}</p>;
}
const text = () => q('#state')!.textContent;

beforeEach(() => { hosted.on = false; changed = null; setActiveOrg(null); Object.values(api).forEach(f => f.mockReset()); vi.useRealTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('the room in the local edition', () => {
  it('keeps rounds in the box: starts one, refuses a second ticket with a reason, and never calls the server', async () => {
    mount(<Probe b={box()} />);
    await act(async () => { expect(await latest.start(7)).toBe(true); });
    expect(changed!.localRounds![7]).toBeDefined();
    cleanup(); mount(<Probe b={changed!} />);
    expect(text()).toBe('7|0|');
    await act(async () => { expect(await latest.start(8)).toBe(false); });
    expect(text()).toContain('Another ticket is being voted on');
    expect(Object.values(api).every(f => f.mock.calls.length === 0)).toBe(true);
  });

  it('gives points while voting is open, reveals, and confirms only after the reveal', async () => {
    mount(<Probe b={box()} />);
    await act(async () => { await latest.start(7); });
    const started = changed!;
    cleanup(); mount(<Probe b={started} />);
    await act(async () => { await latest.vote(7, 2); });
    expect(changed!.localVotes).toEqual({ '7': 2 });
    await act(async () => { await latest.finalise(7, 2); });
    expect(changed!.localRounds![7].finalPoints).toBeUndefined(); // not revealed, so nothing is confirmed
    await act(async () => { await latest.reveal(7); });
    expect(changed!.localRounds![7].revealed).toBe(true);
  });
});

describe('the room in the hosted edition', () => {
  const reply = (now: string) => ({ ok: true, data: { now, rounds: [{ ticketId: 7, phase: 'voting', endsAt: '2026-11-24T10:05:00Z', finalPoints: null, voted: 1 }], votes: [], people: [], activeTicketId: 7 } });
  beforeEach(() => { hosted.on = true; setActiveOrg('org-1', 'owner'); });

  it('reads the room from the server and works out how far its clock is from this device', async () => {
    api.getRoom.mockResolvedValue(reply(new Date(Date.now() + 60_000).toISOString()));
    mount(<Probe b={box()} />);
    await settle(30);
    expect(api.getRoom).toHaveBeenCalledWith('org-1', 'b1');
    const [active, offset] = text()!.split('|');
    expect(active).toBe('7');
    expect(Number(offset)).toBeGreaterThan(55_000);
    expect(Number(offset)).toBeLessThan(65_000);
  });

  it('sends each action to the server and reads the room again, and shows why it was refused', async () => {
    api.getRoom.mockResolvedValue(reply(new Date().toISOString()));
    api.roundAction.mockResolvedValue({ ok: true, data: undefined });
    api.confirmRound.mockResolvedValue({ ok: false, status: 409, message: 'Reveal the points before confirming.' });
    api.putVote.mockResolvedValue({ ok: true, data: undefined });
    mount(<Probe b={box()} />);
    await settle(30);
    const reads = api.getRoom.mock.calls.length;
    await act(async () => { await latest.start(7); await latest.reveal(7); await latest.revote(7); await latest.vote(7, 3); });
    expect(api.roundAction.mock.calls.map(c => c[3])).toEqual(['start', 'reveal', 'revote']);
    expect(api.putVote).toHaveBeenCalledWith('org-1', 'b1', 7, 3);
    expect(api.getRoom.mock.calls.length).toBeGreaterThanOrEqual(reads + 4);
    await act(async () => { expect(await latest.finalise(7, 3)).toBe(false); });
    expect(text()).toContain('Reveal the points before confirming.');
    expect(changed).toBeNull(); // nothing is kept in the box itself
  });

  it('reads less often once the box is closed', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    api.getRoom.mockResolvedValue(reply(new Date().toISOString()));
    mount(<Probe b={box({ status: 'closed' })} />);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(api.getRoom).toHaveBeenCalledTimes(1);
  });
});
