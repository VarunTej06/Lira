import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { loadConfig } from '../config';
import { applyMigrations, readMigrations } from '../db/migrate';
import { testSsl } from '../testing/realDb';

/**
 * Tests against a real PostgreSQL. Set TEST_DATABASE_URL to the server admin's connection; without it these are skipped.
 * Everything happens in a schema of its own that is dropped at the end. The application role is used through `role=lira_app`,
 * so its real permissions are tested and its password is never touched.
 */
const ADMIN_URL = process.env.TEST_DATABASE_URL;
const ORIGIN = 'https://test.liraspaces.com';
const schema = `t_${randomBytes(6).toString('hex')}`;

function appUrl(): string {
  const url = new URL(ADMIN_URL!);
  url.searchParams.delete('sslmode');
  url.searchParams.set('options', `-c search_path=${schema} -c role=lira_app`);
  return url.toString();
}

interface Reply { status: number; body: unknown; cookie: string | undefined; headers: Headers }

describe.skipIf(!ADMIN_URL)('sign-up, log-in and sessions on a real database', () => {
  let app: NestExpressApplication;
  let base: string;
  let admin: Client;
  let appPool: Pool;

  const call = async (method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<Reply> => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Requested-With': 'liraspaces', ...extra },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* plain text */ }
    return { status: res.status, body: parsed, cookie: res.headers.getSetCookie()[0], headers: res.headers };
  };
  const tokenOf = (cookie: string | undefined) => /lira_session=([^;]*)/.exec(cookie ?? '')?.[1] ?? '';
  const cookieHeader = (cookie: string | undefined) => ({ Cookie: `lira_session=${tokenOf(cookie)}` });
  const rows = async <T extends object>(sql: string, params: unknown[] = []) => (await admin.query(sql, params)).rows as T[];
  const good = (email: string) => ({ name: 'Asha Rao', email, password: 'a-long-enough-password' });

  beforeAll(async () => {
    const adminUrl = new URL(ADMIN_URL!);
    adminUrl.searchParams.delete('sslmode');
    admin = new Client({ connectionString: adminUrl.toString(), ssl: testSsl() });
    await admin.connect();
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.query(`SET search_path TO ${schema}`);
    await admin.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lira_app') THEN CREATE ROLE lira_app NOLOGIN; END IF; END $$");
    await admin.query('GRANT lira_app TO CURRENT_USER');
    await admin.query(`GRANT USAGE, CREATE ON SCHEMA ${schema} TO lira_app`); // the test schema only; the real schema never gets CREATE
    await applyMigrations(admin, readMigrations(join(__dirname, '..', '..', 'migrations')));
    await admin.query(`REVOKE CREATE ON SCHEMA ${schema} FROM lira_app`);

    app = await createApp(loadConfig({ DATABASE_URL: appUrl(), ALLOWED_ORIGINS: ORIGIN, TRUST_PROXY_HOPS: '0', DATABASE_SSL: testSsl() ? 'require' : 'disable' }));
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
    appPool = new Pool({ connectionString: appUrl(), ssl: testSsl() });
  });

  afterAll(async () => {
    await app?.close();
    await appPool?.end();
    await admin?.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin?.end();
  });

  it('says Google sign-in is not offered when Google is not set up, and sends anyone who tries it to the log-in page', async () => {
    expect((await call('GET', '/api/auth/providers')).body).toEqual({ google: false, email: false });
    const started = await fetch(`${base}/api/auth/google/start`, { redirect: 'manual' });
    expect([started.status, started.headers.get('location')]).toEqual([302, `${ORIGIN}/login?error=google`]);
    const back = await fetch(`${base}/api/auth/google/callback?code=abc&state=x`, { redirect: 'manual' });
    expect([back.status, back.headers.get('location')]).toEqual([302, `${ORIGIN}/login?error=google`]);
  });

  it('answers the liveness and readiness checks', async () => {
    expect((await call('GET', '/health')).body).toEqual({ status: 'ok' });
    expect((await call('GET', '/ready')).body).toEqual({ status: 'ready', database: 'up' });
  });

  it('signs a person up: an account, an organisation of one with them as owner, and a session in a safe cookie', async () => {
    const r = await call('POST', '/api/auth/signup', good('Asha@Example.com'));
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ user: { email: 'asha@example.com', name: 'Asha Rao' }, organisations: [{ role: 'owner' }] });
    expect(JSON.stringify(r.body)).not.toMatch(/password|argon2/i);
    expect(r.cookie).toMatch(/^lira_session=[A-Za-z0-9_-]{43}; Max-Age=43200; Path=\/; HttpOnly; SameSite=Lax; Secure$/);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const [user] = await rows<{ password_hash: string; id: string }>("SELECT id, password_hash FROM users WHERE email = 'asha@example.com'");
    expect(user.password_hash).toMatch(/^\$argon2id\$/);
    expect(user.password_hash).not.toContain('a-long-enough-password');
    const members = await rows<{ role: string }>('SELECT role FROM memberships WHERE user_id = $1', [user.id]);
    expect(members).toEqual([{ role: 'owner' }]);
    const stored = await rows<{ token_hash: string }>('SELECT token_hash FROM sessions WHERE user_id = $1', [user.id]);
    expect(stored[0].token_hash).not.toBe(tokenOf(r.cookie));
    expect(stored[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    const audit = await rows<{ action: string; outcome: string }>("SELECT action, outcome FROM audit_log WHERE actor = $1", [user.id]);
    expect(audit).toEqual([{ action: 'auth.signup', outcome: 'ok' }]);
  });

  it('says who is signed in, and refuses a missing, unknown or expired session', async () => {
    const signup = await call('POST', '/api/auth/signup', good('me@example.com'));
    const me = await call('GET', '/api/me', undefined, cookieHeader(signup.cookie));
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ user: { email: 'me@example.com' } });
    expect((await call('GET', '/api/me')).status).toBe(401);
    expect((await call('GET', '/api/me', undefined, { Cookie: `lira_session=${randomBytes(32).toString('base64url')}` })).status).toBe(401);
    expect((await call('GET', '/api/me', undefined, { Cookie: 'lira_session=short' })).status).toBe(401);
    await admin.query("UPDATE sessions SET expires_at = now() - interval '1 minute' WHERE token_hash = $1", [(await rows<{ token_hash: string }>("SELECT token_hash FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email = 'me@example.com'"))[0].token_hash]);
    expect((await call('GET', '/api/me', undefined, cookieHeader(signup.cookie))).status).toBe(401);
  });

  it('refuses a second account with the same email, in any letter case', async () => {
    await call('POST', '/api/auth/signup', good('dup@example.com'));
    const again = await call('POST', '/api/auth/signup', good('DUP@example.COM'));
    expect(again.status).toBe(409);
    expect(again.cookie).toBeUndefined();
    expect(await rows("SELECT 1 FROM users WHERE lower(email) = 'dup@example.com'")).toHaveLength(1);
  });

  it('logs in with the right password and makes a new session', async () => {
    await call('POST', '/api/auth/signup', good('login@example.com'));
    const r = await call('POST', '/api/auth/login', { email: 'LOGIN@example.com', password: 'a-long-enough-password' });
    expect(r.status).toBe(200);
    expect(r.cookie).toMatch(/Max-Age=43200/);
    expect((await call('GET', '/api/me', undefined, cookieHeader(r.cookie))).status).toBe(200);
    expect((await rows<{ last_login_at: Date | null }>("SELECT last_login_at FROM users WHERE email = 'login@example.com'"))[0].last_login_at).not.toBeNull();
  });

  it('remembers a person for 30 days only when asked', async () => {
    const r = await call('POST', '/api/auth/login', { email: 'login@example.com', password: 'a-long-enough-password', remember: true });
    expect(r.cookie).toMatch(/Max-Age=2592000/);
  });

  it('gives the same answer for a wrong password and for an unknown email, and sets no cookie', async () => {
    await call('POST', '/api/auth/signup', good('same@example.com'));
    const wrong = await call('POST', '/api/auth/login', { email: 'same@example.com', password: 'not-the-password' });
    const unknown = await call('POST', '/api/auth/login', { email: 'nobody@example.com', password: 'not-the-password' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.cookie).toBeUndefined();
    expect(unknown.cookie).toBeUndefined();
  });

  it('pauses sign-in after five wrong passwords, even for the right one, and records it', async () => {
    await call('POST', '/api/auth/signup', good('lock@example.com'));
    for (let i = 0; i < 5; i++) expect((await call('POST', '/api/auth/login', { email: 'lock@example.com', password: `wrong-${i}` })).status).toBe(401);
    const locked = await call('POST', '/api/auth/login', { email: 'lock@example.com', password: 'a-long-enough-password' });
    expect(locked.status).toBe(429);
    expect(locked.cookie).toBeUndefined();
    const denied = await rows<{ detail: { reason?: string } }>("SELECT detail FROM audit_log WHERE action = 'auth.login' AND outcome = 'denied' AND detail->>'reason' = 'locked'");
    expect(denied.length).toBeGreaterThan(0);
  });

  it('logs out: the cookie is cleared and the old session stops working', async () => {
    const signup = await call('POST', '/api/auth/signup', good('out@example.com'));
    const out = await call('POST', '/api/auth/logout', undefined, cookieHeader(signup.cookie));
    expect(out.status).toBe(204);
    expect(out.cookie).toMatch(/Max-Age=0/);
    expect((await call('GET', '/api/me', undefined, cookieHeader(signup.cookie))).status).toBe(401);
    expect(await rows("SELECT 1 FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email = 'out@example.com'")).toHaveLength(0);
  });

  it('refuses a change that does not come from our own page, and changes nothing', async () => {
    const before = (await rows<{ n: string }>('SELECT count(*) AS n FROM users'))[0].n;
    const evil = await call('POST', '/api/auth/signup', good('evil@example.com'), { Origin: 'https://evil.example' });
    const noHeader = await call('POST', '/api/auth/signup', good('evil2@example.com'), { 'X-Requested-With': 'fetch' });
    expect(evil.status).toBe(403);
    expect(noHeader.status).toBe(403);
    expect((await rows<{ n: string }>('SELECT count(*) AS n FROM users'))[0].n).toBe(before);
  });

  it('names the fields that are wrong, refuses unknown fields, and creates nothing', async () => {
    const bad = await call('POST', '/api/auth/signup', { name: '', email: 'x', password: 'short' });
    expect(bad.status).toBe(400);
    expect(bad.body).toMatchObject({ error: { code: 'invalid_input', fields: { name: expect.any(String), email: expect.any(String), password: expect.any(String) } } });
    const extra = await call('POST', '/api/auth/signup', { ...good('extra@example.com'), role: 'owner' });
    expect(extra.status).toBe(400);
    expect(await rows("SELECT 1 FROM users WHERE email = 'extra@example.com'")).toHaveLength(0);
    expect((await call('POST', '/api/auth/signup', '{not json')).status).toBe(400);
  });

  it('refuses a body over 16 KB', async () => {
    const r = await call('POST', '/api/auth/login', { email: 'a@b.co', password: 'x'.repeat(20000) });
    expect(r.status).toBe(413);
  });

  it('stores hostile text as plain text and leaves the tables alone', async () => {
    const r = await call('POST', '/api/auth/signup', { name: "Robert'); DROP TABLE users;--", email: 'bobby@example.com', password: 'a-long-enough-password' });
    expect(r.status).toBe(201);
    expect((await rows<{ name: string }>("SELECT name FROM users WHERE email = 'bobby@example.com'"))[0].name).toBe("Robert'); DROP TABLE users;--");
    const probe = await call('POST', '/api/auth/login', { email: "x@y.co' OR '1'='1", password: 'p' });
    expect([400, 401]).toContain(probe.status);
  });

  it('returns errors in one shape, with nothing internal in them', async () => {
    const r = await call('GET', '/api/nothing-here');
    expect(r.status).toBe(404);
    expect(r.body).toMatchObject({ error: { code: 'not_found', message: expect.any(String) } });
    expect(JSON.stringify(r.body)).not.toMatch(/at .*\.ts|node_modules|stack/i);
  });

  it('keeps counts of what matters, at /metrics', async () => {
    const r = await call('GET', '/metrics');
    expect(r.status).toBe(200);
    expect(String(r.body)).toMatch(/auth_signup_total\{outcome="ok"\} \d+/);
    expect(String(r.body)).toMatch(/auth_login_total\{outcome="wrong"\} \d+/);
    expect(String(r.body)).toMatch(/http_requests_total/);
  });

  it('gives the application role only the rights it needs: no changing or deleting audit records, no dropping tables', async () => {
    const denied = async (sql: string) => { try { await appPool.query(sql); return 'allowed'; } catch (e) { return (e as { code?: string }).code; } };
    expect(await denied("UPDATE audit_log SET action = 'x'")).toBe('42501');
    expect(await denied('DELETE FROM audit_log')).toBe('42501');
    expect(await denied('DROP TABLE users')).toBe('42501');
    expect(await denied('ALTER TABLE users DISABLE ROW LEVEL SECURITY')).toBe('42501');
    expect(await denied('CREATE TABLE sneaky (id int)')).toBe('42501');
    expect(await denied('SELECT count(*) FROM audit_log')).toBe('allowed');
  });
});
