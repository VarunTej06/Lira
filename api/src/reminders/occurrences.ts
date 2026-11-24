export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly';

/** What decides when a call happens: its first start, the repeat, the last day of the series, and the time zone the clock time belongs to. */
export interface CallRule { startsAt: Date; repeat: Repeat; repeatUntil: string | null; timeZone: string }

const DAY = 86_400_000;

interface Local { date: string; minutes: number; weekday: number }

/** The calendar day, minute of the day and weekday (0 is Sunday) that an instant has on the clock of a time zone. */
function localOf(instant: Date, timeZone: string): Local {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(instant).map(p => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday),
  };
}

/** The instant at which a time zone's clock shows the given day and minute. Two corrections settle it across a change of clocks. */
function atLocal(date: string, minutes: number, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  let guess = Date.UTC(y, m - 1, d, 0, minutes);
  for (let i = 0; i < 2; i++) {
    const seen = localOf(new Date(guess), timeZone);
    const [sy, sm, sd] = seen.date.split('-').map(Number);
    guess += Date.UTC(y, m - 1, d, 0, minutes) - Date.UTC(sy, sm - 1, sd, 0, seen.minutes);
  }
  return new Date(guess);
}

const shift = (date: string, days: number): string => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/**
 * The starts of a call that fall after `from` and not after `to`. A repeating call keeps its clock time in its own time zone, so 10:00
 * stays 10:00 when the clocks change. The series ends on its last day, whatever hour that day's call is at.
 */
export function startsBetween(rule: CallRule, from: Date, to: Date): Date[] {
  if (rule.repeat === 'none') return rule.startsAt > from && rule.startsAt <= to ? [rule.startsAt] : [];
  const first = localOf(rule.startsAt, rule.timeZone);
  const out: Date[] = [];
  const last = localOf(to, rule.timeZone).date;
  for (let day = shift(localOf(from, rule.timeZone).date, -1); day <= shift(last, 1); day = shift(day, 1)) {
    if (day < first.date || (rule.repeatUntil !== null && day > rule.repeatUntil)) continue;
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    const on = rule.repeat === 'daily' || (rule.repeat === 'weekdays' && weekday >= 1 && weekday <= 5) || (rule.repeat === 'weekly' && weekday === first.weekday);
    const start = atLocal(day, first.minutes, rule.timeZone);
    if (on && start > from && start <= to) out.push(start);
  }
  return out;
}

/** The last start of a series, or null for a call that does not repeat. */
export function lastStart(rule: CallRule): Date | null {
  if (rule.repeat === 'none' || rule.repeatUntil === null) return null;
  const end = new Date(Date.parse(`${rule.repeatUntil}T00:00:00Z`) + 2 * DAY);
  return startsBetween(rule, new Date(rule.startsAt.getTime() - 1), end).at(-1) ?? null;
}

const BY: Record<Exclude<Repeat, 'none'>, string> = { daily: 'FREQ=DAILY', weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', weekly: 'FREQ=WEEKLY' };

/** The repeat of a call as a calendar rule (RFC 5545), ending with the last start so no extra day is added in any time zone. */
export function recurrenceOf(rule: CallRule): string[] {
  const last = lastStart(rule);
  if (last === null || rule.repeat === 'none') return [];
  return [`RRULE:${BY[rule.repeat]};UNTIL=${last.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`];
}
