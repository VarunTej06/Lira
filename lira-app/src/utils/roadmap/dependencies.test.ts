import { describe, expect, it } from 'vitest';
import { dependencyIssues, newId, resizeItem, shiftItem } from './dependencies';
import type { RoadmapItem } from './types';

const item = (id: string, start: string, end: string, deps: string[] = []): RoadmapItem => ({ id, title: id, lane: 'L', status: 'planned', start, end, progress: 0, deps, children: [] });

describe('problems in the order of work', () => {
  it('finds nothing when each item starts after the one it waits for ends', () => {
    expect(dependencyIssues([item('a', '2026-11-01', '2026-11-05'), item('b', '2026-11-06', '2026-11-10', ['a'])])).toEqual([]);
  });
  it('calls it a conflict when the one waited for ends on or after the day the other starts', () => {
    const items = [item('a', '2026-11-01', '2026-11-06'), item('b', '2026-11-06', '2026-11-10', ['a'])];
    expect(dependencyIssues(items)).toEqual([{ from: 'a', to: 'b', kind: 'conflict' }]);
  });
  it('finds an item that waits for one that is not there', () => {
    expect(dependencyIssues([item('b', '2026-11-06', '2026-11-10', ['gone'])])).toEqual([{ from: 'gone', to: 'b', kind: 'missing' }]);
  });
  it('finds a cycle, and an item that waits for itself', () => {
    const cycle = dependencyIssues([item('a', '2026-11-01', '2026-11-02', ['b']), item('b', '2026-11-03', '2026-11-04', ['a'])]);
    expect(cycle.some(i => i.kind === 'cycle')).toBe(true);
    const self = dependencyIssues([item('a', '2026-11-01', '2026-11-02', ['a'])]);
    expect(self.some(i => i.kind === 'cycle')).toBe(true);
  });
  it('does not call a long chain a cycle', () => {
    const chain = [item('a', '2026-11-01', '2026-11-02'), item('b', '2026-11-03', '2026-11-04', ['a']), item('c', '2026-11-05', '2026-11-06', ['b']), item('d', '2026-11-07', '2026-11-08', ['c', 'a'])];
    expect(dependencyIssues(chain)).toEqual([]);
  });
});

describe('moving and resizing an item', () => {
  const it0 = item('a', '2026-11-10', '2026-11-14');
  it('moves both ends by the same days, forwards and back, across a month end', () => {
    expect(shiftItem(it0, 3)).toMatchObject({ start: '2026-11-13', end: '2026-11-17' });
    expect(shiftItem(it0, -10)).toMatchObject({ start: '2026-10-31', end: '2026-11-04' });
    expect(shiftItem(it0, 0)).toEqual(it0);
  });
  it('moves the start or the end, and leaves the other end', () => {
    expect(resizeItem(it0, 'start', -2)).toMatchObject({ start: '2026-11-08', end: '2026-11-14' });
    expect(resizeItem(it0, 'end', 5)).toMatchObject({ start: '2026-11-10', end: '2026-11-19' });
  });
  it('keeps at least one day: an end pulled before the start stops at the start, and a start pushed past the end stops at the end', () => {
    expect(resizeItem(it0, 'end', -30)).toMatchObject({ start: '2026-11-10', end: '2026-11-10' });
    expect(resizeItem(it0, 'start', 30)).toMatchObject({ start: '2026-11-14', end: '2026-11-14' });
  });
});

describe('new ids', () => {
  it('start with the word given and are different each time, even in the same moment', () => {
    const ids = Array.from({ length: 50 }, () => newId('item'));
    expect(ids.every(i => i.startsWith('item-'))).toBe(true);
    expect(new Set(ids).size).toBe(50);
  });
});
