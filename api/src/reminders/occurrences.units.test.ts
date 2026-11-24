import { describe, expect, it } from 'vitest';
import { lastStart, recurrenceOf, startsBetween, type CallRule } from './occurrences';

const at = (iso: string) => new Date(iso);
const rule = (over: Partial<CallRule>): CallRule => ({ startsAt: at('2026-11-02T09:00:00Z'), repeat: 'none', repeatUntil: null, timeZone: 'UTC', ...over });
const iso = (list: Date[]) => list.map(d => d.toISOString());

describe('when a call starts', () => {
  it('a call that does not repeat starts once: after the first instant and up to, and including, the second', () => {
    const r = rule({});
    expect(iso(startsBetween(r, at('2026-11-02T08:45:00Z'), at('2026-11-02T09:00:00Z')))).toEqual(['2026-11-02T09:00:00.000Z']);
    expect(startsBetween(r, at('2026-11-02T09:00:00Z'), at('2026-11-02T09:15:00Z'))).toEqual([]); // already started
    expect(startsBetween(r, at('2026-11-02T08:00:00Z'), at('2026-11-02T08:30:00Z'))).toEqual([]);
  });

  it('a daily call starts every day at the same time, until its last day and not before its first', () => {
    const r = rule({ repeat: 'daily', repeatUntil: '2026-11-05' });
    expect(iso(startsBetween(r, at('2026-11-04T08:00:00Z'), at('2026-11-04T09:30:00Z')))).toEqual(['2026-11-04T09:00:00.000Z']);
    expect(startsBetween(r, at('2026-11-06T08:00:00Z'), at('2026-11-06T09:30:00Z'))).toEqual([]); // after the last day
    expect(startsBetween(r, at('2026-11-01T08:00:00Z'), at('2026-11-01T09:30:00Z'))).toEqual([]); // before the first
    expect(iso(startsBetween(r, at('2026-11-05T08:00:00Z'), at('2026-11-05T09:30:00Z')))).toEqual(['2026-11-05T09:00:00.000Z']); // the last day itself
  });

  it('a weekday call skips Saturday and Sunday, and a weekly call comes on the weekday it began', () => {
    const weekdays = rule({ repeat: 'weekdays', repeatUntil: '2026-12-31' });
    expect(startsBetween(weekdays, at('2026-11-07T08:00:00Z'), at('2026-11-07T10:00:00Z'))).toEqual([]); // a Saturday
    expect(startsBetween(weekdays, at('2026-11-08T08:00:00Z'), at('2026-11-08T10:00:00Z'))).toEqual([]); // a Sunday
    expect(iso(startsBetween(weekdays, at('2026-11-09T08:00:00Z'), at('2026-11-09T10:00:00Z')))).toEqual(['2026-11-09T09:00:00.000Z']);
    const weekly = rule({ repeat: 'weekly', repeatUntil: '2026-12-31' }); // began on a Monday
    expect(startsBetween(weekly, at('2026-11-10T08:00:00Z'), at('2026-11-10T10:00:00Z'))).toEqual([]);
    expect(iso(startsBetween(weekly, at('2026-11-16T08:00:00Z'), at('2026-11-16T10:00:00Z')))).toEqual(['2026-11-16T09:00:00.000Z']);
  });

  it('keeps the clock time of its own time zone across a change of clocks', () => {
    // 10:00 in New York: 14:00 UTC under winter time, 13:00 UTC once summer time has started (14 March 2027).
    const r = rule({ startsAt: at('2027-03-08T15:00:00Z'), repeat: 'daily', repeatUntil: '2027-04-01', timeZone: 'America/New_York' });
    expect(iso(startsBetween(r, at('2027-03-12T14:00:00Z'), at('2027-03-12T16:00:00Z')))).toEqual(['2027-03-12T15:00:00.000Z']);
    expect(iso(startsBetween(r, at('2027-03-15T13:00:00Z'), at('2027-03-15T15:00:00Z')))).toEqual(['2027-03-15T14:00:00.000Z']);
  });

  it('works for a time zone ahead of UTC, where the local day is not the UTC day', () => {
    const r = rule({ startsAt: at('2026-11-01T20:30:00Z'), repeat: 'daily', repeatUntil: '2026-11-30', timeZone: 'Asia/Kolkata' }); // 02:00 on 2 Nov in India
    expect(iso(startsBetween(r, at('2026-11-09T20:00:00Z'), at('2026-11-09T21:00:00Z')))).toEqual(['2026-11-09T20:30:00.000Z']);
  });

  it('returns nothing for a window that holds no start, and each start once however the window is cut', () => {
    const r = rule({ repeat: 'daily', repeatUntil: '2026-11-30' });
    expect(startsBetween(r, at('2026-11-10T10:00:00Z'), at('2026-11-11T08:59:59Z'))).toEqual([]);
    const a = startsBetween(r, at('2026-11-10T08:00:00Z'), at('2026-11-10T09:00:00Z'));
    const b = startsBetween(r, at('2026-11-10T09:00:00Z'), at('2026-11-10T10:00:00Z'));
    expect(a.length + b.length).toBe(1);
  });
});

describe('a call as a calendar rule', () => {
  it('has none for a single call, and ends a series with its own last start', () => {
    expect(recurrenceOf(rule({}))).toEqual([]);
    expect(recurrenceOf(rule({ repeat: 'daily', repeatUntil: '2026-11-05' }))).toEqual(['RRULE:FREQ=DAILY;UNTIL=20261105T090000Z']);
    expect(recurrenceOf(rule({ repeat: 'weekdays', repeatUntil: '2026-11-13' }))).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20261113T090000Z']);
    expect(recurrenceOf(rule({ repeat: 'weekly', repeatUntil: '2026-11-20' }))).toEqual(['RRULE:FREQ=WEEKLY;UNTIL=20261116T090000Z']); // Mondays: the last is the 16th
  });

  it('ends on the last day in the call\'s own time zone, even when that is already the next day in UTC', () => {
    const la = rule({ startsAt: at('2026-11-02T06:30:00Z'), repeat: 'daily', repeatUntil: '2026-11-05', timeZone: 'America/Los_Angeles' }); // 22:30 the evening before
    expect(lastStart(la)!.toISOString()).toBe('2026-11-06T06:30:00.000Z');
    expect(recurrenceOf(la)).toEqual(['RRULE:FREQ=DAILY;UNTIL=20261106T063000Z']);
  });

  it('has no last start for a call that does not repeat', () => {
    expect(lastStart(rule({}))).toBeNull();
  });
});
