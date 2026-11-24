import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_URL, startRealDb, type RealDb } from '../testing/realDb';
import { MaintenanceService } from './maintenance.service';

describe.skipIf(!ADMIN_URL)('clearing out what has expired, on a real database', () => {
  let db: RealDb;
  beforeAll(async () => { db = await startRealDb(); });
  afterAll(async () => { await db?.stop(); });

  const count = async (table: string) => Number((await db.rows<{ n: string }>(`SELECT count(*) AS n FROM ${table}`))[0].n);

  it('removes sessions that ended more than a day ago and keeps live and just-ended ones, so a signed-in person is never logged out', async () => {
    const p = await db.signUp('keep@example.com');
    await db.admin.query("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, 'old1', now() - interval '3 days'), ($1, 'old2', now() - interval '2 days'), ($1, 'recent', now() - interval '1 hour')", [p.userId]);
    const before = await count('sessions');
    const done = await db.app.get(MaintenanceService).runOnce();
    expect(done.sessions).toBe(2);
    expect(await count('sessions')).toBe(before - 2);
    expect((await db.call('GET', '/api/me', undefined, p.session)).status).toBe(200);
    expect((await db.rows("SELECT 1 FROM sessions WHERE token_hash = 'recent'")).length).toBe(1);
  });

  it('removes old attempts, expired email links, old reminder records and long-expired invitations, and nothing that is still in force', async () => {
    const owner = await db.signUp('owner-m@example.com');
    await db.admin.query("INSERT INTO login_attempts (key_hash, ok, at) VALUES ('a', false, now() - interval '2 days'), ('b', false, now())");
    await db.admin.query("INSERT INTO email_tokens (user_id, kind, token_hash, expires_at) VALUES ($1, 'verify', 'h1', now() - interval '3 days'), ($1, 'verify', 'h2', now() + interval '1 day')", [owner.userId]);
    await db.admin.query("INSERT INTO reminders_sent (kind, key, user_id, sent_at) VALUES ('call', 'k1', $1, now() - interval '4 days'), ('call', 'k2', $1, now())", [owner.userId]);
    await db.admin.query("INSERT INTO invitations (org_id, email, role, token_hash, expires_at) VALUES ($1, 'old@x.co', 'member', 'i1', now() - interval '40 days'), ($1, 'new@x.co', 'member', 'i2', now() + interval '1 day')", [owner.orgId]);
    const done = await db.app.get(MaintenanceService).runOnce();
    expect([done.login_attempts, done.email_tokens, done.reminders_sent, done.invitations].every(n => n >= 1)).toBe(true);
    expect((await db.rows<{ key: string }>('SELECT key FROM reminders_sent WHERE user_id = $1', [owner.userId])).map(r => r.key)).toEqual(['k2']);
    expect((await db.rows<{ email: string }>('SELECT email FROM invitations WHERE org_id = $1', [owner.orgId])).map(r => r.email)).toEqual(['new@x.co']);
    expect((await db.rows("SELECT token_hash FROM email_tokens WHERE token_hash = 'h2'")).length).toBe(1);
  });
  it('never touches what people made: tickets, spaces and objects stay when the sessions they were made in are long gone', async () => {
    const p = await db.signUp('made@example.com');
    const space = ((await db.call('POST', `/api/orgs/${p.orgId}/spaces`, { key: 'KEEP', name: 'Keep', icon: 'x', color: '#336699' }, p.session)).body as { id: number }).id;
    const ticket = { title: 'Made during a session', type: 'task', status: 'todo', priority: 'medium', rank: 1000, description: '', reporter: 'T', reporterInitials: 'T', labels: [], subtasks: [], comments: [], activity: [], linkedIssues: [], watchers: [] };
    await db.call('POST', `/api/orgs/${p.orgId}/spaces/${space}/tickets`, ticket, p.session);
    await db.call('PUT', `/api/orgs/${p.orgId}/objects/roadmap/rm1`, { doc: { id: 'rm1', name: 'Plan' } }, p.session);
    await db.admin.query("UPDATE sessions SET expires_at = now() - interval '30 days' WHERE user_id = $1", [p.userId]); // every session of theirs ended long ago
    const done = await db.app.get(MaintenanceService).runOnce();
    expect(done.sessions).toBeGreaterThanOrEqual(1);
    expect(await count('sessions')).toBeGreaterThanOrEqual(0);
    expect((await db.rows<{ title: string }>('SELECT title FROM tickets WHERE org_id = $1', [p.orgId])).map(t => t.title)).toEqual(['Made during a session']);
    expect((await db.rows('SELECT 1 FROM spaces WHERE org_id = $1', [p.orgId])).length).toBe(1);
    expect((await db.rows("SELECT 1 FROM objects WHERE org_id = $1 AND id = 'rm1'", [p.orgId])).length).toBe(1);
    expect((await db.rows('SELECT 1 FROM users WHERE id = $1', [p.userId])).length).toBe(1);
    expect((await db.rows('SELECT 1 FROM audit_log WHERE actor = $1', [p.userId])).length).toBeGreaterThan(0); // and so does the record of who did it
  });
});
