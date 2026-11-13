import { describe, expect, it } from 'vitest';
import { formatDateKey, monthGrid, parseDueDateKey } from './calendarGrid';

describe('Calendar grid', () => {
  it('writes a day as year-month-day with leading zeros', () => {
    expect(formatDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('reads a due date, and returns null for nothing or for rubbish', () => {
    expect(parseDueDateKey(new Date(2026, 10, 9, 15))).toBe('2026-11-09');
    expect(parseDueDateKey(undefined)).toBeNull();
    expect(parseDueDateKey('not a date')).toBeNull();
  });

  it('starts weeks on Monday and fills whole weeks', () => {
    const grid = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(grid.length % 7).toBe(0);
    expect(grid[0].date.getDay()).toBe(1); // Monday
    expect(grid[0].key).toBe('2026-10-26');
    expect(grid.filter(d => d.isCurrentMonth)).toHaveLength(30);
    expect(grid[grid.length - 1].date.getDay()).toBe(0); // ends on Sunday
  });

  it('has no padding when the month fits exactly (February 2027 is 4 whole weeks)', () => {
    const grid = monthGrid(2027, 1);
    expect(grid).toHaveLength(28);
    expect(grid.every(d => d.isCurrentMonth)).toBe(true);
  });

  it('handles January and December around the year change', () => {
    expect(monthGrid(2026, 0)[0].key).toBe('2025-12-29');
    const dec = monthGrid(2026, 11);
    expect(dec[dec.length - 1].key).toBe('2027-01-03');
  });
});
