import { describe, expect, it } from 'vitest';
import { makeIssue } from '../test/factories';
import { newBox, type StoryBox } from './storybox';
import {
  clockText, lanes, localConfirm, localReveal, localRevote, localRoom, localStart, localVote, minutesOf, msLeft, phaseNow, type Round,
} from './storyRound';

const NOW = Date.parse('2026-11-24T10:00:00Z');
const box = (over: Partial<StoryBox> = {}): StoryBox => ({ ...newBox('b', 'Box', { type: 'space', spaceId: 1 }, 'now', 'A', 3), ...over });

describe('the clock of a round', () => {
  it('counts down to the end, never below zero, and allows for the server being ahead', () => {
    const end = '2026-11-24T10:05:00Z';
    expect(msLeft(end, NOW, 0)).toBe(300_000);
    expect(msLeft(end, NOW, 60_000)).toBe(240_000);
    expect(msLeft(end, NOW + 400_000, 0)).toBe(0);
  });
  it('shows minutes and seconds, rounding up so it never reads 00:00 with time left', () => {
    expect(clockText(272_000)).toBe('04:32');
    expect(clockText(1)).toBe('00:01');
    expect(clockText(0)).toBe('00:00');
    expect(clockText(600_000)).toBe('10:00');
  });
  it('turns a voting round to time-up on its own when the clock runs out, and leaves the other phases alone', () => {
    const r: Round = { ticketId: 1, phase: 'voting', endsAt: '2026-11-24T10:01:00Z', finalPoints: null, voted: 0 };
    expect(phaseNow(r, NOW, 0)).toBe('voting');
    expect(phaseNow(r, NOW + 61_000, 0)).toBe('timeup');
    expect(phaseNow({ ...r, phase: 'revealed' }, NOW + 61_000, 0)).toBe('revealed');
  });
});

describe('the minutes of a box', () => {
  it('uses what the maker chose, and 5 when it is missing or outside 1 to 10', () => {
    expect(minutesOf(box({ votingMinutes: 10 }))).toBe(10);
    for (const bad of [undefined, 0, 11, 2.5]) expect(minutesOf(box({ votingMinutes: bad })), String(bad)).toBe(5);
  });
});

describe('the two lanes', () => {
  it('puts tickets without points to be sized, those with points as sized, leaves the one on the stage out, and skips epics and other spaces', () => {
    const issues = [makeIssue({ id: 1, spaceId: 1 }), makeIssue({ id: 2, spaceId: 1, storyPoints: 5 }), makeIssue({ id: 3, spaceId: 1 }), makeIssue({ id: 4, spaceId: 1, type: 'epic' }), makeIssue({ id: 5, spaceId: 2 })];
    const l = lanes(issues, box(), 3);
    expect(l.pending.map(i => i.id)).toEqual([1]);
    expect(l.sized.map(i => i.id)).toEqual([2]);
  });
});

describe('a round in the local edition', () => {
  it('starts with the minutes of the box, one ticket at a time, and clears old points on that ticket', () => {
    const started = localStart(box({ localVotes: { '7': 3 } }), 7, NOW)!;
    expect(started.localRounds).toEqual({ 7: { endsAt: '2026-11-24T10:03:00.000Z', revealed: false } });
    expect(started.localVotes).toEqual({});
    expect(localStart(started, 8, NOW)).toBeNull();
    expect(localStart(started, 7, NOW)).not.toBeNull(); // the same one again is a restart
  });
  it('takes points only while voting is open, and lets them be changed and taken back', () => {
    const b = localStart(box(), 7, NOW)!;
    const one = localVote(b, 7, 5, NOW + 1000);
    expect(one.localVotes).toEqual({ '7': 5 });
    expect(localVote(one, 7, 8, NOW + 2000).localVotes).toEqual({ '7': 8 });
    expect(localVote(one, 7, null, NOW + 2000).localVotes).toEqual({});
    expect(localVote(one, 7, 8, NOW + 200_000)).toBe(one); // time is up
    expect(localVote(box(), 9, 8, NOW)).toEqual(box()); // no round for that ticket
    expect(localVote(localReveal(b, 7), 7, 8, NOW + 1000).localVotes).toEqual(b.localVotes); // revealed
  });
  it('reveals, then confirms only a revealed round, and a revote clears the points and the reveal', () => {
    const b = localVote(localStart(box(), 7, NOW)!, 7, 5, NOW);
    expect(localConfirm(b, 7, 5)).toBe(b); // not revealed yet
    const revealed = localReveal(b, 7);
    expect(localRoom(revealed, NOW, 'You').rounds[0].phase).toBe('revealed');
    const done = localConfirm(revealed, 7, 5);
    expect(localRoom(done, NOW, 'You')).toMatchObject({ activeTicketId: null, rounds: [{ phase: 'confirmed', finalPoints: 5 }], people: [] });
    const again = localRevote(revealed, 7, NOW + 5000);
    expect(again.localVotes).toEqual({});
    expect(again.localRounds![7].revealed).toBe(false);
  });
  it('describes the room: the active ticket, the one person and whether they voted, and time-up after the clock runs out', () => {
    const b = localVote(localStart(box(), 7, NOW)!, 7, 5, NOW);
    expect(localRoom(b, NOW, 'Asha')).toMatchObject({ activeTicketId: 7, people: [{ name: 'Asha', voted: true }], votes: [{ ticketId: 7, name: 'Asha', points: 5 }] });
    expect(localRoom(b, NOW + 181_000, 'Asha').rounds[0].phase).toBe('timeup');
    expect(localRoom(box(), NOW, 'A')).toMatchObject({ rounds: [], activeTicketId: null });
  });
});
