import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeGoogle } from '../testing/fake-google';
import { ADMIN_URL, startRealDb, type RealDb } from '../testing/realDb';

describe.skipIf(!ADMIN_URL)('Google connection, Meet links and invitation emails on a real database', () => {
  const google = new FakeGoogle();
  let db: RealDb;
  beforeAll(async () => { db = await startRealDb({ google }); });
  afterAll(async () => { await db?.stop(); });

  type Person = Awaited<ReturnType<RealDb['signUp']>>;
  const base = (p: Person) => `/api/orgs/${p.orgId}/google`;
  const stateOf = (url: string) => new URL(url).searchParams.get('state')!;
  /** The owner signs in at Google and is sent back with a code. */
  const connect = async (owner: Person) => {
    const started = await db.call('POST', `${base(owner)}/connect`, undefined, owner.session);
    const back = await db.call('GET', `/api/google/callback?code=abc&state=${encodeURIComponent(stateOf((started.body as { url: string }).url))}`, undefined, owner.session);
    return { started, back };
  };
  const standup = (p: Person, body: object) => db.call('POST', `/api/orgs/${p.orgId}/standups`, {
    title: 'Daily', startsAt: '2026-11-23T04:30:00Z', durationMinutes: 15, timeZone: 'Asia/Kolkata', ...body,
  }, p.session);

  it('starts the sign-in with exactly the permissions it needs, a signed state, and no secret in the address', async () => {
    const owner = await db.signUp('g-start@example.com');
    expect((await db.call('GET', base(owner), undefined, owner.session)).body).toEqual({ configured: true, connected: false, email: null });
    const started = await db.call('POST', `${base(owner)}/connect`, undefined, owner.session);
    const url = new URL((started.body as { url: string }).url);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('scope')!.split(' ').sort()).toEqual(['email', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/meetings.space.created', 'openid']);
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('redirect_uri')).toContain('/api/google/callback');
    expect(url.toString()).not.toContain('client-secret');
  });

  it('connects the account after the callback, keeps only an encrypted refresh token, and sends the owner back to the stand-ups page', async () => {
    const owner = await db.signUp('g-connect@example.com');
    const { back } = await connect(owner);
    expect(back.status).toBe(302);
    expect(back.location).toBe('https://test.liraspaces.com/app/calls?google=connected');
    expect((await db.call('GET', base(owner), undefined, owner.session)).body).toEqual({ configured: true, connected: true, email: 'owner@gmail.com' });
    const stored = await db.rows<{ refresh_token: string }>('SELECT refresh_token FROM google_connections WHERE org_id = $1', [owner.orgId]);
    expect(stored[0].refresh_token).toMatch(/^v1\./);
    expect(stored[0].refresh_token).not.toContain('refresh-secret-1');
    const exchange = google.requests.find(r => r.body.includes('grant_type=authorization_code'))!;
    expect(exchange.body).toContain('client_secret=client-secret-123456');
    expect((await db.rows("SELECT 1 FROM audit_log WHERE org_id = $1 AND action = 'google.connect'", [owner.orgId])).length).toBe(1);
  });

  it('refuses a forged or reused state, a callback by someone else, one without a code, and a person who is not the owner', async () => {
    const owner = await db.signUp('g-forge@example.com');
    const member = await db.addMember(owner, 'g-forge-m@example.com', 'member');
    const started = await db.call('POST', `${base(owner)}/connect`, undefined, owner.session);
    const state = encodeURIComponent(stateOf((started.body as { url: string }).url));
    const where = async (path: string, who: Person) => (await db.call('GET', path, undefined, who.session)).location;
    expect(await where('/api/google/callback?code=abc&state=forged.value', owner)).toContain('google=failed');
    expect(await where(`/api/google/callback?code=abc&state=${state}`, member)).toContain('google=failed'); // a different person's session
    expect(await where(`/api/google/callback?state=${state}`, owner)).toContain('google=refused');
    expect(await where('/api/google/callback?error=access_denied&state=x', owner)).toContain('google=refused');
    expect((await db.call('GET', '/api/google/callback?code=abc&state=x')).status).toBe(401);
    expect((await db.call('POST', `${base(owner)}/connect`, undefined, member.session)).status).toBe(403);
    expect((await db.call('GET', base(owner), undefined, member.session)).status).toBe(403);
    expect((await db.rows('SELECT 1 FROM google_connections WHERE org_id = $1', [owner.orgId])).length).toBe(0);
  });

  it('keeps organisations apart: one cannot start, read or remove the connection of another', async () => {
    const a = await db.signUp('g-a@example.com');
    const b = await db.signUp('g-b@example.com');
    await connect(b);
    expect((await db.call('GET', base(b), undefined, a.session)).status).toBe(404);
    expect((await db.call('POST', `${base(b)}/connect`, undefined, a.session)).status).toBe(404);
    expect((await db.call('DELETE', base(b), undefined, a.session)).status).toBe(404);
    expect(((await db.call('GET', base(a), undefined, a.session)).body as { connected: boolean }).connected).toBe(false);
    // a state made for A and used by B's session is not accepted for B's organisation
    const startedForA = await db.call('POST', `${base(a)}/connect`, undefined, a.session);
    const stolen = await db.call('GET', `/api/google/callback?code=abc&state=${encodeURIComponent(stateOf((startedForA.body as { url: string }).url))}`, undefined, b.session);
    expect(stolen.location).toContain('google=failed');
  });

  it('makes the Meet link itself when no link is pasted, sends one email per invited person from the connected account, and says how many went out', async () => {
    const owner = await db.signUp('g-meet@example.com');
    const a = await db.addMember(owner, 'g-meet-a@example.com', 'member');
    const b = await db.addMember(owner, 'g-meet-b@example.com', 'viewer');
    await connect(owner);
    const before = google.sentEmails().length;
    const made = await standup(owner, { invitees: [{ type: 'user', id: a.userId }, { type: 'user', id: b.userId }] });
    expect(made.status).toBe(201);
    expect(made.body).toMatchObject({ linkSource: 'meet', emailed: { sent: 2, total: 2 } });
    const link = (made.body as { link: string }).link;
    expect(link).toMatch(/^https:\/\/meet\.google\.com\//);
    const mails = google.sentEmails().slice(before);
    expect(mails.map(m => m.to).sort()).toEqual(['g-meet-a@example.com', 'g-meet-b@example.com']);
    expect(mails[0].from).toBe('owner@gmail.com');
    expect(mails[0].text).toContain(link);
    expect(mails[0].text).toContain('Asia/Kolkata');
    const call = google.requests.filter(r => r.url === 'https://meet.googleapis.com/v2/spaces').at(-1)!;
    expect(call.authorization).toBe('Bearer access-2');
    expect((await db.rows<{ audit: string }>("SELECT detail::text AS audit FROM audit_log WHERE org_id = $1 AND action = 'standup.create'", [owner.orgId]))[0].audit).not.toContain('meet.google.com');
  });

  it('uses a pasted link when there is one, and does not ask Google for a Meet link', async () => {
    const owner = await db.signUp('g-paste@example.com');
    await connect(owner);
    const before = google.requests.filter(r => r.url === 'https://meet.googleapis.com/v2/spaces').length;
    const made = await standup(owner, { link: 'https://teams.microsoft.com/l/meetup-join/xyz', invitees: [{ type: 'user', id: owner.userId }] });
    expect(made.body).toMatchObject({ linkSource: 'pasted', link: 'https://teams.microsoft.com/l/meetup-join/xyz' });
    expect(google.requests.filter(r => r.url === 'https://meet.googleapis.com/v2/spaces').length).toBe(before);
  });

  it('asks for a pasted link, and stores nothing, when Google is not connected or will not make one', async () => {
    const owner = await db.signUp('g-none@example.com');
    const refused = await standup(owner, { invitees: [{ type: 'user', id: owner.userId }] });
    expect(refused.status).toBe(400);
    expect(JSON.stringify(refused.body)).toContain('connect Google');
    await connect(owner);
    google.failMeet = true;
    expect((await standup(owner, { invitees: [{ type: 'user', id: owner.userId }] })).status).toBe(400);
    google.failMeet = false;
    expect((await db.rows('SELECT 1 FROM standup_calls WHERE org_id = $1', [owner.orgId])).length).toBe(0);
  });

  it('still makes the call when Gmail refuses, and says nobody was emailed', async () => {
    const owner = await db.signUp('g-mail@example.com');
    const a = await db.addMember(owner, 'g-mail-a@example.com', 'member');
    await connect(owner);
    google.failGmail = true;
    const made = await standup(owner, { invitees: [{ type: 'user', id: a.userId }] });
    google.failGmail = false;
    expect(made.status).toBe(201);
    expect(made.body).toMatchObject({ emailed: { sent: 0, total: 1 } });
  });

  it('sends invitations through Google too, and falls back to the link when the refresh fails', async () => {
    const owner = await db.signUp('g-invite@example.com');
    await connect(owner);
    const before = google.sentEmails().length;
    const r = await db.call('POST', `/api/orgs/${owner.orgId}/invitations`, { email: 'newbie@example.com', role: 'member' }, owner.session);
    expect(r.body).toMatchObject({ emailed: true });
    expect(google.sentEmails().slice(before)[0].to).toBe('newbie@example.com');
    google.failRefresh = true;
    // the cached access token is still good, so make a different organisation (no cache) fail
    const other = await db.signUp('g-invite-2@example.com');
    await connect(other);
    google.failRefresh = true;
    expect((await db.call('POST', `/api/orgs/${other.orgId}/invitations`, { email: 'another@example.com', role: 'member' }, other.session)).body).toMatchObject({ emailed: false });
    google.failRefresh = false;
  });

  it('disconnects, revokes the token at Google, and the app can no longer make links or send email', async () => {
    const owner = await db.signUp('g-off@example.com');
    await connect(owner);
    expect((await db.call('DELETE', base(owner), undefined, owner.session)).status).toBe(204);
    expect(google.requests.some(r => r.url.startsWith('https://oauth2.googleapis.com/revoke') && r.url.includes('refresh-secret-1'))).toBe(true);
    expect((await db.call('GET', base(owner), undefined, owner.session)).body).toMatchObject({ connected: false });
    expect((await db.rows('SELECT 1 FROM google_connections WHERE org_id = $1', [owner.orgId])).length).toBe(0);
    expect((await standup(owner, { invitees: [{ type: 'user', id: owner.userId }] })).status).toBe(400);
  });

  it('only ever calls the fixed Google addresses', async () => {
    const allowed = ['https://oauth2.googleapis.com/', 'https://openidconnect.googleapis.com/', 'https://meet.googleapis.com/', 'https://gmail.googleapis.com/'];
    expect(google.requests.length).toBeGreaterThan(5);
    expect(google.requests.every(r => allowed.some(a => r.url.startsWith(a)))).toBe(true);
  });
});
