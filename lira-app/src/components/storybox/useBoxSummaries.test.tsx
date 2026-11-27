import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, mount, q, settle } from '../../test/render';
import { setActiveOrg } from '../../utils/hostedOrg';
import { newBox, type StoryBox } from '../../utils/storybox';
import { useBoxSummaries } from './useBoxSummaries';

const hosted = vi.hoisted(() => ({ on: false }));
vi.mock('../../utils/edition', async importOriginal => ({ ...(await importOriginal<typeof import('../../utils/edition')>()), isHosted: () => hosted.on }));
const api = vi.hoisted(() => ({ getSummary: vi.fn() }));
vi.mock('../../services/storyVotesApi', () => api);

const box = (over: Partial<StoryBox> = {}): StoryBox => ({ ...newBox('b1', 'Box', { type: 'space', spaceId: 1 }, 'now', 'A', 5), ...over });
function Probe({ boxes }: { boxes: StoryBox[] }) {
  const sums = useBoxSummaries(boxes);
  return <p id="out">{[...sums].map(([id, s]) => `${id}:${s.sized}/${s.points}`).join(',')}</p>;
}

beforeEach(() => { hosted.on = false; setActiveOrg(null); api.getSummary.mockReset(); });
afterEach(cleanup);

describe('what the boxes have sized', () => {
  it('is read from the boxes in the local edition, without asking a server', () => {
    mount(<Probe boxes={[box({ localRounds: { 1: { endsAt: 'x', revealed: true, finalPoints: 5 } } })]} />);
    expect(q('#out')!.textContent).toBe('b1:1/5');
    expect(api.getSummary).not.toHaveBeenCalled();
  });

  it('is asked of the server in the hosted edition', async () => {
    hosted.on = true; setActiveOrg('org-1', 'owner');
    api.getSummary.mockResolvedValue({ ok: true, data: [{ boxId: 'b1', sized: 3, points: 13 }] });
    mount(<Probe boxes={[box()]} />);
    await settle(30);
    expect(api.getSummary).toHaveBeenCalledWith('org-1');
    expect(q('#out')!.textContent).toBe('b1:3/13');
  });

  it('keeps showing nothing when the server cannot be reached', async () => {
    hosted.on = true; setActiveOrg('org-1', 'owner');
    api.getSummary.mockResolvedValue({ ok: false, status: 0, message: 'offline' });
    mount(<Probe boxes={[box()]} />);
    await settle(30);
    expect(q('#out')!.textContent).toBe('');
  });
});
