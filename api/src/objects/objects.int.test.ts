import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_URL, startRealDb, type RealDb } from '../testing/realDb';

describe.skipIf(!ADMIN_URL)('projects, roadmaps and dashboards on a real database', () => {
  let db: RealDb;
  beforeAll(async () => { db = await startRealDb(); });
  afterAll(async () => { await db?.stop(); });

  type Person = Awaited<ReturnType<RealDb['signUp']>>;
  const path = (p: Person, kind: string, id?: string) => `/api/orgs/${p.orgId}/objects/${kind}${id ? `/${id}` : ''}`;
  const save = (p: Person, kind: string, id: string, body: object) => db.call('PUT', path(p, kind, id), body, p.session);
  const list = async (p: Person, kind: string) => (await db.call('GET', path(p, kind), undefined, p.session)).body as { id: string; level: string; doc: Record<string, unknown>; version: number }[];
  const grant = (owner: Person, subject: string, kind: string, objectId: string, level: string) =>
    db.call('POST', `/api/orgs/${owner.orgId}/grants`, { subjectType: 'user', subjectId: subject, kind, objectId, level }, owner.session);

  it('lets the owner create, list, change and delete, with versions, and gives the body back as it was saved', async () => {
    const owner = await db.signUp('obj-basic@example.com');
    const made = await save(owner, 'project', 'proj-a', { doc: { id: 'proj-a', name: 'Alpha', lead: 'Asha' }, position: 1 });
    expect(made.status).toBe(200);
    expect(made.body).toMatchObject({ id: 'proj-a', version: 1, level: 'manage', doc: { name: 'Alpha' } });
    expect((await save(owner, 'project', 'proj-b', { doc: { id: 'proj-b', name: 'Beta' }, position: 0 })).status).toBe(200);
    expect((await list(owner, 'project')).map(o => o.id)).toEqual(['proj-b', 'proj-a']);
    expect((await save(owner, 'project', 'proj-a', { doc: { id: 'proj-a', name: 'Alpha 2' }, version: 1 })).body).toMatchObject({ version: 2, doc: { name: 'Alpha 2' } });
    expect((await save(owner, 'project', 'proj-a', { doc: { id: 'proj-a', name: 'stale' }, version: 1 })).status).toBe(409);
    expect((await db.call('DELETE', path(owner, 'project', 'proj-a'), { version: 1 }, owner.session)).status).toBe(409);
    expect((await db.call('DELETE', path(owner, 'project', 'proj-a'), { version: 2 }, owner.session)).status).toBe(204);
    expect((await list(owner, 'project')).map(o => o.id)).toEqual(['proj-b']);
    expect((await save(owner, 'project', 'ghost', { doc: {}, version: 3 })).status).toBe(404);
  });

  it('shows a member only what they were given, and lets Edit change but not create or delete', async () => {
    const owner = await db.signUp('obj-grants@example.com');
    const member = await db.addMember(owner, 'obj-member@example.com', 'member');
    await save(owner, 'roadmap', 'r1', { doc: { id: 'r1', name: 'Seen' } });
    await save(owner, 'roadmap', 'r2', { doc: { id: 'r2', name: 'Hidden' } });
    expect(await list(member, 'roadmap')).toEqual([]);
    await grant(owner, member.userId, 'roadmap', 'r1', 'view');
    expect((await list(member, 'roadmap')).map(o => [o.id, o.level])).toEqual([['r1', 'view']]);
    expect((await save(member, 'roadmap', 'r1', { doc: { id: 'r1', name: 'x' }, version: 1 })).status).toBe(403);
    await grant(owner, member.userId, 'roadmap', 'r1', 'edit');
    expect((await save(member, 'roadmap', 'r1', { doc: { id: 'r1', name: 'Edited' }, version: 1 })).status).toBe(200);
    expect((await save(member, 'roadmap', 'r3', { doc: { id: 'r3', name: 'New' } })).status).toBe(403);
    expect((await db.call('DELETE', path(member, 'roadmap', 'r1'), { version: 2 }, member.session)).status).toBe(403);
    expect((await save(member, 'roadmap', 'r2', { doc: { id: 'r2' }, version: 1 })).status).toBe(404);
    await grant(owner, member.userId, 'roadmap', 'r1', 'manage');
    expect((await db.call('DELETE', path(member, 'roadmap', 'r1'), { version: 2 }, member.session)).status).toBe(204);
    expect((await db.rows('SELECT 1 FROM grants WHERE org_id = $1 AND object_kind = $2', [owner.orgId, 'roadmap'])).length).toBe(0);
  });

  it('makes a dashboard personal until it is shared, and lets a member make their own', async () => {
    const owner = await db.signUp('obj-dash@example.com');
    const member = await db.addMember(owner, 'obj-dash-m@example.com', 'member');
    const viewer = await db.addMember(owner, 'obj-dash-v@example.com', 'viewer');
    expect((await save(member, 'dashboard', 'mine', { doc: { id: 'mine', name: 'My view' } })).status).toBe(200);
    expect((await save(viewer, 'dashboard', 'nope', { doc: { id: 'nope' } })).status).toBe(403);
    expect((await list(member, 'dashboard')).map(o => [o.id, o.level])).toEqual([['mine', 'manage']]);
    expect(await list(viewer, 'dashboard')).toEqual([]);
    expect((await list(owner, 'dashboard')).map(o => o.id)).toEqual(['mine']); // owner and admins see everything
    await grant(owner, viewer.userId, 'dashboard', 'mine', 'manage');
    expect((await list(viewer, 'dashboard')).map(o => o.level)).toEqual(['view']); // a Viewer stays capped
  });

  it('keeps organisations apart, and refuses a member making a project or roadmap', async () => {
    const a = await db.signUp('obj-a@example.com');
    const b = await db.signUp('obj-b@example.com');
    const member = await db.addMember(a, 'obj-a-m@example.com', 'member');
    await save(b, 'project', 'secret', { doc: { id: 'secret' } });
    expect((await db.call('GET', path(b, 'project'), undefined, a.session)).status).toBe(404);
    expect((await db.call('PUT', path(b, 'project', 'secret'), { doc: {}, version: 1 }, a.session)).status).toBe(404);
    expect(await list(a, 'project')).toEqual([]);
    expect((await save(a, 'project', 'secret', { doc: { id: 'secret', name: 'A has its own' } })).status).toBe(200); // the same id in another organisation is another object
    expect((await list(b, 'project'))[0].doc).toEqual({ id: 'secret' });
    expect((await save(member, 'project', 'p', { doc: {} })).status).toBe(403);
    expect((await save(member, 'roadmap', 'r', { doc: {} })).status).toBe(403);
  });

  it('refuses unknown kinds and ids, a body that is not an object, unknown fields, a forged origin, no session, and a body over 512 KB', async () => {
    const owner = await db.signUp('obj-bad@example.com');
    expect((await db.call('GET', path(owner, 'ticket'), undefined, owner.session)).status).toBe(400);
    expect((await save(owner, 'project', 'bad id!', { doc: {} })).status).toBe(400);
    expect((await save(owner, 'project', 'x', { doc: 'text' })).status).toBe(400);
    expect((await save(owner, 'project', 'x', { doc: {}, org_id: owner.orgId })).status).toBe(400);
    expect((await db.call('PUT', path(owner, 'project', 'x'), { doc: {} }, { ...owner.session, Origin: 'https://evil.example' })).status).toBe(403);
    expect((await db.call('GET', path(owner, 'project'))).status).toBe(401);
    expect((await save(owner, 'project', 'ok', { doc: { text: 'x'.repeat(200_000) } })).status).toBe(200);
    expect((await save(owner, 'project', 'big', { doc: { text: 'x'.repeat(600_000) } })).status).toBe(413);
    expect((await db.rows('SELECT 1 FROM objects WHERE org_id = $1', [owner.orgId])).length).toBe(1);
  });

  it('audits creates, changes and deletes with the id only', async () => {
    const owner = await db.signUp('obj-audit@example.com');
    await save(owner, 'project', 'p', { doc: { name: 'confidential launch' } });
    await save(owner, 'project', 'p', { doc: { name: 'x' }, version: 1 });
    await db.call('DELETE', path(owner, 'project', 'p'), { version: 2 }, owner.session);
    const rows = await db.rows<{ action: string; detail: object }>("SELECT action, detail FROM audit_log WHERE org_id = $1 AND action LIKE 'project.%' ORDER BY id", [owner.orgId]);
    expect(rows.map(r => r.action)).toEqual(['project.create', 'project.update', 'project.delete']);
    expect(JSON.stringify(rows)).not.toMatch(/confidential/);
  });
});
