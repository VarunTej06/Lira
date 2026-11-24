import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { loadConfig } from '../config';
import { applyMigrations, readMigrations } from '../db/migrate';
import { FakeMailer } from '../testing/fake-mailer';
import { testSsl } from '../testing/realDb';

/** Confirming an address and resetting a password, on a real PostgreSQL (TEST_DATABASE_URL), with a fake email service. */
const ADMIN_URL = process.env.TEST_DATABASE_URL;
const ORIGIN = 'https://test.liraspaces.com';
const schema = `t_${randomBytes(6).toString('hex')}`;
const PASSWORD = 'a-long-enough-password';
const NEW_PASSWORD = 'a-brand-new-password';

function appUrl(): string {
  const url = new URL(ADMIN_URL!);
  url.searchParams.delete('sslmode');
  url.searchParams.set('options', `-c search_path=${schema} -c role=lira_app`);
  return url.toString();
}

describe.skipIf(!ADMIN_URL)('confirming an email address and resetting a password', () => {
  let app: NestExpressApplication;
  let base: string;
  let admin: Client;
  const mail = new FakeMailer();
  let nth = 0;

  const call = async (method: string, path: string, body?: unknown, extra: Record<string, string> = {}) => {
    const res = await fetch(`${base}${path}`, {
      method, headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Requested-With': 'liraspaces', ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* no body */ }
    return { status: res.status, body: parsed as Record<string, unknown>, cookie: res.headers.getSetCookie()[0] };
  };
  const cookieOf = (cookie: string | undefined) => ({ Cookie: `lira_session=${/lira_session=([^;]*)/.exec(cookie ?? '')?.[1] ?? ''}` });
  const rows = async <T extends object>(sql: string, params: unknown[] = []) => (await admin.query(sql, params)).rows as T[];
  const newAddress = () => `person${++nth}@example.com`;
  const signUp = async (email = newAddress()) => ({ email, ...(await call('POST', '/api/auth/signup', { name: 'Asha Rao', email, password: PASSWORD })) });
  const settle = () => new Promise(resolve => setTimeout(resolve, 150));

  beforeAll(async () => {
    const adminUrl = new URL(ADMIN_URL!);
    adminUrl.searchParams.delete('sslmode');
    admin = new Client({ connectionString: adminUrl.toString(), ssl: testSsl() });
    await admin.connect();
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.query(`SET search_path TO ${schema}`);
    await admin.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lira_app') THEN CREATE ROLE lira_app NOLOGIN; END IF; END $$");
    await admin.query('GRANT lira_app TO CURRENT_USER');
    await admin.query(`GRANT USAGE, CREATE ON SCHEMA ${schema} TO lira_app`);
    await applyMigrations(admin, readMigrations(join(__dirname, '..', '..', 'migrations')));
    await admin.query(`REVOKE CREATE ON SCHEMA ${schema} FROM lira_app`);
    app = await createApp(loadConfig({ DATABASE_URL: appUrl(), ALLOWED_ORIGINS: ORIGIN, TRUST_PROXY_HOPS: '0', DATABASE_SSL: testSsl() ? 'require' : 'disable' }), { systemMailer: mail });
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
  });

  afterAll(async () => {
    await app?.close();
    await admin?.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin?.end();
  });

  beforeEach(() => { mail.sent.length = 0; mail.accept = true; mail.enabled = true; });

  it('says at /api/auth/providers whether email is set up', async () => {
    expect((await call('GET', '/api/auth/providers')).body).toMatchObject({ email: true });
    mail.enabled = false;
    expect((await call('GET', '/api/auth/providers')).body).toMatchObject({ email: false });
  });

  it('emails a confirmation link at sign-up, and the link confirms the address once', async () => {
    const s = await signUp();
    expect(s.status).toBe(201);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]).toMatchObject({ to: s.email, subject: 'Confirm your email for Liraspaces' });
    expect(mail.sent[0].text).toContain(`${ORIGIN}/verify-email?token=`);
    expect(((await call('GET', '/api/me', undefined, cookieOf(s.cookie))).body.user as { emailVerified: boolean }).emailVerified).toBe(false);

    const token = mail.tokenFor(s.email)!;
    expect((await call('POST', '/api/auth/verify-email', { token })).status).toBe(204);
    expect(((await call('GET', '/api/me', undefined, cookieOf(s.cookie))).body.user as { emailVerified: boolean }).emailVerified).toBe(true);
    const again = await call('POST', '/api/auth/verify-email', { token });
    expect([again.status, again.body.error]).toEqual([400, expect.objectContaining({ code: 'invalid_token' })]);
    const stored = await rows<{ token_hash: string }>('SELECT token_hash FROM email_tokens');
    expect(stored.every(r => r.token_hash !== token && /^[0-9a-f]{64}$/.test(r.token_hash))).toBe(true);
    expect((await rows<{ action: string }>("SELECT action FROM audit_log WHERE action = 'auth.email_verified'")).length).toBeGreaterThan(0);
  });

  it('still signs the person up when the email cannot be sent', async () => {
    mail.accept = false;
    const s = await signUp();
    expect(s.status).toBe(201);
    expect(mail.sent).toHaveLength(0);
  });

  it('refuses a link that is expired, unknown, the wrong kind, or not shaped like one', async () => {
    const s = await signUp();
    const token = mail.tokenFor(s.email)!;
    await admin.query("UPDATE email_tokens SET expires_at = now() - interval '1 minute'");
    expect((await call('POST', '/api/auth/verify-email', { token })).status).toBe(400);
    expect((await call('POST', '/api/auth/verify-email', { token: randomBytes(32).toString('base64url') })).status).toBe(400);
    expect((await call('POST', '/api/auth/verify-email', { token: 'short' })).status).toBe(400);
    expect((await call('POST', '/api/auth/verify-email', { token, extra: 1 })).status).toBe(400);
    await call('POST', '/api/auth/forgot-password', { email: s.email });
    await settle();
    const resetToken = mail.tokenFor(s.email)!;
    expect((await call('POST', '/api/auth/verify-email', { token: resetToken })).status).toBe(400); // a reset link cannot confirm an address
  });

  it('sends a new confirmation link to the signed-in person, a few times an hour, and nothing once confirmed', async () => {
    const s = await signUp();
    expect((await call('POST', '/api/auth/resend-verification')).status).toBe(401);
    expect((await call('POST', '/api/auth/resend-verification', undefined, cookieOf(s.cookie))).status).toBe(204);
    expect((await call('POST', '/api/auth/resend-verification', undefined, cookieOf(s.cookie))).status).toBe(204);
    expect(mail.sent).toHaveLength(3); // sign-up and two more
    expect((await call('POST', '/api/auth/resend-verification', undefined, cookieOf(s.cookie))).status).toBe(429);
    await call('POST', '/api/auth/verify-email', { token: mail.tokenFor(s.email)! });
    mail.sent.length = 0;
    expect((await call('POST', '/api/auth/resend-verification', undefined, cookieOf(s.cookie))).status).toBe(204);
    expect(mail.sent).toHaveLength(0);
  });

  it('says plainly when email is not set up', async () => {
    const s = await signUp();
    mail.enabled = false;
    expect((await call('POST', '/api/auth/resend-verification', undefined, cookieOf(s.cookie))).status).toBe(503);
    const r = await call('POST', '/api/auth/forgot-password', { email: s.email });
    expect([r.status, r.body.error]).toEqual([503, expect.objectContaining({ code: 'email_not_set_up' })]);
  });

  it('gives the same answer for an address with an account and one without, and emails only the first', async () => {
    const s = await signUp();
    mail.sent.length = 0;
    const known = await call('POST', '/api/auth/forgot-password', { email: s.email.toUpperCase() });
    const unknown = await call('POST', '/api/auth/forgot-password', { email: 'nobody-here@example.com' });
    await settle();
    expect([known.status, known.body]).toEqual([unknown.status, unknown.body]);
    expect(known.status).toBe(204);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]).toMatchObject({ to: s.email, subject: 'Reset your Liraspaces password' });
    expect((await call('POST', '/api/auth/forgot-password', { email: 'not-an-email' })).status).toBe(400);
    expect((await call('POST', '/api/auth/forgot-password', { email: s.email, role: 'owner' })).status).toBe(400);
  });

  it('sets the new password with the link, once, signs out every session, and the old password stops working', async () => {
    const s = await signUp();
    const other = await call('POST', '/api/auth/login', { email: s.email, password: PASSWORD });
    await call('POST', '/api/auth/forgot-password', { email: s.email });
    await settle();
    const token = mail.tokenFor(s.email)!;
    mail.sent.length = 0;

    expect((await call('POST', '/api/auth/reset-password', { token, password: 'short' })).status).toBe(400);
    expect((await call('POST', '/api/auth/reset-password', { token, password: NEW_PASSWORD })).status).toBe(204);
    expect((await call('POST', '/api/auth/reset-password', { token, password: NEW_PASSWORD })).status).toBe(400); // works once
    expect((await call('GET', '/api/me', undefined, cookieOf(s.cookie))).status).toBe(401);
    expect((await call('GET', '/api/me', undefined, cookieOf(other.cookie))).status).toBe(401);
    expect((await call('POST', '/api/auth/login', { email: s.email, password: PASSWORD })).status).toBe(401);
    const fresh = await call('POST', '/api/auth/login', { email: s.email, password: NEW_PASSWORD });
    expect(fresh.status).toBe(200);
    expect(((await call('GET', '/api/me', undefined, cookieOf(fresh.cookie))).body.user as { emailVerified: boolean }).emailVerified).toBe(true); // the link proved the inbox
    expect(mail.sent.map(m => m.subject)).toEqual(['Your Liraspaces password was changed']);
    const audit = await rows<{ action: string }>("SELECT action FROM audit_log WHERE action LIKE 'auth.password_reset%' ORDER BY id DESC LIMIT 3");
    expect(audit.map(a => a.action)).toContain('auth.password_reset');
  });

  it('holds back more than three reset emails an hour for one account, and answers the same', async () => {
    const s = await signUp();
    mail.sent.length = 0;
    for (let i = 0; i < 5; i++) expect((await call('POST', '/api/auth/forgot-password', { email: s.email })).status).toBe(204);
    await settle();
    expect(mail.sent).toHaveLength(3);
  });

  it('does not let a verification link reset a password, and ends nothing when the link is wrong', async () => {
    const s = await signUp();
    const verifyToken = mail.tokenFor(s.email)!;
    expect((await call('POST', '/api/auth/reset-password', { token: verifyToken, password: NEW_PASSWORD })).status).toBe(400);
    expect((await call('GET', '/api/me', undefined, cookieOf(s.cookie))).status).toBe(200);
    expect((await call('POST', '/api/auth/login', { email: s.email, password: PASSWORD })).status).toBe(200);
  });

  it('never gives a person who signs in with Google a password: they get an email that says so, and no link', async () => {
    const email = newAddress();
    await admin.query("INSERT INTO users (email, name, google_sub, email_verified) VALUES ($1, 'Pat', $2, true)", [email, `sub-${nth}`]);
    const known = await call('POST', '/api/auth/forgot-password', { email });
    const unknown = await call('POST', '/api/auth/forgot-password', { email: 'nobody-else@example.com' });
    await settle();
    expect([known.status, known.body]).toEqual([unknown.status, unknown.body]); // nothing to tell them apart from outside
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]).toMatchObject({ to: email, subject: 'Signing in to Liraspaces' });
    expect(mail.sent[0].text).toContain('press the Google button');
    expect(mail.tokenFor(email)).toBeUndefined();
    expect(await rows("SELECT 1 FROM email_tokens WHERE kind = 'reset' AND user_id = (SELECT id FROM users WHERE email = $1)", [email])).toHaveLength(0);
    expect((await call('POST', '/api/auth/login', { email, password: NEW_PASSWORD })).status).toBe(401);
  });

  it('refuses an old reset link once the account signs in with Google, and sets no password', async () => {
    const s = await signUp();
    await call('POST', '/api/auth/forgot-password', { email: s.email });
    await settle();
    const token = mail.tokenFor(s.email)!;
    await admin.query("UPDATE users SET google_sub = $2, password_hash = NULL WHERE email = $1", [s.email, `sub-late-${nth}`]);
    expect((await call('POST', '/api/auth/reset-password', { token, password: NEW_PASSWORD })).status).toBe(400);
    expect((await rows<{ password_hash: string | null }>('SELECT password_hash FROM users WHERE email = $1', [s.email]))[0].password_hash).toBeNull();
  });

  it('asks an unconfirmed person to confirm before they join an organisation, but only when email works', async () => {
    const owner = await signUp();
    const me = (await call('GET', '/api/me', undefined, cookieOf(owner.cookie))).body as { organisations: { orgId: string }[] };
    const guest = newAddress();
    const invited = await call('POST', `/api/orgs/${me.organisations[0].orgId}/invitations`, { email: guest, role: 'member' }, cookieOf(owner.cookie));
    const token = (invited.body as { token: string }).token;
    const g = await signUp(guest);
    const refused = await call('POST', '/api/invitations/accept', { token }, cookieOf(g.cookie));
    expect([refused.status, refused.body.error]).toEqual([403, expect.objectContaining({ code: 'email_not_verified' })]);
    await call('POST', '/api/auth/verify-email', { token: mail.tokenFor(guest)! });
    expect((await call('POST', '/api/invitations/accept', { token }, cookieOf(g.cookie))).status).toBe(200);
  });
});
