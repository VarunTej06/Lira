import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_URL, startRealDb, type RealDb } from '../testing/realDb';

describe.skipIf(!ADMIN_URL)('settings-style data on a real database', () => {
  let db: RealDb;
  beforeAll(async () => { db = await startRealDb(); });
  afterAll(async () => { await db?.stop(); });

  type Person = Awaited<ReturnType<RealDb['signUp']>>;
  const path = (p: Person) => `/api/orgs/${p.orgId}/kv`;
  const read = async (p: Person) => (await db.call('GET', path(p), undefined, p.session)).body as { shared: Record<string, string> | null; mine: Record<string, string> };
  const write = (p: Person, body: unknown) => db.call('PUT', path(p), body, p.session);

  it('keeps shared data and the owner\'s own preferences apart, and gives them back as they were saved', async () => {
    const p = await db.signUp('kv-basic@example.com');
    expect(await read(p)).toEqual({ shared: {}, mine: {} });
    expect((await write(p, { shared: { lira_projects: '[{"id":"p1"}]', lira_roadmaps: '{}' }, mine: { lira_theme: 'dark' } })).status).toBe(204);
    expect(await read(p)).toEqual({ shared: { lira_projects: '[{"id":"p1"}]', lira_roadmaps: '{}' }, mine: { lira_theme: 'dark' } });
  });

  it('replaces a value, and removes an entry with null', async () => {
    const p = await db.signUp('kv-edit@example.com');
    await write(p, { shared: { lira_projects: 'one', lira_dashboards: 'd' } });
    await write(p, { shared: { lira_projects: 'two', lira_dashboards: null } });
    expect((await read(p)).shared).toEqual({ lira_projects: 'two' });
    expect((await db.rows('SELECT 1 FROM kv_entries WHERE org_id = $1', [p.orgId])).length).toBe(1);
  });

  it('keeps organisations apart: A can neither read nor write B\'s data', async () => {
    const a = await db.signUp('kv-a@example.com');
    const b = await db.signUp('kv-b@example.com');
    await write(b, { shared: { lira_projects: 'B secret' }, mine: { lira_theme: 'B theme' } });
    expect((await db.call('GET', path(b), undefined, a.session)).status).toBe(404);
    expect((await db.call('PUT', path(b), { shared: { lira_projects: 'A wrote this' } }, a.session)).status).toBe(404);
    expect(await read(a)).toEqual({ shared: {}, mine: {} });
    expect((await read(b)).shared).toEqual({ lira_projects: 'B secret' });
  });

  it('keeps one person\'s preferences from another person in the same organisation', async () => {
    const owner = await db.signUp('kv-owner@example.com');
    const admin = await db.signUp('kv-admin@example.com');
    await db.admin.query("INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'admin')", [owner.orgId, admin.userId]);
    const asAdmin = { ...admin, orgId: owner.orgId };
    await write(owner, { mine: { lira_theme: 'owner-dark' }, shared: { lira_projects: 'shared' } });
    await write(asAdmin, { mine: { lira_theme: 'admin-light' } });
    expect(await read(owner)).toEqual({ shared: { lira_projects: 'shared' }, mine: { lira_theme: 'owner-dark' } });
    expect(await read(asAdmin)).toEqual({ shared: { lira_projects: 'shared' }, mine: { lira_theme: 'admin-light' } });
  });

  it('lets a member keep their own preferences but not reach or change the shared data', async () => {
    const owner = await db.signUp('kv-boss@example.com');
    const member = await db.signUp('kv-member@example.com');
    await db.admin.query("INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'member')", [owner.orgId, member.userId]);
    const asMember = { ...member, orgId: owner.orgId };
    await write(owner, { shared: { lira_projects: 'private' } });
    expect((await write(asMember, { mine: { lira_theme: 'dark' } })).status).toBe(204);
    expect(await read(asMember)).toEqual({ shared: null, mine: { lira_theme: 'dark' } });
    expect((await write(asMember, { shared: { lira_projects: 'hijack' } })).status).toBe(403);
    expect((await read(owner)).shared).toEqual({ lira_projects: 'private' });
  });

  it('refuses AI keys and internal keys, a bad shape, an oversized value, no session and a forged origin, and stores nothing', async () => {
    const p = await db.signUp('kv-bad@example.com');
    for (const body of [{ mine: { lira_gemini_api_key: 'secret' } }, { mine: { lira__kv_dirty: '1' } }, { mine: { lira_a: 5 } }, { mine: { lira_a: 'x'.repeat(262145) } }, { org: 'x' }, {}]) {
      expect((await write(p, body)).status, JSON.stringify(body).slice(0, 50)).toBe(400);
    }
    expect((await db.call('GET', path(p))).status).toBe(401);
    expect((await db.call('PUT', path(p), { mine: { lira_a: 'x' } })).status).toBe(401);
    expect((await db.call('PUT', path(p), { mine: { lira_a: 'x' } }, { ...p.session, Origin: 'https://evil.example' })).status).toBe(403);
    expect((await db.rows('SELECT 1 FROM kv_entries WHERE org_id = $1', [p.orgId])).length).toBe(0);
  });

  it('takes a roadmap-sized value on this route (200 KB), and refuses a request over 512 KB', async () => {
    const p = await db.signUp('kv-large@example.com');
    expect((await write(p, { shared: { lira_roadmaps: 'r'.repeat(200_000) } })).status).toBe(204);
    expect((await read(p)).shared!.lira_roadmaps.length).toBe(200_000);
    expect((await write(p, { shared: { lira_a: 'r'.repeat(262_000), lira_b: 'r'.repeat(262_000), lira_c: 'r'.repeat(262_000) } })).status).toBe(413);
  });

  it('writes one audit row per save naming the keys but never their values', async () => {
    const p = await db.signUp('kv-audit@example.com');
    await write(p, { shared: { lira_projects: 'confidential plan' }, mine: { lira_theme: 'dark' } });
    const rows = await db.rows<{ detail: Record<string, string> }>("SELECT detail FROM audit_log WHERE action = 'kv.write' AND org_id = $1", [p.orgId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].detail).toEqual({ shared: 'lira_projects', mine: 'lira_theme' });
    expect(JSON.stringify(rows)).not.toMatch(/confidential/);
  });
});
