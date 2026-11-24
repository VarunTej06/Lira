import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_URL, startRealDb, type RealDb } from '../testing/realDb';

const ticket = {
  title: 'T', type: 'task', status: 'todo', priority: 'medium', rank: 1, description: '', reporter: 'A', reporterInitials: 'A',
  labels: [], subtasks: [], comments: [], activity: [], linkedIssues: [], watchers: [],
};

describe.skipIf(!ADMIN_URL)('teams and access on a real database', () => {
  let db: RealDb;
  beforeAll(async () => { db = await startRealDb(); });
  afterAll(async () => { await db?.stop(); });

  type Person = Awaited<ReturnType<RealDb['signUp']>>;
  const org = (p: Person) => `/api/orgs/${p.orgId}`;
  const setup = async (email: string) => {
    const owner = await db.signUp(email);
    const mk = async (key: string) => ((await db.call('POST', `${org(owner)}/spaces`, { key, name: key, icon: 'x', color: '#336699' }, owner.session)).body as { id: number }).id;
    return { owner, space: await mk('ONE'), other: await mk('TWO') };
  };
  const grant = (owner: Person, body: object) => db.call('POST', `${org(owner)}/grants`, body, owner.session);
  const status = async (p: Person, method: string, path: string, body?: unknown) => (await db.call(method, `${org(p)}${path}`, body, p.session)).status;

  it('gives View, Edit and Manage on one space and nothing on the others, by person or by team', async () => {
    const { owner, space, other } = await setup('acc-levels@example.com');
    const viewer = await db.addMember(owner, 'acc-v@example.com', 'member');
    const editor = await db.addMember(owner, 'acc-e@example.com', 'member');
    const manager = await db.addMember(owner, 'acc-m@example.com', 'member');
    await grant(owner, { subjectType: 'user', subjectId: viewer.userId, kind: 'space', objectId: String(space), level: 'view' });
    await grant(owner, { subjectType: 'user', subjectId: editor.userId, kind: 'space', objectId: String(space), level: 'edit' });
    const team = ((await db.call('POST', `${org(owner)}/teams`, { name: 'Leads' }, owner.session)).body as { id: string }).id;
    await db.call('PUT', `${org(owner)}/teams/${team}/members`, { userIds: [manager.userId] }, owner.session);
    await grant(owner, { subjectType: 'team', subjectId: team, kind: 'space', objectId: String(space), level: 'manage' });
    const tk = (await db.call('POST', `${org(owner)}/spaces/${space}/tickets`, ticket, owner.session)).body as { id: number; version: number };

    // View: read, but not write
    expect(await status(viewer, 'GET', `/spaces/${space}/tickets`)).toBe(200);
    expect(await status(viewer, 'GET', `/tickets/${tk.id}`)).toBe(200);
    expect(await status(viewer, 'POST', `/spaces/${space}/tickets`, ticket)).toBe(403);
    expect(await status(viewer, 'PATCH', `/tickets/${tk.id}`, { version: 1, title: 'x' })).toBe(403);
    expect(await status(viewer, 'DELETE', `/tickets/${tk.id}`, { version: 1 })).toBe(403);
    // Edit: add, change and delete tickets, but not manage the space itself
    expect(await status(editor, 'PATCH', `/tickets/${tk.id}`, { version: 1, title: 'edited' })).toBe(200);
    expect(await status(editor, 'POST', `/spaces/${space}/tickets`, ticket)).toBe(201);
    expect(await status(editor, 'PATCH', `/spaces/${space}`, { version: 1, name: 'renamed' })).toBe(403);
    expect(await status(editor, 'POST', '/spaces', { key: 'NEW', name: 'n', icon: 'x', color: '#336699' })).toBe(403);
    // Manage (through a team): change and delete the space
    expect(await status(manager, 'PATCH', `/spaces/${space}`, { version: 1, name: 'renamed' })).toBe(200);
    // Nothing on the other space: it does not even exist for them
    for (const p of [viewer, editor, manager]) {
      expect(await status(p, 'GET', `/spaces/${other}/tickets`)).toBe(404);
      expect(await status(p, 'PATCH', `/spaces/${other}`, { version: 1, name: 'x' })).toBe(404);
    }
    const seen = async (p: Person) => ((await db.call('GET', `${org(p)}/spaces`, undefined, p.session)).body as { id: number }[]).map(s => s.id);
    expect(await seen(viewer)).toEqual([space]);
    const level = async (p: Person) => ((await db.call('GET', `${org(p)}/spaces`, undefined, p.session)).body as { id: number; myLevel: string }[]).find(s => s.id === space)?.myLevel;
    expect([await level(viewer), await level(editor), await level(manager), await level(owner)]).toEqual(['view', 'edit', 'manage', 'manage']); // the app hides what the server would refuse
    expect((await seen(owner)).sort((a, b) => a - b)).toEqual([space, other].sort((a, b) => a - b));
  });

  it('applies a person\'s highest level when they hold several, and stops at once when a grant is taken away', async () => {
    const { owner, space } = await setup('acc-high@example.com');
    const p = await db.addMember(owner, 'acc-high-p@example.com', 'member');
    const team = ((await db.call('POST', `${org(owner)}/teams`, { name: 'Readers' }, owner.session)).body as { id: string }).id;
    await db.call('PUT', `${org(owner)}/teams/${team}/members`, { userIds: [p.userId] }, owner.session);
    await grant(owner, { subjectType: 'team', subjectId: team, kind: 'space', objectId: String(space), level: 'view' });
    const direct = (await grant(owner, { subjectType: 'user', subjectId: p.userId, kind: 'space', objectId: String(space), level: 'edit' })).body as { id: string };
    expect(await status(p, 'POST', `/spaces/${space}/tickets`, ticket)).toBe(201);
    expect((await db.call('DELETE', `${org(owner)}/grants/${direct.id}`, undefined, owner.session)).status).toBe(204);
    expect(await status(p, 'POST', `/spaces/${space}/tickets`, ticket)).toBe(403);
    await db.call('PUT', `${org(owner)}/teams/${team}/members`, { userIds: [] }, owner.session);
    expect(await status(p, 'GET', `/spaces/${space}/tickets`)).toBe(404);
  });

  it('caps a Viewer at View and a Guest below Manage, whatever they were granted', async () => {
    const { owner, space } = await setup('acc-cap@example.com');
    const viewer = await db.addMember(owner, 'acc-cap-v@example.com', 'viewer');
    const guest = await db.addMember(owner, 'acc-cap-g@example.com', 'guest');
    for (const p of [viewer, guest]) await grant(owner, { subjectType: 'user', subjectId: p.userId, kind: 'space', objectId: String(space), level: 'manage' });
    expect(await status(viewer, 'GET', `/spaces/${space}/tickets`)).toBe(200);
    expect(await status(viewer, 'POST', `/spaces/${space}/tickets`, ticket)).toBe(403);
    expect(await status(guest, 'POST', `/spaces/${space}/tickets`, ticket)).toBe(201);
    expect(await status(guest, 'PATCH', `/spaces/${space}`, { version: 1, name: 'x' })).toBe(403);
  });

  it('keeps organisations apart: grants, teams, people and objects of one are invisible and unusable from another', async () => {
    const a = await setup('acc-a@example.com');
    const b = await setup('acc-b@example.com');
    const outsider = await db.addMember(a.owner, 'acc-out@example.com', 'member');
    const team = ((await db.call('POST', `${org(b.owner)}/teams`, { name: 'B team' }, b.owner.session)).body as { id: string }).id;
    // A cannot reach B's management routes, nor grant B's team or space, nor put B's person in A's team
    expect(await status(a.owner, 'GET', '/members')).toBe(200);
    expect((await db.call('GET', `${org(b.owner)}/members`, undefined, a.owner.session)).status).toBe(404);
    expect((await db.call('POST', `${org(b.owner)}/grants`, { subjectType: 'user', subjectId: outsider.userId, kind: 'space', objectId: String(b.space), level: 'manage' }, a.owner.session)).status).toBe(404);
    expect((await grant(a.owner, { subjectType: 'team', subjectId: team, kind: 'space', objectId: String(a.space), level: 'view' })).status).toBe(400);
    expect((await grant(a.owner, { subjectType: 'user', subjectId: outsider.userId, kind: 'space', objectId: String(b.space), level: 'view' })).status).toBe(400);
    const aTeam = ((await db.call('POST', `${org(a.owner)}/teams`, { name: 'A team' }, a.owner.session)).body as { id: string }).id;
    expect((await db.call('PUT', `${org(a.owner)}/teams/${aTeam}/members`, { userIds: [b.owner.userId] }, a.owner.session)).status).toBe(400);
    expect(await status(outsider, 'GET', `/spaces/${b.space}/tickets`)).toBe(404);
    expect((await db.rows('SELECT 1 FROM grants WHERE org_id = $1', [b.owner.orgId])).length).toBe(0);
  });

  it('lets only the owner, and an admin the owner has not switched off, manage people, teams and access', async () => {
    const { owner, space } = await setup('acc-mgr@example.com');
    const admin = await db.addMember(owner, 'acc-adm@example.com', 'admin');
    const member = await db.addMember(owner, 'acc-mem@example.com', 'member');
    expect(await status(admin, 'GET', '/members')).toBe(200);
    expect(await status(admin, 'POST', '/teams', { name: 'By admin' })).toBe(201);
    expect(await status(member, 'GET', '/members')).toBe(403);
    expect(await status(member, 'POST', '/teams', { name: 'Nope' })).toBe(403);
    expect((await db.call('POST', `${org(member)}/grants`, { subjectType: 'user', subjectId: member.userId, kind: 'space', objectId: String(space), level: 'manage' }, member.session)).status).toBe(403);
    // an admin cannot change roles, only the owner can; and the owner can switch an admin's access off
    expect(await status(admin, 'PATCH', `/members/${member.userId}`, { role: 'admin' })).toBe(403);
    expect((await db.call('PATCH', `${org(owner)}/members/${admin.userId}`, { manageAccess: false }, owner.session)).status).toBe(204);
    expect(await status(admin, 'GET', '/members')).toBe(403);
    expect(await status(admin, 'GET', `/spaces/${space}/tickets`)).toBe(200); // still an admin of the data
    const me = (await db.call('GET', `${org(admin)}/access`, undefined, admin.session)).body;
    expect(me).toEqual({ role: 'admin', canManageAccess: false });
  });

  it('never lets the owner be demoted or removed, an admin remove an admin, or a removed person keep any access', async () => {
    const { owner, space } = await setup('acc-rm@example.com');
    const admin = await db.addMember(owner, 'acc-rm-a@example.com', 'admin');
    const admin2 = await db.addMember(owner, 'acc-rm-b@example.com', 'admin');
    const member = await db.addMember(owner, 'acc-rm-m@example.com', 'member');
    await grant(owner, { subjectType: 'user', subjectId: member.userId, kind: 'space', objectId: String(space), level: 'edit' });
    expect((await db.call('PATCH', `${org(owner)}/members/${owner.userId}`, { role: 'member' }, owner.session)).status).toBe(400);
    expect((await db.call('DELETE', `${org(owner)}/members/${owner.userId}`, undefined, admin.session)).status).toBe(400);
    expect(await status(admin, 'DELETE', `/members/${admin2.userId}`)).toBe(403);
    expect(await status(admin, 'DELETE', `/members/${member.userId}`)).toBe(204);
    expect(await status(member, 'GET', `/spaces/${space}/tickets`)).toBe(404);
    expect((await db.rows('SELECT 1 FROM grants WHERE org_id = $1 AND subject_id = $2', [owner.orgId, member.userId])).length).toBe(0);
  });

  it('refuses unknown fields and made-up ids in management calls, a forged origin, and no session; and audits each change', async () => {
    const { owner, space } = await setup('acc-in@example.com');
    const p = await db.addMember(owner, 'acc-in-p@example.com', 'member');
    const good = { subjectType: 'user', subjectId: p.userId, kind: 'space', objectId: String(space), level: 'view' };
    for (const bad of [{ orgId: owner.orgId }, { level: 'god' }, { objectId: '999999' }, { subjectId: '00000000-0000-4000-8000-000000000000' }]) {
      expect((await grant(owner, { ...good, ...bad })).status, JSON.stringify(bad)).toBe(400);
    }
    expect((await db.call('POST', `${org(owner)}/grants`, good, { ...owner.session, Origin: 'https://evil.example' })).status).toBe(403);
    expect((await db.call('POST', `${org(owner)}/grants`, good)).status).toBe(401);
    await grant(owner, good);
    const audit = await db.rows<{ action: string }>("SELECT action FROM audit_log WHERE org_id = $1 AND action LIKE 'grant.%'", [owner.orgId]);
    expect(audit.map(a => a.action)).toEqual(['grant.set']);
  });

  it('refuses duplicate team names, and removes a team\'s grants when the team is deleted', async () => {
    const { owner, space } = await setup('acc-team@example.com');
    const t = (await db.call('POST', `${org(owner)}/teams`, { name: 'Design' }, owner.session)).body as { id: string };
    expect((await db.call('POST', `${org(owner)}/teams`, { name: 'design' }, owner.session)).status).toBe(409);
    await grant(owner, { subjectType: 'team', subjectId: t.id, kind: 'space', objectId: String(space), level: 'view' });
    expect((await db.call('DELETE', `${org(owner)}/teams/${t.id}`, undefined, owner.session)).status).toBe(204);
    expect((await db.rows('SELECT 1 FROM grants WHERE org_id = $1', [owner.orgId])).length).toBe(0);
  });
});
