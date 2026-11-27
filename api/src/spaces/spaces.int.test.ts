import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_URL, startRealDb, type RealDb } from '../testing/realDb';

const space = { key: 'LIRA', name: 'Lira', icon: 'rocket', color: '#336699' };

describe.skipIf(!ADMIN_URL)('spaces on a real database', () => {
  let db: RealDb;
  beforeAll(async () => { db = await startRealDb(); });
  afterAll(async () => { await db?.stop(); });

  const spacesPath = (orgId: string, id?: number) => `/api/orgs/${orgId}/spaces${id === undefined ? '' : `/${id}`}`;
  const code = (r: { body: unknown }) => (r.body as { error: { code: string } }).error.code;

  it('lists who a ticket of a space may be given to: Owner, Admins and whoever was given the space, never people who may only look or have no access, to any member who can see it', async () => {
    const owner = await db.signUp('assign-owner@example.com');
    const id = ((await db.call('POST', spacesPath(owner.orgId), space, owner.session)).body as { id: number }).id;
    const other = ((await db.call('POST', spacesPath(owner.orgId), { ...space, key: 'OTHR' }, owner.session)).body as { id: number }).id;
    const asked = async (p: { session: string }, space: number) => db.call('GET', `${spacesPath(owner.orgId, space)}/assignable`, undefined, p.session);
    const worker = await db.addMember(owner, 'assign-worker@example.com', 'member');
    const watcher = await db.addMember(owner, 'assign-watcher@example.com', 'viewer');
    const stranger = await db.addMember(owner, 'assign-stranger@example.com', 'member');
    const admin = await db.addMember(owner, 'assign-admin@example.com', 'admin');
    for (const [who, level] of [[worker, 'edit'], [watcher, 'view']] as const) {
      await db.call('POST', `/api/orgs/${owner.orgId}/grants`, { subjectType: 'user', subjectId: who.userId, kind: 'space', objectId: String(id), level }, owner.session);
    }
    const team = ((await db.call('POST', `/api/orgs/${owner.orgId}/teams`, { name: 'Builders' }, owner.session)).body as { id: string }).id;
    const viaTeam = await db.addMember(owner, 'assign-team@example.com', 'member');
    await db.call('PUT', `/api/orgs/${owner.orgId}/teams/${team}/members`, { userIds: [viaTeam.userId] }, owner.session);
    await db.call('POST', `/api/orgs/${owner.orgId}/grants`, { subjectType: 'team', subjectId: team, kind: 'space', objectId: String(id), level: 'edit' }, owner.session);

    const people = (await asked(worker, id)).body as { userId: string; name: string }[]; // a member with access, not only an admin, may ask
    expect(people.map(p => p.userId).sort()).toEqual([owner.userId, admin.userId, worker.userId, viaTeam.userId].sort());
    expect(people.every(p => Object.keys(p).sort().join() === 'name,userId')).toBe(true); // no emails, no roles
    expect((await asked(stranger, id)).status).toBe(404); // no access to the space: it does not even exist for them
    expect((await asked(watcher, id)).status).toBe(200); // a viewer may look at the list but is not in it
    expect(((await asked(owner, other)).body as unknown[]).map(p => (p as { userId: string }).userId).sort()).toEqual([owner.userId, admin.userId].sort()); // another space: its own people
    expect((await db.call('GET', `${spacesPath(owner.orgId, id)}/assignable`)).status).toBe(401);
  });

  it('lets the owner create, list, change and delete a space, and writes an audit row for each change', async () => {
    const owner = await db.signUp('owner@example.com');
    const created = await db.call('POST', spacesPath(owner.orgId), { ...space, description: 'The product' }, owner.session);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ key: 'LIRA', name: 'Lira', version: 1, description: 'The product' });
    const id = (created.body as { id: number }).id;

    const listed = await db.call('GET', spacesPath(owner.orgId), undefined, owner.session);
    expect((listed.body as { id: number }[]).map(s => s.id)).toEqual([id]);

    const changed = await db.call('PATCH', spacesPath(owner.orgId, id), { version: 1, name: 'Lira Spaces' }, owner.session);
    expect(changed.body).toMatchObject({ name: 'Lira Spaces', version: 2, color: '#336699' });

    expect((await db.call('DELETE', spacesPath(owner.orgId, id), { version: 2 }, owner.session)).status).toBe(204);
    expect((await db.call('GET', spacesPath(owner.orgId), undefined, owner.session)).body).toEqual([]);

    const audit = await db.rows<{ action: string; actor: string }>("SELECT action, actor FROM audit_log WHERE action LIKE 'space.%' AND org_id = $1 ORDER BY id", [owner.orgId]);
    expect(audit.map(a => a.action)).toEqual(['space.create', 'space.update', 'space.delete']);
    expect(new Set(audit.map(a => a.actor))).toEqual(new Set([owner.userId]));
  });

  it('refuses a request without a session', async () => {
    const owner = await db.signUp('nosession@example.com');
    expect((await db.call('GET', spacesPath(owner.orgId))).status).toBe(401);
    expect((await db.call('POST', spacesPath(owner.orgId), space)).status).toBe(401);
  });

  it('keeps organisations apart: a person of organisation A cannot read, change or delete a space of organisation B', async () => {
    const a = await db.signUp('a@example.com');
    const b = await db.signUp('b@example.com');
    const made = await db.call('POST', spacesPath(b.orgId), { ...space, key: 'SECRET' }, b.session);
    const id = (made.body as { id: number }).id;

    for (const [method, body] of [['GET', undefined], ['POST', space]] as const) {
      expect((await db.call(method, spacesPath(b.orgId), body, a.session)).status, `${method} B's list as A`).toBe(404);
    }
    // A addresses its own organisation but names B's space number: it is just not there for A.
    expect((await db.call('PATCH', spacesPath(a.orgId, id), { version: 1, name: 'Mine now' }, a.session)).status).toBe(404);
    expect((await db.call('DELETE', spacesPath(a.orgId, id), { version: 1 }, a.session)).status).toBe(404);
    expect((await db.call('GET', spacesPath(a.orgId), undefined, a.session)).body).toEqual([]);
    expect((await db.rows<{ name: string }>('SELECT name FROM spaces WHERE id = $1', [id]))[0].name).toBe('Lira');
  });

  it('answers a made-up organisation and a real stranger organisation the same way', async () => {
    const a = await db.signUp('same@example.com');
    const other = await db.signUp('other@example.com');
    const real = await db.call('GET', spacesPath(other.orgId), undefined, a.session);
    const fake = await db.call('GET', spacesPath('00000000-0000-4000-8000-000000000000'), undefined, a.session);
    const junk = await db.call('GET', spacesPath('not-a-uuid'), undefined, a.session);
    expect([real.status, fake.status, junk.status]).toEqual([404, 404, 404]);
    expect(real.body).toEqual(fake.body);
  });

  it('gives no access to a member who has not been given any, even though they belong to the organisation', async () => {
    const owner = await db.signUp('boss@example.com');
    const member = await db.signUp('member@example.com');
    await db.admin.query("INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'member')", [owner.orgId, member.userId]);
    const listed = await db.call('GET', spacesPath(owner.orgId), undefined, member.session);
    expect([listed.status, listed.body]).toEqual([200, []]); // nothing granted, so nothing is listed
    expect((await db.call('POST', spacesPath(owner.orgId), space, member.session)).status).toBe(403);
  });

  it('refuses a stale version with 409, and a repeated key with 409', async () => {
    const owner = await db.signUp('versions@example.com');
    const made = await db.call('POST', spacesPath(owner.orgId), space, owner.session);
    const id = (made.body as { id: number }).id;
    await db.call('PATCH', spacesPath(owner.orgId, id), { version: 1, name: 'First' }, owner.session);
    const stale = await db.call('PATCH', spacesPath(owner.orgId, id), { version: 1, name: 'Second' }, owner.session);
    expect(stale.status).toBe(409);
    expect(code(stale)).toBe('conflict');
    expect((await db.call('DELETE', spacesPath(owner.orgId, id), { version: 1 }, owner.session)).status).toBe(409);
    const again = await db.call('POST', spacesPath(owner.orgId), space, owner.session);
    expect(again.status).toBe(409);
    expect(code(again)).toBe('key_taken');
  });

  it('allows the same key in two organisations', async () => {
    const a = await db.signUp('k1@example.com');
    const b = await db.signUp('k2@example.com');
    expect((await db.call('POST', spacesPath(a.orgId), space, a.session)).status).toBe(201);
    expect((await db.call('POST', spacesPath(b.orgId), space, b.session)).status).toBe(201);
  });

  it('refuses unknown fields, an organisation or version smuggled into a create, bad shapes and an empty update', async () => {
    const owner = await db.signUp('input@example.com');
    const bad = async (body: unknown) => (await db.call('POST', spacesPath(owner.orgId), body, owner.session)).status;
    expect(await bad({ ...space, org_id: owner.orgId })).toBe(400);
    expect(await bad({ ...space, version: 9 })).toBe(400);
    expect(await bad({ ...space, id: 1 })).toBe(400);
    expect(await bad({ ...space, key: 'a b' })).toBe(400);
    expect(await bad({ ...space, color: 'red' })).toBe(400);
    expect(await bad({ ...space, name: 'x'.repeat(101) })).toBe(400);
    expect(await bad({ ...space, description: 'x'.repeat(2001) })).toBe(400);
    const made = await db.call('POST', spacesPath(owner.orgId), space, owner.session);
    const id = (made.body as { id: number }).id;
    expect((await db.call('PATCH', spacesPath(owner.orgId, id), { version: 1 }, owner.session)).status).toBe(400);
    expect((await db.call('PATCH', spacesPath(owner.orgId, id), { version: 1, key: 'NEW' }, owner.session)).status).toBe(400);
    expect((await db.call('PATCH', spacesPath(owner.orgId, 'abc' as never), { version: 1, name: 'x' }, owner.session)).status).toBe(400);
  });

  it('refuses a change that does not come from one of our own pages', async () => {
    const owner = await db.signUp('csrf@example.com');
    const forged = await db.call('POST', spacesPath(owner.orgId), space, { ...owner.session, Origin: 'https://evil.example' });
    expect(forged.status).toBe(403);
    expect((await db.rows('SELECT 1 FROM spaces WHERE org_id = $1', [owner.orgId])).length).toBe(0);
  });

  it('keeps a space number as a plain number, so existing ticket references keep their type', async () => {
    const owner = await db.signUp('number@example.com');
    const made = await db.call('POST', spacesPath(owner.orgId), space, owner.session);
    expect(typeof (made.body as { id: unknown }).id).toBe('number');
  });
});
