import { z } from 'zod';

/** The call services a link may point to. Anything else is refused, so a link in a stand-up can only lead to a meeting. */
export const MEETING_HOSTS: readonly string[] = ['meet.google.com', 'teams.microsoft.com', 'teams.live.com'];

export function isMeetingLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && MEETING_HOSTS.includes(url.hostname.toLowerCase());
  } catch { return false; }
}

export const REPEATS = ['none', 'daily', 'weekdays', 'weekly'] as const;
/** The longest a series may run, so a mistake cannot make a stand-up that goes on for years. */
export const MAX_SERIES_DAYS = 366;

function isTimeZone(value: string): boolean {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
}

const title = z.string().trim().min(1, 'Enter a title.').max(120, 'Use at most 120 characters.');
const startsAt = z.iso.datetime({ offset: true });
const duration = z.number().int().min(5, 'At least 5 minutes.').max(240, 'At most 4 hours.');
const link = z.string().trim().max(500).refine(isMeetingLink, 'Use a Google Meet or Microsoft Teams link, starting with https://.');
const invitee = z.strictObject({ type: z.enum(['user', 'team']), id: z.uuid() });
const invitees = z.array(invitee).min(1, 'Invite at least one person or team.').max(200);
const timeZone = z.string().max(64).refine(isTimeZone, 'Not a time zone.');
export const SCOPES = ['org', 'space', 'project', 'sprint'] as const;
const scopeId = z.string().regex(/^[A-Za-z0-9_.:-]{1,80}$/, 'Not an id.');
const scopeName = z.string().trim().max(120);
const repeatUntil = z.iso.date();

const fields = {
  title, startsAt, durationMinutes: duration, invitees, timeZone,
  link: link.optional(), repeat: z.enum(REPEATS).optional(), repeatUntil: repeatUntil.optional(),
  scopeType: z.enum(SCOPES).optional(), scopeId: scopeId.optional(), scopeName: scopeName.optional(),
};

/** The last day of a series must come with a repeat, not be before the first day, and be within a year of it. */
function checkSeries(v: { startsAt?: string; repeat?: string; repeatUntil?: string }, ctx: z.RefinementCtx): void {
  const repeats = v.repeat !== undefined && v.repeat !== 'none';
  if (repeats && !v.repeatUntil) ctx.addIssue({ code: 'custom', path: ['repeatUntil'], message: 'Say on which day the repeat ends.' });
  if (!repeats && v.repeatUntil && v.repeat !== undefined) ctx.addIssue({ code: 'custom', path: ['repeatUntil'], message: 'A call that does not repeat has no end day.' });
  if (repeats && v.repeatUntil && v.startsAt) {
    const days = (Date.parse(`${v.repeatUntil}T00:00:00Z`) - Date.parse(v.startsAt.slice(0, 10) + 'T00:00:00Z')) / 86_400_000;
    if (days < -1) ctx.addIssue({ code: 'custom', path: ['repeatUntil'], message: 'The end day cannot be before the first call.' });
    if (days > MAX_SERIES_DAYS) ctx.addIssue({ code: 'custom', path: ['repeatUntil'], message: `A series can run for at most ${MAX_SERIES_DAYS} days.` });
  }
}

/** A call for a space, project or sprint names which one; a call for the whole organisation names nothing. */
function checkScope(v: { scopeType?: string; scopeId?: string }, ctx: z.RefinementCtx): void {
  const scoped = v.scopeType !== undefined && v.scopeType !== 'org';
  if (scoped && !v.scopeId) ctx.addIssue({ code: 'custom', path: ['scopeId'], message: 'Say which space, project or sprint this call is for.' });
  if (!scoped && v.scopeId) ctx.addIssue({ code: 'custom', path: ['scopeId'], message: 'A call for the whole organisation names nothing.' });
}

/** Unknown fields are refused. The organisation and the maker are never taken from the request. No link means: make a Meet link. */
export const createStandupSchema = z.strictObject(fields).superRefine(checkSeries).superRefine(checkScope);
export const updateStandupSchema = z.strictObject({
  title: title.optional(), startsAt: startsAt.optional(), durationMinutes: duration.optional(), invitees: invitees.optional(), timeZone: timeZone.optional(),
  link: link.optional(), repeat: z.enum(REPEATS).optional(), repeatUntil: repeatUntil.optional(), scopeName: scopeName.optional(),
}).refine(v => Object.values(v).some(x => x !== undefined), { message: 'Nothing to change.' }).superRefine(checkSeries);

export type CreateStandup = z.infer<typeof createStandupSchema>;
export type UpdateStandup = z.infer<typeof updateStandupSchema>;
