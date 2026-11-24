import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Client } from 'pg';
import { createApp } from '../app';
import type { SystemMailer } from '../mail/mailer';
import type { EmailMessage, EmailSender } from '../invitations/email';
import type { FakeGoogle } from './fake-google';
import { MemoryBlobStore } from './memory-blob-store';
import { loadConfig } from '../config';
import { applyMigrations, readMigrations } from '../db/migrate';

/** The server admin's connection for tests against a real PostgreSQL. Without it the database tests are skipped. */
export const ADMIN_URL = process.env.TEST_DATABASE_URL;
export const ORIGIN = 'https://test.liraspaces.com';

/** A cloud database needs TLS. A throwaway container on this machine has none, and says so with TEST_DATABASE_SSL=disable. */
export const testSsl = (): { rejectUnauthorized: true } | false => (process.env.TEST_DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: true });

export interface Reply { status: number; body: unknown; cookie: string | undefined; location: string | null }

/** Collects the emails the API would send, and says each was sent. */
export class CapturingEmail implements EmailSender {
  readonly sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<boolean> { this.sent.push(message); return true; }
}

export interface RealDb {
  admin: Client;
  call(method: string, path: string, body?: unknown, extra?: Record<string, string>): Promise<Reply>;
  rows<T extends object>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Signs a new person up and returns their organisation and the header that carries their session. */
  signUp(email: string): Promise<{ orgId: string; userId: string; session: Record<string, string> }>;
  /** File storage in memory: the tests put files here the way the browser would send them to storage. */
  blobs: MemoryBlobStore;
  emails: CapturingEmail;
  /** Adds a person to an organisation with a role, straight in the database, and gives back the headers that sign them in. */
  addMember(owner: { orgId: string }, email: string, role: string): Promise<{ orgId: string; userId: string; session: Record<string, string> }>;
  /** The running API, for a test that needs to reach one of its services. */
  app: NestExpressApplication;
  stop(): Promise<void>;
}

/**
 * Starts the real API on a schema of its own (dropped by stop) and connects as the application role, so its true permissions
 * are the ones tested. Shared by every test that needs the database.
 */
export async function startRealDb(options: { google?: FakeGoogle; systemMailer?: SystemMailer } = {}): Promise<RealDb> {
  const schema = `t_${randomBytes(6).toString('hex')}`;
  const url = (extra?: string) => {
    const u = new URL(ADMIN_URL!);
    u.searchParams.delete('sslmode');
    if (extra) u.searchParams.set('options', extra);
    return u.toString();
  };
  const admin = new Client({ connectionString: url(), ssl: testSsl() });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.query(`SET search_path TO ${schema}`);
  await admin.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lira_app') THEN CREATE ROLE lira_app NOLOGIN; END IF; END $$");
  await admin.query('GRANT lira_app TO CURRENT_USER');
  await admin.query(`GRANT USAGE, CREATE ON SCHEMA ${schema} TO lira_app`); // the test schema only; the real schema never gets CREATE
  await applyMigrations(admin, readMigrations(join(__dirname, '..', '..', 'migrations')));
  await admin.query(`REVOKE CREATE ON SCHEMA ${schema} FROM lira_app`);

  const blobs = new MemoryBlobStore();
  const emails = new CapturingEmail();
  const googleEnv = options.google ? {
    GOOGLE_CLIENT_ID: 'client-id-123456', GOOGLE_CLIENT_SECRET: 'client-secret-123456', GOOGLE_REDIRECT_URI: `${ORIGIN}/api/google/callback`,
    TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  } : {};
  // With a fake Google the real Google sender is used (it talks to the fake); without one, emails are captured.
  const app: NestExpressApplication = await createApp(loadConfig({
    DATABASE_URL: url(`-c search_path=${schema} -c role=lira_app`), ALLOWED_ORIGINS: ORIGIN, TRUST_PROXY_HOPS: '0', DATABASE_SSL: testSsl() ? 'require' : 'disable', ...googleEnv,
  }), { blobStore: blobs, ...(options.systemMailer ? { systemMailer: options.systemMailer } : {}), ...(options.google ? { googleHttp: options.google.fetch } : { emailSender: emails }) });
  await app.listen(0, '127.0.0.1');
  const base = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;

  const call: RealDb['call'] = async (method, path, body, extra = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      redirect: 'manual', // a redirect is part of the answer being tested, never followed
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Requested-With': 'liraspaces', ...extra },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* plain text */ }
    return { status: res.status, body: parsed, cookie: res.headers.getSetCookie()[0], location: res.headers.get('location') };
  };
  const rows: RealDb['rows'] = async (sql, params = []) => (await admin.query(sql, params)).rows as never;
  const signUp: RealDb['signUp'] = async email => {
    const r = await call('POST', '/api/auth/signup', { name: 'Test Person', email, password: 'a-long-enough-password' });
    const body = r.body as { user: { id: string }; organisations: { orgId: string }[] };
    return { orgId: body.organisations[0].orgId, userId: body.user.id, session: { Cookie: `lira_session=${/lira_session=([^;]*)/.exec(r.cookie ?? '')?.[1] ?? ''}` } };
  };
  const addMember: RealDb['addMember'] = async (owner, email, role) => {
    const person = await signUp(email);
    await admin.query('INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, $3)', [owner.orgId, person.userId, role]);
    return { ...person, orgId: owner.orgId };
  };
  return { admin, app, call, rows, signUp, blobs, emails, addMember, stop: async () => { await app.close(); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); } };
}
