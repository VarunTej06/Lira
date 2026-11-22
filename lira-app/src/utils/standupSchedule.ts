/**
 * When a stand-up happens. A call is one start time, or a series: every day, every weekday or every week from the first call until
 * a last day. The clock time belongs to a time zone, so 10:00 stays 10:00 for the people in it when the clocks change.
 */
export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly';

export interface Schedule { startsAt: string; durationMinutes: number; repeat: Repeat; repeatUntil: string | null; timeZone: string }

export const REPEAT_LABEL: Record<Repeat, string> = { none: 'Does not repeat', daily: 'Every day', weekdays: 'Every weekday', weekly: 'Every week' };

/** A safety limit on how many times one series is listed at once. */
const MAX_LISTED = 400;
const DAY_MS = 86_400_000;

interface Local { year: number; month: number; day: number; hour: number; minute: number }

/** The wall-clock time at an instant, in a time zone. */
function localParts(ms: number, timeZone: string): Local {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

const asUtc = (l: Local): number => Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute);

/** The instant at which a time zone's clock shows this wall-clock time. Checked twice, because the offset can change at that moment. */
function instantOf(l: Local, timeZone: string): number {
  const wall = asUtc(l);
  let guess = wall - (asUtc(localParts(wall, timeZone)) - wall);
  guess = wall - (asUtc(localParts(guess, timeZone)) - guess);
  return guess;
}

const dayOfWeek = (l: Local): number => new Date(Date.UTC(l.year, l.month - 1, l.day)).getUTCDay(); // 0 is Sunday

/** The day (year-month-day) a date string such as "2026-12-18" names, as a number of days. */
const dayNumber = (iso: string): number => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY_MS);

/** Every start time of a call that falls between two instants, oldest first. */
export function occurrences(call: Schedule, fromMs: number, toMs: number): number[] {
  const first = localParts(Date.parse(call.startsAt), call.timeZone);
  const firstDay = Math.floor(asUtc({ ...first, hour: 0, minute: 0 }) / DAY_MS);
  const lastDay = call.repeat === 'none' || !call.repeatUntil ? firstDay : dayNumber(call.repeatUntil);
  const startDay = Math.max(firstDay, Math.floor(fromMs / DAY_MS) - 1);
  const endDay = Math.min(lastDay, Math.ceil(toMs / DAY_MS) + 1);
  const found: number[] = [];
  for (let day = startDay; day <= endDay && found.length < MAX_LISTED; day++) {
    const date = new Date(day * DAY_MS);
    const local: Local = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: first.hour, minute: first.minute };
    const weekday = dayOfWeek(local);
    const wanted = call.repeat === 'none' ? day === firstDay : call.repeat === 'daily' ? true : call.repeat === 'weekdays' ? weekday >= 1 && weekday <= 5 : weekday === dayOfWeek(first);
    if (!wanted || day < firstDay) continue;
    const at = instantOf(local, call.timeZone);
    if (at >= fromMs && at <= toMs) found.push(at);
  }
  return found;
}

/** The first start time at or after a moment, or the last one if the series is over, or null if it has none. */
export function nextOccurrence(call: Schedule, nowMs: number): { at: number; over: boolean } | null {
  const horizon = nowMs + (call.repeat === 'none' ? 400 : 400) * DAY_MS;
  const upcoming = occurrences(call, nowMs - call.durationMinutes * 60_000, horizon);
  if (upcoming.length) return { at: upcoming[0], over: false };
  const all = occurrences(call, 0, nowMs);
  return all.length ? { at: all[all.length - 1], over: true } : null;
}

export type EndChoice = { kind: 'weeks'; count: number } | { kind: 'months'; count: number } | { kind: 'days'; count: number } | { kind: 'date'; date: string };

/**
 * The last day of a series that runs for a length of time from its first day: "1 week" is 7 days counting the first, "1 month" ends the
 * day before the same date next month, "N days" is N days counting the first. Or a chosen date, as it is.
 */
export function endDateFor(firstDay: string, choice: EndChoice): string {
  if (choice.kind === 'date') return choice.date;
  const [y, m, d] = firstDay.split('-').map(Number);
  const start = Date.UTC(y, m - 1, d);
  if (choice.kind === 'days') return new Date(start + (choice.count - 1) * DAY_MS).toISOString().slice(0, 10);
  if (choice.kind === 'weeks') return new Date(start + (choice.count * 7 - 1) * DAY_MS).toISOString().slice(0, 10);
  const target = new Date(Date.UTC(y, m - 1 + choice.count, 1));
  const lastOfTarget = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastOfTarget)) - DAY_MS).toISOString().slice(0, 10);
}

/** The time zone of this browser, which the call is made in. */
export const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/** "Every weekday until 18 Dec 2026", or an empty text for a call that does not repeat. */
export function repeatSummary(call: Pick<Schedule, 'repeat' | 'repeatUntil'>): string {
  if (call.repeat === 'none' || !call.repeatUntil) return '';
  const until = new Date(`${call.repeatUntil}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return `${REPEAT_LABEL[call.repeat]} until ${until}`;
}
