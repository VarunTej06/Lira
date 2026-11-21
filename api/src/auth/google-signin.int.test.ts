import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeGoogle } from '../testing/fake-google';
import { ADMIN_URL, startRealDb, type RealDb } from '../testing/realDb';

describe.skipIf(!ADMIN_URL)('signing up and in with Google, on a real database', () => {
  const google = new FakeGoogle();
  let db: RealDb;
  beforeAll(async () => { db = await startRealDb({ google }); });
  afterAll(async () => { await db?.stop(); });

  const cookieOf = (setCookie: string | undefined) => /lira_oauth=([^;]*)/.exec(setCookie ?? '')?.[1] ?? '';
  const params = (url: string) => new URL(url).searchParams;

  /** The person presses the Google button, and is sent to Google. */
  const start = async (intent?: 'signup') => {
    const r = await db.call('GET', `/api/auth/google/start${intent ? `?intent=${intent}` : ''}`);
    return { r, url: r.location!, cookie: cookieOf(r.cookie), p: params(r.location!) };
  };
  /** Google sends the person back. `token` is what Google will give in exchange for the code. */
  const comeBack = async (s: Awaited<ReturnType<typeof start>>, token: (nonce: string) => string | null, extra: { state?: string; cookie?: string; code?: string | null } = {}) => {
    google.idToken = token(s.p.get('nonce')!);
    const code = extra.code === null ? '' : `code=${extra.code ?? 'abc'}&`;
    return db.call('GET', `/api/auth/google/callback?${code}state=${encodeURIComponent(extra.state ?? s.p.get('state')!)}`, undefined, { Cookie: `lira_oauth=${extra.cookie ?? s.cookie}` });
  };
  const signIn = (claims: Record<string, unknown> = {}) => async (nonce: string) => google.signIdToken({ nonce, ...claims });
  const asToken = (claims: Record<string, unknown>, options?: { withOtherKey?: boolean; alg?: string }) => (nonce: string) => google.signIdToken({ nonce, ...claims }, options);
  const session = (setCookie: string | undefined) => ({ Cookie: `lira_session=${/lira_session=([^;]*)/.exec(setCookie ?? '')?.[1] ?? ''}` });

  it('says Google is offered, and starts the sign-in with the right request: code flow, PKCE, a state and a nonce, and a signed cookie', async () => {
    expect((await db.call('GET', '/api/auth/providers')).body).toEqual({ google: true });
    const s = await start();
    expect(s.r.status).toBe(302);
    expect(s.url.startsWith('https://accounts.google.com/o/oauth2/v2/auth?')).toBe(true);
    expect(s.p.get('response_type')).toBe('code');
    expect(s.p.get('scope')).toBe('openid email profile');
    expect(s.p.get('code_challenge_method')).toBe('S256');
    expect(s.p.get('redirect_uri')).toBe('https://test.liraspaces.com/api/auth/google/callback');
    expect(s.p.get('client_id')).toBe('client-id-123456');
    for (const name of ['state', 'nonce', 'code_challenge']) expect(s.p.get(name)!.length, name).toBeGreaterThanOrEqual(30);
    expect(s.url).not.toContain('client-secret');
    expect(s.r.cookie).toMatch(/^lira_oauth=.+; Max-Age=600; Path=\/api\/auth\/google; HttpOnly; SameSite=Lax; Secure$/);
    const again = await start();
    expect([again.p.get('state'), again.p.get('nonce')]).not.toEqual([s.p.get('state'), s.p.get('nonce')]);
  });

  it('makes a new person an account, an organisation of one as owner and a session, with no password, and proves the PKCE secret was sent', async () => {
    const s = await start();
    const back = await comeBack(s, asToken({ sub: 'sub-new', email: 'New.Person@Gmail.com', name: 'Nia Person' }));
    expect(back.status).toBe(302);
    expect(back.location).toBe('https://test.liraspaces.com/app');
    expect(back.cookie).toBeDefined();
    const me = (await db.call('GET', '/api/me', undefined, session(back.cookie))).body as { user: { email: string; name: string }; organisations: { role: string }[] };
    expect(me.user).toMatchObject({ email: 'new.person@gmail.com', name: 'Nia Person' });
    expect(me.organisations.map(o => o.role)).toEqual(['owner']);
    const [row] = await db.rows<{ password_hash: string | null; google_sub: string; email_verified: boolean }>("SELECT password_hash, google_sub, email_verified FROM users WHERE email = 'new.person@gmail.com'");
    expect(row).toEqual({ password_hash: null, google_sub: 'sub-new', email_verified: true });
    const exchange = google.requests.filter(r => r.body.includes('grant_type=authorization_code')).at(-1)!;
    const verifier = new URLSearchParams(exchange.body).get('code_verifier')!;
    expect(createHash('sha256').update(verifier).digest('base64url')).toBe(s.p.get('code_challenge'));
    expect(new URLSearchParams(exchange.body).get('redirect_uri')).toBe('https://test.liraspaces.com/api/auth/google/callback');
    expect(back.cookie).toMatch(/lira_session=[A-Za-z0-9_-]{43}; Max-Age=43200; Path=\/; HttpOnly; SameSite=Lax; Secure/);
    expect((await db.rows("SELECT 1 FROM audit_log WHERE action = 'auth.google.signup'")).length).toBeGreaterThan(0);
  });

  it('recognises a returning person by their Google id, even when their address at Google has changed, without making a second account', async () => {
    await comeBack(await start(), asToken({ sub: 'sub-return', email: 'return@gmail.com' }));
    const before = (await db.rows('SELECT 1 FROM users')).length;
    const orgs = (await db.rows('SELECT 1 FROM organisations')).length;
    const back = await comeBack(await start(), asToken({ sub: 'sub-return', email: 'return@gmail.com' }));
    expect(back.location).toBe('https://test.liraspaces.com/app');
    expect((await db.rows('SELECT 1 FROM users')).length).toBe(before);
    expect((await db.rows('SELECT 1 FROM organisations')).length).toBe(orgs);
    const moved = await comeBack(await start(), asToken({ sub: 'sub-return', email: 'renamed@gmail.com' }));
    expect(moved.location).toBe('https://test.liraspaces.com/app');
    expect((await db.rows('SELECT 1 FROM users')).length).toBe(before);
    expect((await db.rows("SELECT 1 FROM audit_log WHERE action = 'auth.google.login'")).length).toBeGreaterThan(1);
  });

  it('takes over an account made earlier with a password for the same address: the person proves they own it, the password stops working and old sessions end', async () => {
    const earlier = await db.signUp('taken@gmail.com'); // someone signed up with this address and a password, nobody proved the address
    expect((await db.call('GET', '/api/me', undefined, earlier.session)).status).toBe(200);
    const back = await comeBack(await start(), asToken({ sub: 'sub-taken', email: 'taken@gmail.com', name: 'Real Owner' }));
    expect(back.location).toBe('https://test.liraspaces.com/app');
    expect((await db.rows('SELECT 1 FROM users WHERE lower(email) = $1', ['taken@gmail.com'])).length).toBe(1);
    const [row] = await db.rows<{ password_hash: string | null; google_sub: string; email_verified: boolean }>("SELECT password_hash, google_sub, email_verified FROM users WHERE email = 'taken@gmail.com'");
    expect(row).toEqual({ password_hash: null, google_sub: 'sub-taken', email_verified: true });
    expect((await db.call('GET', '/api/me', undefined, earlier.session)).status).toBe(401); // the earlier session is gone
    const password = await db.call('POST', '/api/auth/login', { email: 'taken@gmail.com', password: 'a-long-enough-password' });
    expect(password.status).toBe(401);
    expect(JSON.stringify(password.body)).toContain('The email or password is not correct.');
    expect((await db.rows("SELECT 1 FROM audit_log WHERE action = 'auth.google.link'")).length).toBe(1);
  });

  it('keeps a person who signed up with Google from being asked for a password, and answers as for any wrong login', async () => {
    await comeBack(await start(), asToken({ sub: 'sub-only', email: 'googleonly@gmail.com' }));
    const login = await db.call('POST', '/api/auth/login', { email: 'googleonly@gmail.com', password: 'anything-long-enough' });
    const unknown = await db.call('POST', '/api/auth/login', { email: 'nobody-here@gmail.com', password: 'anything-long-enough' });
    expect([login.status, unknown.status]).toEqual([401, 401]);
    expect(login.body).toEqual(unknown.body);
  });

  describe('refuses, with only a plain "try again" for the person and nothing made', () => {
    const refuses = async (label: string, run: () => Promise<{ status: number; location: string | null; cookie: string | undefined }>) => {
      const users = (await db.rows('SELECT 1 FROM users')).length;
      const sessions = (await db.rows('SELECT 1 FROM sessions')).length;
      const r = await run();
      expect([r.status, r.location], label).toEqual([302, 'https://test.liraspaces.com/login?error=google']);
      expect(r.cookie ?? '', label).not.toContain('lira_session');
      expect((await db.rows('SELECT 1 FROM users')).length, label).toBe(users);
      expect((await db.rows('SELECT 1 FROM sessions')).length, label).toBe(sessions);
    };

    it('a callback this browser did not start: no cookie, a cookie that was changed, another state, no code, no state', async () => {
      const s = await start();
      await refuses('no cookie', () => db.call('GET', `/api/auth/google/callback?code=abc&state=${s.p.get('state')}`));
      await refuses('altered cookie', () => comeBack(s, signIn(), { cookie: `${s.cookie.slice(0, -3)}AAA` }));
      await refuses('other cookie', async () => comeBack(s, signIn(), { cookie: (await start()).cookie }));
      await refuses('other state', () => comeBack(s, signIn(), { state: 'some-other-state-value' }));
      await refuses('no code', () => comeBack(s, signIn(), { code: null }));
      await refuses('error from Google', () => db.call('GET', '/api/auth/google/callback?error=access_denied', undefined, { Cookie: `lira_oauth=${s.cookie}` }));
      await refuses('nothing', () => db.call('GET', '/api/auth/google/callback'));
    });

    it('a token that is not right: another nonce, another app, another issuer, expired, an email Google has not verified, signed by another key, or with no signature algorithm', async () => {
      await refuses('nonce', async () => comeBack(await start(), () => google.signIdToken({ nonce: 'a-different-nonce' })));
      await refuses('audience', async () => comeBack(await start(), asToken({ aud: 'another-apps-client' })));
      await refuses('issuer', async () => comeBack(await start(), asToken({ iss: 'https://evil.example' })));
      await refuses('expired', async () => comeBack(await start(), asToken({ exp: Math.floor(Date.now() / 1000) - 10 })));
      await refuses('unverified email', async () => comeBack(await start(), asToken({ email_verified: false })));
      await refuses('other key', async () => comeBack(await start(), asToken({}, { withOtherKey: true })));
      await refuses('none', async () => comeBack(await start(), asToken({}, { alg: 'none' })));
      await refuses('no token', async () => comeBack(await start(), () => null));
    });

    it('a code Google will not exchange', async () => {
      google.failExchange = true;
      await refuses('exchange', async () => comeBack(await start(), signIn()));
      google.failExchange = false;
    });

    it('and records each refusal, without the token, the code or the address', async () => {
      const rows = await db.rows<{ detail: Record<string, string> }>("SELECT detail FROM audit_log WHERE action = 'auth.google' AND outcome = 'denied'");
      expect(rows.length).toBeGreaterThan(10);
      expect(new Set(rows.map(r => r.detail.reason))).toEqual(new Set(['state', 'token', 'exchange']));
      expect(JSON.stringify(rows)).not.toMatch(/@|abc|eyJ/);
    });
  });

  describe('signing up asks once for everything a new owner needs, and keeps it', () => {
    const FULL = 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/meetings.space.created https://www.googleapis.com/auth/gmail.send';
    const ownerOrg = async (cookie: string | undefined) => ((await db.call('GET', '/api/me', undefined, session(cookie))).body as { organisations: { orgId: string }[] }).organisations[0].orgId;
    const connectionOf = async (orgId: string) => (await db.rows<{ google_email: string; refresh_token: string }>('SELECT google_email, refresh_token FROM google_connections WHERE org_id = $1', [orgId]))[0];
    const reset = () => { google.grantedScope = FULL; google.omitRefreshToken = false; };

    it('asks for the Meet and email permissions, and offline access, only on the sign-up button; the log-in button asks only who the person is', async () => {
      const signup = await start('signup');
      expect(signup.p.get('scope')!.split(' ').sort()).toEqual(['email', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/meetings.space.created', 'openid', 'profile']);
      expect(signup.p.get('access_type')).toBe('offline');
      expect(signup.p.get('prompt')).toBe('consent select_account');
      const login = await start();
      expect(login.p.get('scope')).toBe('openid email profile');
      expect(login.p.get('access_type')).toBeNull();
      expect((await start('signup' as never)).p.get('access_type')).toBe('offline');
      expect((await db.call('GET', '/api/auth/google/start?intent=something-else')).location).not.toContain('gmail.send');
    });

    it('connects the new owner\'s Google account for Meet links and email, encrypted, with no second step, so a call can be made with no pasted link', async () => {
      reset();
      const s = await start('signup');
      const back = await comeBack(s, asToken({ sub: 'sub-su-1', email: 'owner.su@gmail.com', name: 'Olga Owner' }));
      expect(back.location).toBe('https://test.liraspaces.com/app');
      const orgId = await ownerOrg(back.cookie);
      const conn = await connectionOf(orgId);
      expect(conn.google_email).toBe('owner.su@gmail.com');
      expect(conn.refresh_token).toMatch(/^v1\./);
      expect(conn.refresh_token).not.toContain('refresh-secret-1');
      expect((await db.call('GET', `/api/orgs/${orgId}/google`, undefined, session(back.cookie))).body).toEqual({ configured: true, connected: true, email: 'owner.su@gmail.com' });
      const call = await db.call('POST', `/api/orgs/${orgId}/standups`, { title: 'Daily', startsAt: '2026-11-23T04:30:00Z', durationMinutes: 15, timeZone: 'UTC', invitees: [{ type: 'user', id: ((await db.call('GET', '/api/me', undefined, session(back.cookie))).body as { user: { id: string } }).user.id }] }, session(back.cookie));
      expect(call.status).toBe(201);
      expect(call.body).toMatchObject({ linkSource: 'meet' });
      expect((await db.rows("SELECT detail FROM audit_log WHERE action = 'google.connect' AND org_id = $1", [orgId]))[0].detail).toEqual({ via: 'sign-up' });
    });

    it('keeps nothing when the person did not agree to every permission, or Google gave no refresh token', async () => {
      for (const [label, set] of [['no email permission', () => { google.grantedScope = FULL.replace('https://www.googleapis.com/auth/gmail.send', ''); }], ['no Meet permission', () => { google.grantedScope = FULL.replace('https://www.googleapis.com/auth/meetings.space.created', ''); }], ['no refresh token', () => { google.omitRefreshToken = true; }]] as const) {
        reset(); set();
        const back = await comeBack(await start('signup'), asToken({ sub: `sub-partial-${label}`, email: `partial${label.length}@gmail.com` }));
        expect(back.location, label).toBe('https://test.liraspaces.com/app');
        expect(await connectionOf(await ownerOrg(back.cookie)), label).toBeUndefined();
      }
      reset();
    });

    it('keeps nothing when the person only logged in, whatever Google sent back', async () => {
      reset();
      const back = await comeBack(await start(), asToken({ sub: 'sub-login-only', email: 'loginonly@gmail.com' }));
      expect(await connectionOf(await ownerOrg(back.cookie))).toBeUndefined();
    });

    it('replaces the connection of an owner who signs up with Google again, with the account they used now', async () => {
      reset();
      const first = await comeBack(await start('signup'), asToken({ sub: 'sub-again', email: 'again@gmail.com' }));
      const orgId = await ownerOrg(first.cookie);
      const before = await connectionOf(orgId);
      await comeBack(await start('signup'), asToken({ sub: 'sub-again', email: 'again@gmail.com' }));
      const after = await connectionOf(orgId);
      expect(after.google_email).toBe('again@gmail.com');
      expect(after.refresh_token).not.toBe(before.refresh_token); // a fresh nonce each time it is encrypted
    });

    it('does not turn on the connection of an organisation the person does not own', async () => {
      reset();
      const owner = await db.signUp('someone-else-owner@example.com');
      const member = await comeBack(await start(), asToken({ sub: 'sub-member', email: 'member@gmail.com' }));
      const memberId = ((await db.call('GET', '/api/me', undefined, session(member.cookie))).body as { user: { id: string } }).user.id;
      await db.admin.query("INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'member')", [owner.orgId, memberId]);
      expect(await connectionOf(owner.orgId)).toBeUndefined();
    });
  });

  it('only ever calls the fixed Google addresses, and the callback needs no session', async () => {
    const allowed = ['https://oauth2.googleapis.com/', 'https://openidconnect.googleapis.com/', 'https://www.googleapis.com/oauth2/v3/certs', 'https://meet.googleapis.com/', 'https://gmail.googleapis.com/'];
    expect(google.requests.every(r => allowed.some(a => r.url.startsWith(a)))).toBe(true);
    expect(google.requests.filter(r => r.url.endsWith('/certs')).length).toBeLessThanOrEqual(3); // the keys are kept, not fetched for every sign-in
  });
});
