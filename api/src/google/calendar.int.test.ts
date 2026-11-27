import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FakeGoogle } from '../testing/fake-google';
import { ADMIN_URL, startRealDb, type RealDb } from '../testing/realDb';

const CALENDAR = 'https://www.googleapis.com/auth/calendar.events';
const LINK = 'https://meet.google.com/abc-defg-hij';

describe.skipIf(!ADMIN_URL)('calls in the Google calendar, on a real database', () => {
  const google = new FakeGoogle();
  let db: RealDb;
  const plain = google.grantedScope;
  beforeAll(async () => { db = await startRealDb({ google }); });
  afterAll(async () => { await db?.stop(); });
  beforeEach(() => { google.failCalendar = false; google.grantedScope = plain; });

  type Person = Awaited<ReturnType<RealDb['signUp']>>;
  let n = 0;
  const base = (p: Person) => `/api/orgs/${p.orgId}/google`;
  const connect = async (owner: Person, withCalendar: boolean) => {
    google.grantedScope = withCalendar ? `${plain} ${CALENDAR}` : plain;
    const started = await db.call('POST', `${base(owner)}/connect`, undefined, owner.session);
    const state = new URL((started.body as { url: string }).url).searchParams.get('state')!;
    await db.call('GET', `/api/google/callback?code=abc&state=${encodeURIComponent(state)}`, undefined, owner.session);
  };
  const setup = async (withCalendar = true) => {
    const owner = await db.signUp(`cal-owner${++n}@example.com`);
    const member = await db.addMember(owner, `cal-member${n}@example.com`, 'member');
    await connect(owner, withCalendar);
    return { owner, member };
  };
  const make = (owner: Person, member: Person, extra: object = {}) =>
    db.call('POST', `/api/orgs/${owner.orgId}/standups`, { title: 'Daily', startsAt: '2026-12-01T09:00:00Z', durationMinutes: 30, timeZone: 'UTC', link: LINK, invitees: [{ type: 'user', id: member.userId }], ...extra }, owner.session);
  const calendarCalls = () => google.requests.filter(r => r.url.includes('/calendar/v3/'));

  it('asks for the Calendar permission with the others, and says whether the connection has it', async () => {
    const withIt = await setup(true);
    expect((await db.call('GET', base(withIt.owner), undefined, withIt.owner.session)).body).toMatchObject({ connected: true, calendar: true });
    const without = await setup(false);
    expect((await db.call('GET', base(without.owner), undefined, without.owner.session)).body).toMatchObject({ connected: true, calendar: false });
    const started = await db.call('POST', `${base(without.owner)}/connect`, undefined, without.owner.session);
    expect(new URL((started.body as { url: string }).url).searchParams.get('scope')).toContain(CALENDAR);
  });

  it('puts a new call in the owner\'s calendar with the invited people, and lets Google send the invitations instead of Gmail', async () => {
    const { owner, member } = await setup();
    const before = google.sentEmails().length;
    const made = await make(owner, member, { scopeName: 'Alpha sprint' });
    expect(made.status).toBe(201);
    expect((made.body as { emailed: { sent: number; total: number } }).emailed).toEqual({ sent: 1, total: 1 });
    expect(google.sentEmails().length).toBe(before); // no second email from Gmail
    const post = calendarCalls().at(-1)!;
    expect(post.method).toBe('POST');
    expect(post.url).toContain('sendUpdates=all');
    const event = JSON.parse(post.body) as { summary: string; location: string; attendees: { email: string }[]; start: { dateTime: string; timeZone: string }; end: { dateTime: string }; recurrence?: string[] };
    expect(event).toMatchObject({ summary: 'Daily', location: LINK, attendees: [{ email: `cal-member${n}@example.com` }], start: { dateTime: '2026-12-01T09:00:00.000Z', timeZone: 'UTC' }, end: { dateTime: '2026-12-01T09:30:00.000Z' } });
    expect(event.recurrence).toBeUndefined();
    const stored = await db.rows<{ calendar_event_id: string }>('SELECT calendar_event_id FROM standup_calls WHERE id = $1', [(made.body as { id: string }).id]);
    expect(stored[0].calendar_event_id).toMatch(/^evt-/);
  });

  it('sends a repeating call as one repeating event that ends with its last start', async () => {
    const { owner, member } = await setup();
    await make(owner, member, { repeat: 'weekdays', repeatUntil: '2026-12-11' });
    const event = JSON.parse(calendarCalls().at(-1)!.body) as { recurrence: string[] };
    expect(event.recurrence).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20261211T090000Z']);
  });

  it('brings the event up to date when the call changes, makes it again when it was deleted in Google, and removes it with the call', async () => {
    const { owner, member } = await setup();
    const made = (await make(owner, member)).body as { id: string };
    const path = `/api/orgs/${owner.orgId}/standups/${made.id}`;
    const eventId = (await db.rows<{ calendar_event_id: string }>('SELECT calendar_event_id FROM standup_calls WHERE id = $1', [made.id]))[0].calendar_event_id;
    expect((await db.call('PATCH', path, { title: 'Daily, moved', startsAt: '2026-12-01T10:00:00Z' }, owner.session)).status).toBe(200);
    expect(google.events.get(eventId)).toMatchObject({ summary: 'Daily, moved', start: { dateTime: '2026-12-01T10:00:00.000Z' } });
    google.events.delete(eventId); // the owner deleted it in Google
    await db.call('PATCH', path, { title: 'Daily again' }, owner.session);
    const again = (await db.rows<{ calendar_event_id: string }>('SELECT calendar_event_id FROM standup_calls WHERE id = $1', [made.id]))[0].calendar_event_id;
    expect(again).not.toBe(eventId);
    expect(google.events.get(again)).toMatchObject({ summary: 'Daily again' });
    expect((await db.call('DELETE', path, undefined, owner.session)).status).toBe(204);
    expect(google.events.has(again)).toBe(false);
  });

  it('keeps the call and falls back to Gmail invitations when the connection has no Calendar permission, or Google refuses the event', async () => {
    const old = await setup(false);
    const sentBefore = google.sentEmails().length;
    const callsBefore = calendarCalls().length;
    const first = await make(old.owner, old.member);
    expect(first.status).toBe(201);
    expect(google.sentEmails().length).toBe(sentBefore + 1);
    expect(calendarCalls().length).toBe(callsBefore); // Google's calendar was not even asked
    expect((await db.rows<{ calendar_event_id: string | null }>('SELECT calendar_event_id FROM standup_calls WHERE id = $1', [(first.body as { id: string }).id]))[0].calendar_event_id).toBeNull();

    const { owner, member } = await setup();
    google.failCalendar = true;
    const sent = google.sentEmails().length;
    expect((await make(owner, member)).status).toBe(201);
    expect(google.sentEmails().length).toBe(sent + 1);
  });

  it('does not invite the connected account to its own event, and invites each person once even when named twice', async () => {
    const owner = await db.signUp(`cal-owner${++n}@example.com`);
    const member = await db.addMember(owner, `cal-member${n}@example.com`, 'member');
    google.email = `cal-member${n}@example.com`; // the account that signed in at Google is the member's
    await connect(owner, true);
    const made = await make(owner, member, { invitees: [{ type: 'user', id: member.userId }, { type: 'user', id: owner.userId }] });
    expect(made.status).toBe(201);
    const event = JSON.parse(calendarCalls().at(-1)!.body) as { attendees: { email: string }[] };
    expect(event.attendees.map(a => a.email)).toEqual([`cal-owner${n}@example.com`]);
    google.email = 'owner@gmail.com';
  });
});
