import { describe, expect, it } from 'vitest';
import { dayClass, formatPretty, fromKey, monthGrid, outOfRange, toKey } from './dateKeys';

describe('date keys', () => {
  it('writes a date as YYYY-MM-DD with the local calendar day', () => {
    expect(toKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toKey(new Date(2026, 10, 30, 23, 59))).toBe('2026-11-30');
  });

  it('reads a key back to the same local day', () => {
    const d = fromKey('2026-11-09')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 9]);
    expect(toKey(d)).toBe('2026-11-09');
  });

  it('rejects anything that is not a full date', () => {
    expect(fromKey('')).toBeNull();
    expect(fromKey('2026-1-9')).toBeNull();
    expect(fromKey('09/11/2026')).toBeNull();
  });

  it('formats a key for display, and gives nothing for a bad one', () => {
    expect(formatPretty('2026-11-09')).toMatch(/Nov(ember)? 9, 2026/);
    expect(formatPretty('nope')).toBe('');
  });

  it('lays out six Monday-first weeks and marks the days of the month', () => {
    const grid = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(grid).toHaveLength(42);
    expect(grid[0].date.getDay()).toBe(1); // Monday
    expect(toKey(grid[0].date)).toBe('2026-10-26');
    expect(grid.filter(g => g.inMonth)).toHaveLength(30);
    expect(grid.find(g => g.inMonth)!.date.getDate()).toBe(1);
  });
});

describe('outOfRange', () => {
  it('allows every day when there are no limits', () => expect(outOfRange('2026-11-10')).toBe(false));
  it('refuses days before min and after max, and allows the limits themselves', () => {
    expect(outOfRange('2026-11-09', '2026-11-10')).toBe(true);
    expect(outOfRange('2026-11-10', '2026-11-10', '2026-11-10')).toBe(false);
    expect(outOfRange('2026-11-11', undefined, '2026-11-10')).toBe(true);
  });
});

describe('dayClass', () => {
  it('fills the chosen day, even when it is today', () => expect(dayClass(true, true, true)).toContain('bg-lira-blue'));
  it('rings today when it is not chosen', () => expect(dayClass(false, true, false)).toContain('ring-1'));
  it('dims days of other months', () => {
    expect(dayClass(false, false, false)).toContain('text-lira-muted');
    expect(dayClass(false, false, true)).toBe('hover:bg-gray-100');
  });
});
