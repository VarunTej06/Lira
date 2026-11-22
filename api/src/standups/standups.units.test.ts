import { describe, expect, it } from 'vitest';
import { createStandupSchema, isMeetingLink, updateStandupSchema } from './schemas';

const id = '11111111-1111-4111-8111-111111111111';
const good = { title: 'Daily', startsAt: '2026-11-23T04:30:00Z', durationMinutes: 15, timeZone: 'Asia/Kolkata', link: 'https://meet.google.com/abc-defg-hij', invitees: [{ type: 'team', id }] };

describe('meeting links', () => {
  it('accept Google Meet and Microsoft Teams addresses over HTTPS only', () => {
    for (const ok of ['https://meet.google.com/abc-defg-hij', 'https://teams.microsoft.com/l/meetup-join/xyz', 'https://teams.live.com/meet/123', 'https://MEET.google.com/x']) expect(isMeetingLink(ok), ok).toBe(true);
  });

  it('refuse anything else: other sites, look-alikes, plain http, other schemes, hidden logins, and text that is not an address', () => {
    for (const bad of ['http://meet.google.com/x', 'https://evil.example/meet.google.com', 'https://meet.google.com.evil.example/x', 'https://user:pw@meet.google.com/x', 'javascript:alert(1)',
      'ftp://meet.google.com/x', 'meet.google.com/x', '', 'https://zoom.us/j/1', 'data:text/html,<script>1</script>']) expect(isMeetingLink(bad), bad).toBe(false);
  });
});

describe('stand-up schemas', () => {
  it('accept a whole stand-up', () => { expect(createStandupSchema.safeParse(good).success).toBe(true); });

  it('refuse unknown fields, no guests, a bad time, a length outside 5 minutes to 4 hours, and a link that is not a meeting', () => {
    for (const bad of [{ org_id: id }, { createdBy: id }, { invitees: [] }, { startsAt: 'tomorrow' }, { durationMinutes: 4 }, { durationMinutes: 241 }, { durationMinutes: 1.5 },
      { link: 'https://evil.example/x' }, { title: '  ' }, { invitees: [{ type: 'group', id }] }, { invitees: [{ type: 'user', id: 'x' }] }]) {
      expect(createStandupSchema.safeParse({ ...good, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('need something to change in an update, and check what is sent', () => {
    expect(updateStandupSchema.safeParse({}).success).toBe(false);
    expect(updateStandupSchema.safeParse({ title: 'New' }).success).toBe(true);
    expect(updateStandupSchema.safeParse({ link: 'https://evil.example' }).success).toBe(false);
    expect(updateStandupSchema.safeParse({ title: 'x', extra: 1 }).success).toBe(false);
  });
});

describe('repeating stand-ups', () => {
  it('need an end day when they repeat, and none when they do not', () => {
    expect(createStandupSchema.safeParse({ ...good, repeat: 'daily', repeatUntil: '2026-12-04' }).success).toBe(true);
    expect(createStandupSchema.safeParse({ ...good, repeat: 'weekdays' }).success).toBe(false);
    expect(createStandupSchema.safeParse({ ...good, repeat: 'none', repeatUntil: '2026-12-04' }).success).toBe(false);
    expect(createStandupSchema.safeParse({ ...good }).success).toBe(true);
  });

  it('may run for at most a year, and cannot end before they start', () => {
    expect(createStandupSchema.safeParse({ ...good, repeat: 'weekly', repeatUntil: '2027-11-23' }).success).toBe(true);
    expect(createStandupSchema.safeParse({ ...good, repeat: 'weekly', repeatUntil: '2027-11-25' }).success).toBe(false);
    expect(createStandupSchema.safeParse({ ...good, repeat: 'daily', repeatUntil: '2026-11-10' }).success).toBe(false);
  });

  it('refuse an unknown rule, a date that is not a date, and a time zone that does not exist', () => {
    for (const bad of [{ repeat: 'monthly', repeatUntil: '2026-12-04' }, { repeat: 'daily', repeatUntil: 'next week' }, { timeZone: 'Mars/Olympus' }, { timeZone: '' }]) {
      expect(createStandupSchema.safeParse({ ...good, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('can be changed to another rule or turned off in an update', () => {
    expect(updateStandupSchema.safeParse({ repeat: 'none' }).success).toBe(true);
    expect(updateStandupSchema.safeParse({ repeat: 'daily', repeatUntil: '2026-12-01', startsAt: '2026-11-23T04:30:00Z' }).success).toBe(true);
  });
});

describe('what a call is for', () => {
  it('names a space, project or sprint, or nothing for the whole organisation', () => {
    expect(createStandupSchema.safeParse({ ...good, scopeType: 'project', scopeId: 'proj-lira-core', scopeName: 'Lira Core' }).success).toBe(true);
    expect(createStandupSchema.safeParse({ ...good, scopeType: 'sprint', scopeId: '2026-11' }).success).toBe(true);
    expect(createStandupSchema.safeParse({ ...good, scopeType: 'org' }).success).toBe(true);
    expect(createStandupSchema.safeParse({ ...good }).success).toBe(true);
  });

  it('refuses a scope without an id, a whole-organisation call with one, a bad id and an unknown scope', () => {
    for (const bad of [{ scopeType: 'space' }, { scopeType: 'org', scopeId: 'x' }, { scopeId: 'x' }, { scopeType: 'project', scopeId: '../x' }, { scopeType: 'team', scopeId: 'x' }, { scopeType: 'project', scopeId: 'x', scopeName: 'n'.repeat(121) }]) {
      expect(createStandupSchema.safeParse({ ...good, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('keeps the scope fixed once a call is made: only its display name can change', () => {
    expect(updateStandupSchema.safeParse({ scopeName: 'Renamed project' }).success).toBe(true);
    expect(updateStandupSchema.safeParse({ scopeType: 'space' }).success).toBe(false);
    expect(updateStandupSchema.safeParse({ scopeId: 'other' }).success).toBe(false);
  });
});
