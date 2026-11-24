import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, fmtDay, fmtShort, parseDay } from './dates';

describe('calendar days', () => {
  it('reads and writes a day as year, month and day, both ways', () => {
    const d = parseDay('2026-11-05');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 5]);
    expect(fmtDay(d)).toBe('2026-11-05');
    expect(fmtDay(new Date(2026, 0, 9))).toBe('2026-01-09');
  });
  it('reads a day with a missing part as the first of it, and never as a time zone shifted day', () => {
    expect(fmtDay(parseDay('2026-03'))).toBe('2026-03-01');
    expect(fmtDay(parseDay('2026'))).toBe('2026-01-01');
    expect(parseDay('2026-06-15').getHours()).toBe(0);
  });
  it('adds days across month and year ends, and backwards', () => {
    expect(fmtDay(addDays(parseDay('2026-11-28'), 5))).toBe('2026-12-03');
    expect(fmtDay(addDays(parseDay('2026-12-30'), 3))).toBe('2027-01-02');
    expect(fmtDay(addDays(parseDay('2026-03-01'), -1))).toBe('2026-02-28');
    expect(fmtDay(addDays(parseDay('2026-03-01'), 0))).toBe('2026-03-01');
  });
  it('counts whole days between two days, positive when the second is later, whatever the time of day', () => {
    expect(daysBetween(parseDay('2026-11-01'), parseDay('2026-11-30'))).toBe(29);
    expect(daysBetween(parseDay('2026-11-30'), parseDay('2026-11-01'))).toBe(-29);
    expect(daysBetween(new Date(2026, 10, 1, 23, 59), new Date(2026, 10, 2, 0, 1))).toBe(1);
    expect(daysBetween(parseDay('2026-11-01'), parseDay('2026-11-01'))).toBe(0);
  });
  it('counts a daylight saving change as the same number of days', () => {
    expect(daysBetween(parseDay('2026-03-01'), parseDay('2026-04-01'))).toBe(31);
    expect(daysBetween(parseDay('2026-10-01'), parseDay('2026-11-01'))).toBe(31);
  });
  it('writes a short day as month and day', () => {
    expect(fmtShort('2026-11-05')).toBe('Nov 5');
    expect(fmtShort('2026-01-31')).toBe('Jan 31');
  });
});
