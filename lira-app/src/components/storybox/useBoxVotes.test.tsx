import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { cleanup, mount, q, qa, settle } from '../../test/render';
import { setActiveOrg } from '../../utils/hostedOrg';
import type { StoryBox } from '../../utils/storybox';
import { useBoxVotes } from './useBoxVotes';

const hosted = vi.hoisted(() => ({ on: false }));
vi.mock('../../utils/edition', async importOriginal => ({ ...(await importOriginal<typeof import('../../utils/edition')>()), isHosted: () => hosted.on }));
const api = vi.hoisted(() => ({ listVotes: vi.fn(), putVote: vi.fn() }));
vi.mock('../../services/storyVotesApi', () => api);

const box = (over: Partial<StoryBox> = {}): StoryBox => ({ id: 'b1', name: 'Box', scope: { type: 'space', spaceId: 1 }, status: 'open', scale: [1, 2, 3], createdAt: 'now', createdBy: 'A', ...over });

let saved: Record<string, number> | null = null;
function Probe({ b }: { b: StoryBox }) {
  const { votes, vote, problem } = useBoxVotes(b, v => { saved = v; });
  return <div><ul>{votes.map(v => <li key={`${v.ticketId}${v.userId}`}>{v.ticketId}:{v.name}:{v.points}</li>)}</ul><p id="problem">{problem}</p>
    <button type="button" id="give" onClick={() => { void vote(7, 5); }}>give</button><button type="button" id="take" onClick={() => { void vote(7, null); }}>take</button></div>;
}

beforeEach(() => { saved = null; hosted.on = false; setActiveOrg(null); Object.values(api).forEach(f => f.mockReset()); vi.useRealTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('points in a local story box', () => {
  it('shows the points kept in the box, gives a point by saving it into the box, and takes it back by removing it', async () => {
    mount(<Probe b={box({ localVotes: { '7': 3, '8': 1 } })} />);
    expect(qa('li').map(l => l.textContent)).toEqual(['7:You:3', '8:You:1']);
    await act(async () => { q<HTMLButtonElement>('#give')!.click(); });
    expect(saved).toEqual({ '7': 5, '8': 1 });
    await act(async () => { q<HTMLButtonElement>('#take')!.click(); });
    expect(saved).toEqual({ '8': 1 });
    expect(api.listVotes).not.toHaveBeenCalled(); // nothing goes to a server
  });
});

describe('points in a hosted story box', () => {
  beforeEach(() => { hosted.on = true; setActiveOrg('org-1', 'owner'); api.listVotes.mockResolvedValue({ ok: true, data: [{ ticketId: 7, userId: 'u2', name: 'Maya', points: 8 }] }); });

  it('reads everyone\'s points from the server and does not keep any in the box', async () => {
    mount(<Probe b={box()} />);
    await settle(30);
    expect(api.listVotes).toHaveBeenCalledWith('org-1', 'b1');
    expect(qa('li').map(l => l.textContent)).toEqual(['7:Maya:8']);
  });

  it('gives and takes back through the server, and reads the points again each time', async () => {
    api.putVote.mockResolvedValue({ ok: true, data: undefined });
    mount(<Probe b={box()} />);
    await settle(30);
    await act(async () => { q<HTMLButtonElement>('#give')!.click(); });
    await settle(30);
    expect(api.putVote).toHaveBeenLastCalledWith('org-1', 'b1', 7, 5);
    await act(async () => { q<HTMLButtonElement>('#take')!.click(); });
    await settle(30);
    expect(api.putVote).toHaveBeenLastCalledWith('org-1', 'b1', 7, null);
    expect(api.listVotes.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(saved).toBeNull();
  });

  it('shows why a point was refused', async () => {
    api.putVote.mockResolvedValue({ ok: false, status: 409, message: 'This story box is closed.' });
    mount(<Probe b={box()} />);
    await settle(30);
    await act(async () => { q<HTMLButtonElement>('#give')!.click(); });
    await settle(30);
    expect(q('#problem')!.textContent).toBe('This story box is closed.');
  });

  it('asks again every few seconds while the box is open, and stops when it is closed', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    mount(<Probe b={box()} />);
    await vi.advanceTimersByTimeAsync(0);
    const first = api.listVotes.mock.calls.length;
    await vi.advanceTimersByTimeAsync(21_000);
    expect(api.listVotes.mock.calls.length).toBeGreaterThanOrEqual(first + 2);
    cleanup();
    api.listVotes.mockClear();
    mount(<Probe b={box({ status: 'closed' })} />);
    await vi.advanceTimersByTimeAsync(31_000);
    expect(api.listVotes).toHaveBeenCalledTimes(1);
  });
});
