import { describe, expect, it } from 'vitest';
import { makeIssue, makeSpace } from '../test/factories';
import { DEFAULT_SCALE, groupBoxes, localVotesOf, newBox, scopeLabel, sprintsOf, statsOf, suggestedPoints, ticketsInScope, votesFor, type StoryBox, type Vote } from './storybox';

const v = (ticketId: number, points: number, name = 'A'): Vote => ({ ticketId, userId: name, name, points });

describe('which tickets a story box is about', () => {
  const issues = [makeIssue({ id: 1, spaceId: 1, sprint: '2026-11' }), makeIssue({ id: 2, spaceId: 2, sprint: '2026-11' }), makeIssue({ id: 3, spaceId: 1, sprint: '2026-12' }), makeIssue({ id: 4, spaceId: 1, type: 'epic', sprint: '2026-11' }), makeIssue({ id: 5, spaceId: 1 })];
  it('takes every ticket of a space, without its epics', () => {
    expect(ticketsInScope(issues, { type: 'space', spaceId: 1 }).map(i => i.id)).toEqual([1, 3, 5]);
  });
  it('takes the tickets of a sprint from every space, without epics', () => {
    expect(ticketsInScope(issues, { type: 'sprint', sprintKey: '2026-11' }).map(i => i.id)).toEqual([1, 2]);
    expect(ticketsInScope(issues, { type: 'sprint', sprintKey: '2030-01' })).toEqual([]);
  });
  it('lists the sprints in use, newest first, once each', () => {
    expect(sprintsOf(issues)).toEqual(['2026-12', '2026-11']);
  });
});

describe('what the points add up to', () => {
  it('says nothing when nobody has voted', () => {
    expect(statsOf([])).toEqual({ count: 0, average: null, median: null, min: null, max: null });
    expect(suggestedPoints([], DEFAULT_SCALE)).toBeNull();
  });
  it('gives the count, average (one decimal), median, lowest and highest', () => {
    expect(statsOf([v(1, 3), v(1, 5), v(1, 8)])).toEqual({ count: 3, average: 5.3, median: 5, min: 3, max: 8 });
    expect(statsOf([v(1, 2), v(1, 3), v(1, 5), v(1, 13)]).median).toBe(4);
  });
  it('suggests the point on the scale nearest to the median, going up when halfway', () => {
    expect(suggestedPoints([v(1, 3), v(1, 5), v(1, 8)], DEFAULT_SCALE)).toBe(5);
    expect(suggestedPoints([v(1, 2), v(1, 3), v(1, 5), v(1, 13)], DEFAULT_SCALE)).toBe(5); // median 4 is as near 3 as 5
    expect(suggestedPoints([v(1, 10)], DEFAULT_SCALE)).toBe(8);
    expect(suggestedPoints([v(1, 99)], DEFAULT_SCALE)).toBe(21);
    expect(suggestedPoints([v(1, 4)], [])).toBeNull();
    expect(suggestedPoints([v(1, 4)], [8, 2])).toBe(2); // the scale need not be in order
  });
  it('picks out the votes of one ticket', () => {
    expect(votesFor([v(1, 3), v(2, 5), v(1, 8)], 1).map(x => x.points)).toEqual([3, 8]);
  });
});

describe('boxes', () => {
  const box = (id: string, over: Partial<StoryBox> = {}): StoryBox => ({ ...newBox(id, id, { type: 'space', spaceId: 1 }, `2026-11-0${id}T00:00:00Z`, 'Asha', 5), ...over });
  it('starts open with the usual scale, a trimmed name, and says who made it', () => {
    const b = newBox('x', '  Sprint review  ', { type: 'sprint', sprintKey: '2026-11' }, 'now', 'Asha', 5);
    expect(b).toMatchObject({ name: 'Sprint review', status: 'open', scale: [...DEFAULT_SCALE], createdBy: 'Asha' });
    expect(newBox('x', '   ', { type: 'space', spaceId: 1 }, 'now', 'A', 5).name).toBe('Story box');
    expect(newBox('x', 'n'.repeat(300), { type: 'space', spaceId: 1 }, 'now', 'A', 5).name).toHaveLength(100);
    expect(b.scale).not.toBe(DEFAULT_SCALE); // its own copy, so changing one never changes the default
  });
  it('shows the open boxes newest first, then the history with the latest closed first', () => {
    const { open, history } = groupBoxes([box('1'), box('2'), box('3', { status: 'closed', closedAt: '2026-11-20T00:00:00Z' }), box('4', { status: 'closed', closedAt: '2026-11-25T00:00:00Z' })]);
    expect(open.map(b => b.id)).toEqual(['2', '1']);
    expect(history.map(b => b.id)).toEqual(['4', '3']);
  });
  it('names the scope, and says when its space is gone', () => {
    const spaces = [makeSpace({ id: 1, name: 'Alpha' })];
    expect(scopeLabel({ type: 'space', spaceId: 1 }, spaces)).toBe('Space Alpha');
    expect(scopeLabel({ type: 'space', spaceId: 9 }, spaces)).toBe('A space that no longer exists');
    expect(scopeLabel({ type: 'sprint', sprintKey: '2026-11' }, spaces)).toBe('Sprint 2026-11, all spaces');
  });
  it('turns the points kept in a local box into votes by "You"', () => {
    expect(localVotesOf(box('1', { localVotes: { '10': 5, '11': 3 } })).map(x => [x.ticketId, x.points, x.name])).toEqual([[10, 5, 'You'], [11, 3, 'You']]);
    expect(localVotesOf(box('1'))).toEqual([]);
  });
});
