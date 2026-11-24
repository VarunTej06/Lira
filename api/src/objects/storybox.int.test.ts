import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_URL, startRealDb, type RealDb } from '../testing/realDb';

const ticket = {
  title: 'Estimate me', type: 'task', status: 'todo', priority: 'medium', rank: 1000, description: '<p>x</p>',
  reporter: 'Test Person', reporterInitials: 'TP', labels: [], subtasks: [], comments: [], activity: [], linkedIssues: [], watchers: [],
};

describe.skipIf(!ADMIN_URL)('story boxes and mind maps, on a real database', () => {
  let db: RealDb;
  beforeAll(async () => { db = await startRealDb(); });
  afterAll(async () => { await db?.stop(); });

  type Person = Awaited<ReturnType<RealDb['signUp']>>;
  let n = 0;
  const put = (p: Person, orgId: string, kind: string, id: string, doc: object, version?: number) =>
    db.call('PUT', `/api/orgs/${orgId}/objects/${kind}/${id}`, { doc, ...(version ? { version } : {}) }, p.session);
  const ids = async (p: Person, orgId: string, kind: string) =>
    ((await db.call('GET', `/api/orgs/${orgId}/objects/${kind}`, undefined, p.session)).body as { id: string }[]).map(o => o.id).sort();
  const votes = (p: Person, orgId: string, box: string) => db.call('GET', `/api/orgs/${orgId}/objects/storybox/${box}/votes`, undefined, p.session);
  const vote = (p: Person, orgId: string, box: string, ticket: number, points: number | null) =>
    db.call('PUT', `/api/orgs/${orgId}/objects/storybox/${box}/votes/${ticket}`, { points }, p.session);

  /** An owner with two spaces and a ticket in each, a story box for the first, and a member who may view only the first. */
  async function setup() {
    const owner = await db.signUp(`sb-owner${++n}@example.com`);
    const space = async (key: string) => ((await db.call('POST', `/api/orgs/${owner.orgId}/spaces`, { key, name: key, icon: 'x', color: '#336699' }, owner.session)).body as { id: number }).id;
    const a = await space('AAA'); const b = await space('BBB');
    const tid = async (s: number) => ((await db.call('POST', `/api/orgs/${owner.orgId}/spaces/${s}/tickets`, ticket, owner.session)).body as { id: number }).id;
    const ta = await tid(a); const tb = await tid(b);
    const member = await db.addMember(owner, `sb-member${n}@example.com`, 'member');
    await db.call('POST', `/api/orgs/${owner.orgId}/grants`, { subjectType: 'user', subjectId: member.userId, kind: 'space', objectId: String(a), level: 'view' }, owner.session);
    expect((await put(owner, owner.orgId, 'storybox', 'box1', { id: 'box1', name: 'Alpha estimate', status: 'open', scope: { type: 'space', spaceId: a } })).status).toBeLessThan(300);
    return { owner, member, a, b, ta, tb };
  }

  it('lets only an Owner or Admin make a story box, and a member of the space only see it', async () => {
    const { owner, member, a } = await setup();
    expect((await put(member, owner.orgId, 'storybox', 'mine', { id: 'mine', name: 'x', scope: { type: 'space', spaceId: a } })).status).toBe(403);
    expect(await ids(member, owner.orgId, 'storybox')).toEqual(['box1']); // tied to the space they may view
    expect((await put(member, owner.orgId, 'storybox', 'box1', { id: 'box1', name: 'Changed', status: 'open', scope: { type: 'space', spaceId: a } }, 1)).status).toBe(403);
    expect((await db.call('DELETE', `/api/orgs/${owner.orgId}/objects/storybox/box1`, { version: 1 }, member.session)).status).toBe(403);
  });

  it('shows a story box for a sprint, which crosses spaces, only to people it was shared with', async () => {
    const { owner, member } = await setup();
    await put(owner, owner.orgId, 'storybox', 'sprint1', { id: 'sprint1', name: 'Sprint', status: 'open', scope: { type: 'sprint', sprintKey: '2026-11' } });
    expect(await ids(member, owner.orgId, 'storybox')).toEqual(['box1']);
    await db.call('POST', `/api/orgs/${owner.orgId}/grants`, { subjectType: 'user', subjectId: member.userId, kind: 'storybox', objectId: 'sprint1', level: 'view' }, owner.session);
    expect(await ids(member, owner.orgId, 'storybox')).toEqual(['box1', 'sprint1']);
  });

  it('lets a person who may view the box give, change and take back their own points, and see everyone\'s', async () => {
    const { owner, member, ta } = await setup();
    expect((await vote(member, owner.orgId, 'box1', ta, 5)).status).toBe(204);
    expect((await vote(owner, owner.orgId, 'box1', ta, 8)).status).toBe(204);
    expect((await vote(member, owner.orgId, 'box1', ta, 3)).status).toBe(204);
    const seen = (await votes(member, owner.orgId, 'box1')).body as { ticketId: number; points: number; userId: string }[];
    expect(seen.map(v => [v.userId === member.userId ? 'member' : 'owner', v.points]).sort()).toEqual([['member', 3], ['owner', 8]]);
    expect((await vote(member, owner.orgId, 'box1', ta, null)).status).toBe(204);
    expect(((await votes(owner, owner.orgId, 'box1')).body as unknown[]).length).toBe(1);
    expect((await vote(member, owner.orgId, 'box1', ta, 0.5)).status).toBe(204);
  });

  it('refuses points that are not valid, a ticket the person may not see, a closed box, and anyone from another organisation', async () => {
    const { owner, member, a, ta, tb } = await setup();
    for (const bad of [-1, 1001, 1.3, 'five', undefined]) expect((await db.call('PUT', `/api/orgs/${owner.orgId}/objects/storybox/box1/votes/${ta}`, { points: bad }, member.session)).status, String(bad)).toBe(400);
    expect((await db.call('PUT', `/api/orgs/${owner.orgId}/objects/storybox/box1/votes/${ta}`, { points: 3, extra: 1 }, member.session)).status).toBe(400);
    expect((await vote(member, owner.orgId, 'box1', tb, 3)).status).toBe(404); // a ticket of a space they may not see
    expect((await vote(member, owner.orgId, 'box1', 999999, 3)).status).toBe(404);
    await put(owner, owner.orgId, 'storybox', 'box1', { id: 'box1', name: 'Alpha estimate', status: 'closed', scope: { type: 'space', spaceId: a } }, 1);
    expect((await vote(member, owner.orgId, 'box1', ta, 3)).status).toBe(409);
    const stranger = await db.signUp(`sb-stranger${++n}@example.com`);
    expect((await vote(stranger, owner.orgId, 'box1', ta, 3)).status).toBe(404);
    expect((await votes(stranger, owner.orgId, 'box1')).status).toBe(404);
    expect((await db.call('PUT', `/api/orgs/${owner.orgId}/objects/storybox/box1/votes/${ta}`, { points: 3 })).status).toBe(401);
  });

  it('keeps a person from seeing or voting in a box they have no access to', async () => {
    const { owner, a } = await setup();
    const outsider = await db.addMember(owner, `sb-out${n}@example.com`, 'member'); // a member with no grant at all
    expect(await ids(outsider, owner.orgId, 'storybox')).toEqual([]);
    expect((await votes(outsider, owner.orgId, 'box1')).status).toBe(404);
    expect((await vote(outsider, owner.orgId, 'box1', 1, 3)).status).toBe(404);
    void a;
  });

  it('removes a box\'s votes with the box, and the audit log says who voted', async () => {
    const { owner, member, ta } = await setup();
    await vote(member, owner.orgId, 'box1', ta, 5);
    expect((await db.rows('SELECT 1 FROM audit_log WHERE action = \'storybox.vote\' AND actor = $1', [member.userId])).length).toBe(1);
    expect((await db.call('DELETE', `/api/orgs/${owner.orgId}/objects/storybox/box1`, { version: 1 }, owner.session)).status).toBe(204);
    expect((await db.rows('SELECT 1 FROM story_votes WHERE org_id = $1', [owner.orgId])).length).toBe(0);
  });

  it('lets anyone who is not a Viewer or Guest make a mind map that is theirs alone until it is shared', async () => {
    const { owner, member } = await setup();
    expect((await put(member, owner.orgId, 'mindmap', 'mm1', { id: 'mm1', name: 'My map', nodes: [] })).status).toBeLessThan(300);
    expect(await ids(member, owner.orgId, 'mindmap')).toEqual(['mm1']);
    const other = await db.addMember(owner, `sb-other${n}@example.com`, 'member');
    expect(await ids(other, owner.orgId, 'mindmap')).toEqual([]);
    expect((await put(other, owner.orgId, 'mindmap', 'mm1', { id: 'mm1', name: 'Mine now', nodes: [] }, 1)).status).toBe(404);
    await db.call('POST', `/api/orgs/${owner.orgId}/grants`, { subjectType: 'user', subjectId: other.userId, kind: 'mindmap', objectId: 'mm1', level: 'view' }, owner.session);
    expect(await ids(other, owner.orgId, 'mindmap')).toEqual(['mm1']);
    expect((await put(other, owner.orgId, 'mindmap', 'mm1', { id: 'mm1', name: 'Mine now', nodes: [] }, 1)).status).toBe(403);
    const viewer = await db.addMember(owner, `sb-viewer${n}@example.com`, 'viewer');
    expect((await put(viewer, owner.orgId, 'mindmap', 'mm2', { id: 'mm2', name: 'x', nodes: [] })).status).toBe(403);
    expect(await ids(owner, owner.orgId, 'mindmap')).toEqual(['mm1']); // an Owner sees all of them
  });
});
