import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { db } from '../../db/db';
import { makeIssue, makeSpace } from '../../test/factories';
import { byText, choose, cleanup, click, mount, q, qa, settle, typeInto } from '../../test/render';
import { setActiveOrg } from '../../utils/hostedOrg';
import type { StoryBox } from '../../utils/storybox';
import { StoryBoxBoard } from './StoryBoxBoard';

const hosted = vi.hoisted(() => ({ on: false }));
vi.mock('../../utils/edition', async importOriginal => ({ ...(await importOriginal<typeof import('../../utils/edition')>()), isHosted: () => hosted.on }));
const api = vi.hoisted(() => ({ getRoom: vi.fn(), roundAction: vi.fn(), confirmRound: vi.fn(), putVote: vi.fn() }));
vi.mock('../../services/storyVotesApi', () => api);

const spaces = [makeSpace({ id: 1, key: 'AAA', name: 'Alpha' })];
const issues = [
  makeIssue({ id: 10, spaceId: 1, key: 'AAA-1', title: 'First' }), makeIssue({ id: 11, spaceId: 1, key: 'AAA-2', title: 'Second', storyPoints: 3 }),
  makeIssue({ id: 12, spaceId: 1, key: 'AAA-3', title: 'Third' }), makeIssue({ id: 13, spaceId: 1, key: 'AAA-4', title: 'An epic', type: 'epic' }),
];
const baseBox = (over: Partial<StoryBox> = {}): StoryBox => ({ id: 'b1', name: 'Alpha estimate', scope: { type: 'space', spaceId: 1 }, status: 'open', scale: [0, 1, 2, 3, 5, 8], createdAt: '2026-11-20T00:00:00Z', createdBy: 'Asha', votingMinutes: 3, ...over });

/** Keeps the box in a variable like the page does, so what the board saves is what it shows next. */
let current = baseBox();
let rerender: (b: StoryBox) => void = () => undefined;
function show(box: StoryBox, canManage = true) {
  current = box;
  const render = (b: StoryBox) => <StoryBoxBoard box={b} issues={issues} spaces={spaces} canManage={canManage} onChange={next => { current = next; rerender(next); }} onDelete={vi.fn()} />;
  const handle = mount(render(box));
  rerender = next => handle.rerender(render(next));
}
const lane = (name: string) => q(`section[aria-label="${name}"]`)!;
const stage = () => q('section[aria-label="Voting stage"]')!;
const start = (key: string) => click(q(`button[aria-label="Start voting on ${key}"]`));
const hand = (value: number) => q<HTMLButtonElement>(`button[aria-label="Vote ${value}"]`)!;

beforeEach(async () => {
  hosted.on = false; setActiveOrg(null); localStorage.clear(); current = baseBox();
  Object.values(api).forEach(f => f.mockReset());
  await db.issues.clear(); await db.issues.bulkPut(issues);
});
afterEach(cleanup);

describe('the two lanes', () => {
  it('shows tickets without points as yet to be sized and tickets with points as sized, without epics', () => {
    show(baseBox());
    expect(lane('Yet to be sized').textContent).toContain('AAA-1');
    expect(lane('Yet to be sized').textContent).toContain('AAA-3');
    expect(lane('Yet to be sized').textContent).not.toContain('An epic');
    expect(lane('Sized').textContent).toContain('AAA-2');
    expect(lane('Sized').textContent).toContain('3 points');
  });

  it('searches both lanes', async () => {
    show(baseBox());
    await typeInto(q<HTMLInputElement>('input[aria-label="Search tickets"]'), 'second');
    expect(lane('Yet to be sized').textContent).not.toContain('AAA-1');
    expect(lane('Sized').textContent).toContain('AAA-2');
  });
});

describe('putting a ticket up for voting (local edition)', () => {
  it('shows the stage empty until a ticket is put up, with the minutes the box allows', () => {
    show(baseBox());
    expect(stage().textContent).toContain('Drag a ticket here');
    expect(stage().textContent).toContain('3 minutes');
  });

  it('starts with a button, shows the countdown, and takes the ticket out of the lanes', async () => {
    show(baseBox());
    await start('AAA-1');
    expect(q('[role="timer"]')!.textContent).toMatch(/0[23]:\d\d/);
    expect(stage().textContent).toContain('AAA-1');
    expect(lane('Yet to be sized').textContent).not.toContain('AAA-1');
    expect(q('button[aria-label="Start voting on AAA-3"]')).toBeNull(); // one ticket at a time
  });

  it('starts when a ticket is dropped on the stage, and ignores a drop that is not a ticket', async () => {
    show(baseBox());
    const drop = (value: string) => act(async () => {
      const ev = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'dataTransfer', { value: { getData: () => value } });
      stage().dispatchEvent(ev);
    });
    await drop('nonsense');
    expect(q('[role="timer"]')).toBeNull();
    await drop('12');
    expect(stage().textContent).toContain('AAA-3');
  });

  it('lets the person give a card, change it, and take it back until the time is up', async () => {
    show(baseBox());
    await start('AAA-1');
    expect(stage().textContent).toContain('Pick a card');
    await click(hand(5));
    expect(hand(5).getAttribute('aria-pressed')).toBe('true');
    expect(stage().textContent).toContain('You voted 5');
    await click(hand(8));
    expect(hand(5).getAttribute('aria-pressed')).toBe('false');
    expect(hand(8).getAttribute('aria-pressed')).toBe('true');
    await click(hand(8));
    expect(stage().textContent).toContain('Pick a card');
    expect(current.localVotes).toEqual({});
  });

  it('stops the cards when the time is up and waits for the reveal', async () => {
    show(baseBox({ localRounds: { 10: { endsAt: '2026-11-20T00:00:00Z', revealed: false } } }));
    expect(q('[role="timer"]')).toBeNull();
    expect(stage().textContent).toContain('Time is up');
    expect(stage().textContent).toContain('Waiting for the facilitator to reveal');
    expect(hand(5).disabled).toBe(true);
  });

  it('reveals the points, shows the average, confirms the final points, puts them on the ticket and moves it to Sized', async () => {
    show(baseBox());
    await start('AAA-1');
    await click(hand(5));
    expect(byText('td', 'Hidden')).toBeDefined(); // the participants table keeps points hidden
    await click(byText('button', 'Reveal points'));
    expect(stage().textContent).toContain('Average 5');
    expect(q<HTMLSelectElement>('select[aria-label="Final points"]')!.value).toBe('5'); // the suggested value is chosen
    expect(byText('td', 'Hidden')).toBeUndefined();
    await choose(q<HTMLSelectElement>('select[aria-label="Final points"]'), '8');
    await click(byText('button', 'Confirm'));
    await settle(700);
    expect((await db.issues.get(10))!.storyPoints).toBe(8);
    expect(current.localRounds![10].finalPoints).toBe(8);
    expect(stage().textContent).toContain('Drag a ticket here'); // the next one can be put up
  });

  it('asks everyone again after Vote again, with the old points cleared', async () => {
    show(baseBox());
    await start('AAA-1');
    await click(hand(5));
    await click(byText('button', 'Reveal points'));
    await click(byText('button', 'Vote again'));
    expect(current.localVotes).toEqual({});
    expect(stage().textContent).toContain('Pick a card');
    expect(q('[role="timer"]')).not.toBeNull();
  });

  it('keeps Confirm off until the final points are chosen when nobody voted', async () => {
    show(baseBox());
    await start('AAA-1');
    await click(byText('button', 'Reveal points'));
    expect(stage().textContent).toContain('Nobody voted.');
    expect(byText<HTMLButtonElement>('button', 'Confirm')!.disabled).toBe(true);
  });

  it('can put a sized ticket up again', async () => {
    show(baseBox());
    await start('AAA-2');
    expect(stage().textContent).toContain('AAA-2');
  });
});

describe('who may do what', () => {
  it('gives someone who is not running the box no way to start, reveal or confirm, only the hand', () => {
    show(baseBox({ localRounds: { 10: { endsAt: '2099-01-01T00:00:00Z', revealed: false } } }), false);
    expect(qa('button[aria-label^="Start voting"]')).toHaveLength(0);
    expect(byText('button', 'Reveal points')).toBeUndefined();
    expect(hand(5).disabled).toBe(false);
    expect(byText('button', 'Close the box')).toBeUndefined();
  });

  it('tells someone who is not running the box to wait, when nothing is up', () => {
    show(baseBox(), false);
    expect(stage().textContent).toContain('Waiting for the facilitator');
  });

  it('shows who is taking part and whether they voted, with the points hidden until the reveal', async () => {
    show(baseBox());
    await start('AAA-1');
    const table = q('section[aria-label="Participants"]')!;
    expect(table.textContent).toContain('0 of 1 have voted');
    expect(table.textContent).toContain('Waiting');
    await click(hand(3));
    expect(q('section[aria-label="Participants"]')!.textContent).toContain('1 of 1 have voted');
    expect(q('section[aria-label="Participants"]')!.textContent).toContain('Hidden');
  });

  it('has no stage and no way to start in a closed box', () => {
    show(baseBox({ status: 'closed' }));
    expect(stage()).toBeNull();
    expect(qa('button[aria-label^="Start voting"]')).toHaveLength(0);
    expect(document.body.textContent).toContain('This box is closed');
  });
});

describe('in the hosted edition', () => {
  const people = [{ userId: 'u1', name: 'Asha', role: 'owner', voted: true, votedAt: '2026-11-24T10:01:00Z' }, { userId: 'u2', name: 'Maya', role: 'member', voted: false, votedAt: null }];
  const reply = (over: object = {}) => ({ ok: true, data: { now: new Date().toISOString(), rounds: [{ ticketId: 10, phase: 'voting', endsAt: new Date(Date.now() + 120_000).toISOString(), finalPoints: null, voted: 1 }], votes: [{ ticketId: 10, userId: 'u1', name: 'Asha', points: 5, mine: true }], people, activeTicketId: 10, ...over } });
  beforeEach(() => { hosted.on = true; setActiveOrg('org-1', 'owner'); api.roundAction.mockResolvedValue({ ok: true, data: undefined }); api.putVote.mockResolvedValue({ ok: true, data: undefined }); });

  it('shows the round the server holds, your own card, and only who has voted, not what', async () => {
    api.getRoom.mockResolvedValue(reply());
    show(baseBox());
    await settle(40);
    expect(api.getRoom).toHaveBeenCalledWith('org-1', 'b1');
    expect(hand(5).getAttribute('aria-pressed')).toBe('true');
    const table = q('section[aria-label="Participants"]')!;
    expect(table.textContent).toContain('Asha');
    expect(table.textContent).toContain('Maya');
    expect(table.textContent).toContain('1 of 2 have voted');
    expect(table.textContent).toContain('Hidden');
    expect(table.textContent).toContain('Facilitator');
  });

  it('gives a vote and starts and reveals through the server, then reads the room again', async () => {
    api.getRoom.mockResolvedValue({ ok: true, data: { now: new Date().toISOString(), rounds: [], votes: [], people: [], activeTicketId: null } });
    show(baseBox());
    await settle(30);
    api.getRoom.mockResolvedValue(reply()); // what the server says once the round has started
    await start('AAA-1');
    expect(api.roundAction).toHaveBeenCalledWith('org-1', 'b1', 10, 'start');
    await settle(30);
    await click(hand(8));
    expect(api.putVote).toHaveBeenCalledWith('org-1', 'b1', 10, 8);
    await click(byText('button', 'Reveal points'));
    expect(api.roundAction).toHaveBeenLastCalledWith('org-1', 'b1', 10, 'reveal');
  });

  it('shows everyone\'s cards and points once the server has revealed them', async () => {
    api.getRoom.mockResolvedValue(reply({ rounds: [{ ticketId: 10, phase: 'revealed', endsAt: new Date().toISOString(), finalPoints: null, voted: 2 }], votes: [{ ticketId: 10, userId: 'u1', name: 'Asha', points: 5, mine: true }, { ticketId: 10, userId: 'u2', name: 'Maya', points: 8 }] }));
    show(baseBox());
    await settle(40);
    expect(q('section[aria-label="Participants"]')!.textContent).toContain('8');
    expect(stage().textContent).toContain('Average 6.5');
    expect(q<HTMLSelectElement>('select[aria-label="Final points"]')!.value).toBe('8'); // halfway goes up
  });

  it('confirms through the server and puts the points on the ticket', async () => {
    api.getRoom.mockResolvedValue(reply({ rounds: [{ ticketId: 10, phase: 'revealed', endsAt: new Date().toISOString(), finalPoints: null, voted: 1 }] }));
    api.confirmRound.mockResolvedValue({ ok: true, data: undefined });
    show(baseBox());
    await settle(40);
    await click(byText('button', 'Confirm'));
    await settle(700);
    expect(api.confirmRound).toHaveBeenCalledWith('org-1', 'b1', 10, 5);
    expect((await db.issues.get(10))!.storyPoints).toBe(5);
  });

  it('does not put points on the ticket when the server refuses to confirm, and says why', async () => {
    api.getRoom.mockResolvedValue(reply({ rounds: [{ ticketId: 10, phase: 'revealed', endsAt: new Date().toISOString(), finalPoints: null, voted: 1 }] }));
    api.confirmRound.mockResolvedValue({ ok: false, status: 403, message: 'You do not have access to this.' });
    show(baseBox());
    await settle(40);
    await click(byText('button', 'Confirm'));
    await settle(700);
    expect((await db.issues.get(10))!.storyPoints).toBeUndefined();
    expect(q('[role="alert"]')!.textContent).toContain('do not have access');
  });

  it('shows the server\'s reason when a vote is refused, such as the time being up', async () => {
    api.getRoom.mockResolvedValue(reply());
    api.putVote.mockResolvedValue({ ok: false, status: 409, message: 'Voting on this ticket has ended.' });
    show(baseBox());
    await settle(40);
    await click(hand(3));
    expect(q('[role="alert"]')!.textContent).toContain('has ended');
  });

  it('reads the room again every couple of seconds while the box is open', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    api.getRoom.mockResolvedValue(reply());
    show(baseBox());
    await vi.advanceTimersByTimeAsync(0);
    const first = api.getRoom.mock.calls.length;
    await vi.advanceTimersByTimeAsync(7_000);
    expect(api.getRoom.mock.calls.length).toBeGreaterThanOrEqual(first + 3);
    vi.useRealTimers();
  });
});
