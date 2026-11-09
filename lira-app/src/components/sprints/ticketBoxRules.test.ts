import { describe, expect, it } from 'vitest';
import type { Issue } from '../../types/issue';
import type { SprintFilterValue } from './sprintFilterDefaults';
import { boxColor, boxTitle, byStatusOrder, toggledId, visibleTickets, withIds } from './ticketBoxRules';

const t = (id: number, status: string, spaceId = 1) => ({ id, status, spaceId }) as unknown as Issue;
const f = (statuses: string[] = [], spaceIds: number[] = []) => ({ statuses, spaceIds }) as unknown as SprintFilterValue;

describe('visibleTickets', () => {
  const list = [t(1, 'todo', 1), t(2, 'done', 2), t(3, 'inprogress', 2)];
  it('shows everything with no filter', () => expect(visibleTickets(list, f())).toHaveLength(3));
  it('filters by status, ignoring case', () => expect(visibleTickets(list, f(['DONE'])).map(i => i.id)).toEqual([2]));
  it('filters by space', () => expect(visibleTickets(list, f([], [2])).map(i => i.id)).toEqual([2, 3]));
  it('needs both filters to match', () => expect(visibleTickets(list, f(['todo'], [2]))).toEqual([]));
});

describe('byStatusOrder', () => {
  it('puts in progress, to do, backlog, done in that order without changing the input', () => {
    const list = [t(1, 'done'), t(2, 'backlog'), t(3, 'todo'), t(4, 'inprogress')];
    expect(byStatusOrder(list).map(i => i.id)).toEqual([4, 3, 2, 1]);
    expect(list.map(i => i.id)).toEqual([1, 2, 3, 4]);
  });
  it('keeps the order of tickets with the same status', () => {
    expect(byStatusOrder([t(1, 'todo'), t(2, 'todo')]).map(i => i.id)).toEqual([1, 2]);
  });
});

describe('boxTitle and boxColor', () => {
  it('says All tickets with no status chosen, and has no colour', () => {
    expect(boxTitle([])).toBe('All tickets');
    expect(boxColor([])).toBeUndefined();
  });
  it('joins the labels of several statuses and has no colour', () => {
    expect(boxTitle(['todo', 'done'])).toContain(' + ');
    expect(boxColor(['todo', 'done'])).toBeUndefined();
  });
  it('uses the colour of one status, and a label for blocked', () => {
    expect(boxColor(['done'])).toBeTruthy();
    expect(boxTitle(['blocked']).length).toBeGreaterThan(0);
    expect(boxColor(['blocked'])).toBeTruthy();
  });
  it('falls back to the raw name for an unknown status', () => {
    expect(boxTitle(['mystery'])).toBe('mystery');
    expect(boxColor(['mystery'])).toBeUndefined();
  });
});

describe('selection helpers', () => {
  it('withIds adds or removes, and never changes the original', () => {
    const base = new Set([1]);
    expect([...withIds(base, [2, 3], false)]).toEqual([1, 2, 3]);
    expect([...withIds(base, [1], true)]).toEqual([]);
    expect([...base]).toEqual([1]);
  });
  it('toggledId flips one id', () => {
    expect([...toggledId(new Set([1]), 2)]).toEqual([1, 2]);
    expect([...toggledId(new Set([1, 2]), 2)]).toEqual([1]);
  });
});
