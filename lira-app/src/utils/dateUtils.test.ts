import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatAbsoluteDate, formatDayDateTime, formatDueDate, formatRelativeDate, formatTimeTracking, isDueSoon, isOverdue } from './dateUtils';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 24, 12, 0, 0)); });
afterEach(() => vi.useRealTimers());

const day = (offset: number, hour = 9) => new Date(2026, 10, 24 + offset, hour, 0, 0);

describe('saying when something was or will be', () => {
  it('says Today, Yesterday and Tomorrow for those days, whatever the hour', () => {
    expect(formatRelativeDate(day(0, 1))).toBe('Today');
    expect(formatRelativeDate(day(0, 23))).toBe('Today');
    expect(formatRelativeDate(day(-1))).toBe('Yesterday');
    expect(formatRelativeDate(day(1))).toBe('Tomorrow');
  });
  it('says how long ago or how far for other days', () => {
    expect(formatRelativeDate(day(-5))).toBe('5 days ago');
    expect(formatRelativeDate(day(5))).toBe('in 5 days');
  });
  it('reads a date written as text as well as a date', () => {
    expect(formatRelativeDate('2026-11-24T08:00:00')).toBe('Today');
    expect(formatRelativeDate(new Date(2026, 10, 24).toISOString())).toMatch(/Today|Yesterday/); // an ISO instant lands on either side of midnight by timezone
  });
  it('gives nothing for a date that is missing or is not a date', () => {
    for (const bad of [undefined, null, '', 'not a date', new Date('x')]) {
      expect(formatRelativeDate(bad as never), String(bad)).toBe('');
      expect(formatAbsoluteDate(bad as never), String(bad)).toBe('');
      expect(formatDueDate(bad as never), String(bad)).toBe('');
      expect(formatDayDateTime(bad as never), String(bad)).toBe('');
    }
  });
});

describe('writing a date out', () => {
  it('writes day, short month and year', () => {
    expect(formatAbsoluteDate(new Date(2026, 10, 8))).toBe('8 Nov 2026');
    expect(formatDueDate('2026-01-05T10:00:00')).toBe('5 Jan 2026');
  });
  it('writes day, date and time for comments and history, with am or pm', () => {
    expect(formatDayDateTime(new Date(2026, 10, 8, 15, 42))).toBe('Sun, 8 Nov 2026 at 3:42 PM');
    expect(formatDayDateTime(new Date(2026, 10, 8, 0, 5))).toBe('Sun, 8 Nov 2026 at 12:05 AM');
  });
});

describe('due dates', () => {
  it('is due soon within three days from now, and not before now or later than that', () => {
    expect(isDueSoon(new Date(2026, 10, 24, 13, 0))).toBe(true);
    expect(isDueSoon(new Date(2026, 10, 27, 11, 0))).toBe(true);
    expect(isDueSoon(new Date(2026, 10, 27, 13, 0))).toBe(false);
    expect(isDueSoon(new Date(2026, 10, 24, 11, 0))).toBe(false); // already past
    expect(isDueSoon(undefined)).toBe(false);
    expect(isDueSoon('nonsense')).toBe(false);
  });
  it('is overdue once the moment has gone by, and not before', () => {
    expect(isOverdue(new Date(2026, 10, 24, 11, 59))).toBe(true);
    expect(isOverdue(new Date(2026, 10, 24, 12, 1))).toBe(false);
    expect(isOverdue(null)).toBe(false);
    expect(isOverdue('nonsense')).toBe(false);
  });
});

describe('time logged', () => {
  it('writes minutes as hours and minutes, leaving out what is zero', () => {
    expect(formatTimeTracking(0)).toBe('0h');
    expect(formatTimeTracking(45)).toBe('45m');
    expect(formatTimeTracking(60)).toBe('1h');
    expect(formatTimeTracking(135)).toBe('2h 15m');
    expect(formatTimeTracking(600)).toBe('10h');
  });
});
