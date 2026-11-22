import { describe, expect, it } from 'vitest';
import { endDateFor, nextOccurrence, occurrences, repeatSummary, type Schedule } from './standupSchedule';

const at = (iso: string) => Date.parse(iso);
const iso = (ms: number) => new Date(ms).toISOString();
const base: Schedule = { startsAt: '2026-11-23T04:30:00Z', durationMinutes: 15, repeat: 'none', repeatUntil: null, timeZone: 'Asia/Kolkata' }; // Monday 10:00 in India

describe('occurrences', () => {
  it('is the one start time of a call that does not repeat, and only inside the asked range', () => {
    expect(occurrences(base, at('2026-11-01T00:00:00Z'), at('2026-12-31T00:00:00Z')).map(iso)).toEqual(['2026-11-23T04:30:00.000Z']);
    expect(occurrences(base, at('2026-11-24T00:00:00Z'), at('2026-12-31T00:00:00Z'))).toEqual([]);
    expect(occurrences(base, at('2026-11-01T00:00:00Z'), at('2026-11-22T00:00:00Z'))).toEqual([]);
  });

  it('is every day from the first day to the last day, both counted', () => {
    const list = occurrences({ ...base, repeat: 'daily', repeatUntil: '2026-11-27' }, 0, at('2027-01-01T00:00:00Z'));
    expect(list.map(iso)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'].map(d => `${d}T04:30:00.000Z`));
  });

  it('skips weekends for every weekday, and keeps the same weekday for every week', () => {
    const weekdays = occurrences({ ...base, repeat: 'weekdays', repeatUntil: '2026-12-06' }, 0, at('2027-01-01T00:00:00Z')).map(iso);
    expect(weekdays).toHaveLength(10);
    expect(weekdays.some(d => ['2026-11-28', '2026-11-29', '2026-12-05', '2026-12-06'].some(w => d.startsWith(w)))).toBe(false);
    const weekly = occurrences({ ...base, repeat: 'weekly', repeatUntil: '2026-12-20' }, 0, at('2027-01-01T00:00:00Z')).map(iso);
    expect(weekly.map(d => d.slice(0, 10))).toEqual(['2026-11-23', '2026-11-30', '2026-12-07', '2026-12-14']);
  });

  it('keeps the clock time of the time zone when the clocks change (London goes back on 25 October 2026)', () => {
    const london: Schedule = { startsAt: '2026-10-22T09:00:00Z', durationMinutes: 15, repeat: 'daily', repeatUntil: '2026-10-28', timeZone: 'Europe/London' }; // 10:00 BST
    const list = occurrences(london, 0, at('2027-01-01T00:00:00Z')).map(iso);
    expect(list.slice(0, 3)).toEqual(['2026-10-22T09:00:00.000Z', '2026-10-23T09:00:00.000Z', '2026-10-24T09:00:00.000Z']);
    expect(list.slice(3)).toEqual(['2026-10-25T10:00:00.000Z', '2026-10-26T10:00:00.000Z', '2026-10-27T10:00:00.000Z', '2026-10-28T10:00:00.000Z']);
  });

  it('puts an evening call on the right day for the zone, not for UTC', () => {
    // 20:00 UTC is 01:30 the next morning in India, so the first call is on the 24th there, and the last day (the 25th) is a day of that zone
    const late: Schedule = { startsAt: '2026-11-23T20:00:00Z', durationMinutes: 30, repeat: 'daily', repeatUntil: '2026-11-25', timeZone: 'Asia/Kolkata' };
    expect(occurrences(late, 0, at('2027-01-01T00:00:00Z')).map(iso)).toEqual(['2026-11-23T20:00:00.000Z', '2026-11-24T20:00:00.000Z']);
  });

  it('never lists more than a few hundred at once', () => {
    expect(occurrences({ ...base, repeat: 'daily', repeatUntil: '2027-11-22' }, 0, at('2030-01-01T00:00:00Z')).length).toBeLessThanOrEqual(400);
  });
});

describe('nextOccurrence', () => {
  const series: Schedule = { ...base, repeat: 'weekdays', repeatUntil: '2026-12-04' };
  it('is the next start time, counting a call that is on right now', () => {
    expect(nextOccurrence(series, at('2026-11-25T05:00:00Z'))).toEqual({ at: at('2026-11-26T04:30:00Z'), over: false });
    expect(nextOccurrence(series, at('2026-11-25T04:40:00Z'))).toEqual({ at: at('2026-11-25T04:30:00Z'), over: false });
    expect(nextOccurrence(series, at('2026-11-27T05:00:00Z'))).toEqual({ at: at('2026-11-30T04:30:00Z'), over: false });
  });
  it('is the last one, marked over, when the series has finished, and none for a call that never happens', () => {
    expect(nextOccurrence(series, at('2026-12-10T00:00:00Z'))).toEqual({ at: at('2026-12-04T04:30:00Z'), over: true });
    expect(nextOccurrence(base, at('2026-11-22T00:00:00Z'))).toEqual({ at: at('2026-11-23T04:30:00Z'), over: false });
  });
});

describe('endDateFor', () => {
  it('counts a week or a number of days with the first day included', () => {
    expect(endDateFor('2026-11-23', { kind: 'weeks', count: 1 })).toBe('2026-11-29');
    expect(endDateFor('2026-11-23', { kind: 'weeks', count: 2 })).toBe('2026-12-06');
    expect(endDateFor('2026-11-23', { kind: 'days', count: 10 })).toBe('2026-12-02');
    expect(endDateFor('2026-11-23', { kind: 'days', count: 1 })).toBe('2026-11-23');
  });
  it('ends a month on the day before the same date next month, also at the end of a short month', () => {
    expect(endDateFor('2026-11-23', { kind: 'months', count: 1 })).toBe('2026-12-22');
    expect(endDateFor('2026-01-31', { kind: 'months', count: 1 })).toBe('2026-02-27');
    expect(endDateFor('2026-12-15', { kind: 'months', count: 3 })).toBe('2027-03-14');
  });
  it('takes a chosen date as it is', () => { expect(endDateFor('2026-11-23', { kind: 'date', date: '2027-01-15' })).toBe('2027-01-15'); });
});

describe('repeatSummary', () => {
  it('says how it repeats and until when, or nothing', () => {
    expect(repeatSummary({ repeat: 'weekdays', repeatUntil: '2026-12-18' })).toBe('Every weekday until 18 Dec 2026');
    expect(repeatSummary({ repeat: 'none', repeatUntil: null })).toBe('');
  });
});
