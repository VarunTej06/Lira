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
  const base = (orgId: string, box: string) => `/api/orgs/${orgId}/objects/storybox/${box}`;
  type Room = { now: string; activeTicketId: number | null; rounds: { ticketId: number; phase: string; voted: number; finalPoints: number | null }[]; votes: { ticketId: number; userId: string; points: number }[]; people: { userId: string; voted: boolean }[] };
  const room = async (p: Person, orgId: string, box: string) => (await db.call('GET', `${base(orgId, box)}/room`, undefined, p.session)).body as Room;
  const vote = (p: Person, orgId: string, box: string, ticket: number, points: number | null) => db.call('PUT', `${base(orgId, box)}/votes/${ticket}`, { points }, p.session);
  const round = (p: Person, orgId: string, box: string, ticket: number, action: 'start' | 'reveal' | 'revote' | 'confirm', body?: object) =>
    db.call('POST', `${base(orgId, box)}/rounds/${ticket}/${action}`, body, p.session);

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

  it('lets only the people who run the box start, reveal, redo and confirm a round, and one ticket at a time', async () => {
    const { owner, member, a, ta } = await setup();
    const second = ((await db.call('POST', `/api/orgs/${owner.orgId}/spaces/${a}/tickets`, ticket, owner.session)).body as { id: number }).id;
    for (const action of ['start', 'reveal', 'revote'] as const) expect((await round(member, owner.orgId, 'box1', ta, action)).status, action).toBe(403);
    expect((await round(member, owner.orgId, 'box1', ta, 'confirm', { points: 3 })).status).toBe(403);
    expect((await vote(member, owner.orgId, 'box1', ta, 3)).status).toBe(409); // nothing is being voted on yet
    expect((await round(owner, owner.orgId, 'box1', ta, 'start')).status).toBe(204);
    expect((await round(owner, owner.orgId, 'box1', second, 'start')).status).toBe(409); // another ticket is still open
    expect((await round(owner, owner.orgId, 'box1', ta, 'confirm', { points: 3 })).status).toBe(409); // not revealed yet
    await round(owner, owner.orgId, 'box1', ta, 'reveal');
    expect((await round(owner, owner.orgId, 'box1', ta, 'confirm', { points: 5 })).status).toBe(204);
    expect((await round(owner, owner.orgId, 'box1', ta, 'confirm', { points: 5 })).status).toBe(409); // already sized
    expect((await round(owner, owner.orgId, 'box1', second, 'start')).status).toBe(204); // the next one may start
    expect((await room(member, owner.orgId, 'box1')).rounds.find(r => r.ticketId === ta)).toMatchObject({ phase: 'confirmed', finalPoints: 5 });
  });

  it("keeps everyone's points hidden until the reveal, but lets each person change their own until then", async () => {
    const { owner, member, ta } = await setup();
    await round(owner, owner.orgId, 'box1', ta, 'start');
    expect((await vote(member, owner.orgId, 'box1', ta, 5)).status).toBe(204);
    expect((await vote(member, owner.orgId, 'box1', ta, 2)).status).toBe(204); // changed their mind before the time ran out
    expect((await vote(owner, owner.orgId, 'box1', ta, 8)).status).toBe(204);
    const seenByMember = await room(member, owner.orgId, 'box1');
    expect(seenByMember.votes.map(v => [v.userId === member.userId, v.points])).toEqual([[true, 2]]); // only their own
    expect(seenByMember.rounds[0]).toMatchObject({ phase: 'voting', voted: 2 });
    expect(seenByMember.people.filter(p => p.voted).length).toBe(2); // who has voted is known, not what
    await round(owner, owner.orgId, 'box1', ta, 'reveal');
    const after = await room(member, owner.orgId, 'box1');
    expect(after.votes.map(v => [v.userId === member.userId ? 'member' : 'owner', v.points]).sort()).toEqual([['member', 2], ['owner', 8]]);
    expect((await vote(member, owner.orgId, 'box1', ta, 3)).status).toBe(409); // no more changes once revealed
  });

  it('stops votes when the time is up, waits for the reveal, and starts again with new points on a revote', async () => {
    const { owner, member, ta } = await setup();
    await round(owner, owner.orgId, 'box1', ta, 'start');
    await vote(member, owner.orgId, 'box1', ta, 5);
    await db.rows("UPDATE story_rounds SET ends_at = now() - interval '1 second' WHERE org_id = $1 RETURNING 1 AS ok", [owner.orgId]);
    const late = await vote(member, owner.orgId, 'box1', ta, 8);
    expect(late.status).toBe(409);
    expect((late.body as { error: { code: string } }).error.code).toBe('voting_closed');
    expect((await room(owner, owner.orgId, 'box1')).rounds[0].phase).toBe('timeup');
    expect((await room(member, owner.orgId, 'box1')).votes.length).toBe(1); // still hidden until someone reveals
    await round(owner, owner.orgId, 'box1', ta, 'revote');
    const fresh = await room(owner, owner.orgId, 'box1');
    expect(fresh.rounds[0]).toMatchObject({ phase: 'voting', voted: 0 });
    expect(fresh.votes).toEqual([]);
    expect((await vote(member, owner.orgId, 'box1', ta, 8)).status).toBe(204);
  });

  it('gives the minutes the maker chose, 5 for a box made before that, and ignores anything outside 1 to 10', async () => {
    const { owner, a, ta } = await setup();
    const minutes = async (box: string) => (await db.rows<{ m: number }>('SELECT round(extract(epoch FROM ends_at - started_at) / 60)::int AS m FROM story_rounds WHERE org_id = $1 AND box_id = $2', [owner.orgId, box]))[0]?.m;
    await put(owner, owner.orgId, 'storybox', 'two', { id: 'two', name: 'Two', status: 'open', votingMinutes: 2, scope: { type: 'space', spaceId: a } });
    await round(owner, owner.orgId, 'two', ta, 'start');
    expect(await minutes('two')).toBe(2);
    await put(owner, owner.orgId, 'storybox', 'old', { id: 'old', name: 'Old', status: 'open', scope: { type: 'space', spaceId: a } });
    await round(owner, owner.orgId, 'old', ta, 'start');
    expect(await minutes('old')).toBe(5);
    await put(owner, owner.orgId, 'storybox', 'wild', { id: 'wild', name: 'Wild', status: 'open', votingMinutes: 600, scope: { type: 'space', spaceId: a } });
    await round(owner, owner.orgId, 'wild', ta, 'start');
    expect(await minutes('wild')).toBe(5);
  });

  it('lists who may take part, and not a member with no access to the box', async () => {
    const { owner, member, ta } = await setup();
    const outsider = await db.addMember(owner, `sb-roster${n}@example.com`, 'member');
    await round(owner, owner.orgId, 'box1', ta, 'start');
    const ids = (await room(owner, owner.orgId, 'box1')).people.map(p => p.userId).sort();
    expect(ids).toEqual([owner.userId, member.userId].sort());
    expect(ids).not.toContain(outsider.userId);
  });

  it('refuses points that are not valid, a ticket the person may not see, a closed box, and anyone from another organisation', async () => {
    const { owner, member, a, ta, tb } = await setup();
    await round(owner, owner.orgId, 'box1', ta, 'start');
    for (const bad of [-1, 1001, 1.3, 'five', undefined]) expect((await db.call('PUT', `${base(owner.orgId, 'box1')}/votes/${ta}`, { points: bad }, member.session)).status, String(bad)).toBe(400);
    expect((await db.call('PUT', `${base(owner.orgId, 'box1')}/votes/${ta}`, { points: 3, extra: 1 }, member.session)).status).toBe(400);
    expect((await round(owner, owner.orgId, 'box1', ta, 'confirm', { points: -2 })).status).toBe(400);
    expect((await vote(member, owner.orgId, 'box1', tb, 3)).status).toBe(404); // a ticket of a space they may not see
    expect((await vote(member, owner.orgId, 'box1', 999999, 3)).status).toBe(404);
    await put(owner, owner.orgId, 'storybox', 'box1', { id: 'box1', name: 'Alpha estimate', status: 'closed', scope: { type: 'space', spaceId: a } }, 1);
    expect((await vote(member, owner.orgId, 'box1', ta, 3)).status).toBe(409);
    expect((await round(owner, owner.orgId, 'box1', ta, 'revote')).status).toBe(409);
    const stranger = await db.signUp(`sb-stranger${++n}@example.com`);
    expect((await vote(stranger, owner.orgId, 'box1', ta, 3)).status).toBe(404);
    expect((await db.call('GET', `${base(owner.orgId, 'box1')}/room`, undefined, stranger.session)).status).toBe(404);
    expect((await round(stranger, owner.orgId, 'box1', ta, 'reveal')).status).toBe(404);
    expect((await db.call('PUT', `${base(owner.orgId, 'box1')}/votes/${ta}`, { points: 3 })).status).toBe(401);
  });

  it('keeps a person from seeing or voting in a box they have no access to', async () => {
    const { owner } = await setup();
    const outsider = await db.addMember(owner, `sb-out${n}@example.com`, 'member'); // a member with no grant at all
    expect(await ids(outsider, owner.orgId, 'storybox')).toEqual([]);
    expect((await db.call('GET', `${base(owner.orgId, 'box1')}/room`, undefined, outsider.session)).status).toBe(404);
    expect((await vote(outsider, owner.orgId, 'box1', 1, 3)).status).toBe(404);
  });

  it('sums up the sized tickets and points of each box the person may view, and only of those', async () => {
    const { owner, member, a, ta } = await setup();
    const second = ((await db.call('POST', `/api/orgs/${owner.orgId}/spaces/${a}/tickets`, ticket, owner.session)).body as { id: number }).id;
    for (const [t, p] of [[ta, 5], [second, 3]] as const) {
      await round(owner, owner.orgId, 'box1', t, 'start');
      await round(owner, owner.orgId, 'box1', t, 'reveal');
      await round(owner, owner.orgId, 'box1', t, 'confirm', { points: p });
    }
    await put(owner, owner.orgId, 'storybox', 'sprint1', { id: 'sprint1', name: 'Sprint', status: 'open', scope: { type: 'sprint', sprintKey: '2026-11' } });
    await round(owner, owner.orgId, 'sprint1', ta, 'start');
    await round(owner, owner.orgId, 'sprint1', ta, 'reveal');
    await round(owner, owner.orgId, 'sprint1', ta, 'confirm', { points: 8 });
    const sums = async (p: Person) => ((await db.call('GET', `/api/orgs/${owner.orgId}/storybox-summary`, undefined, p.session)).body as { boxId: string; sized: number; points: number }[]).sort((x, y) => x.boxId.localeCompare(y.boxId));
    expect(await sums(owner)).toEqual([{ boxId: 'box1', sized: 2, points: 8 }, { boxId: 'sprint1', sized: 1, points: 8 }]);
    expect(await sums(member)).toEqual([{ boxId: 'box1', sized: 2, points: 8 }]); // the sprint box is not shared with them
    const stranger = await db.signUp(`sb-sum${++n}@example.com`);
    expect((await db.call('GET', `/api/orgs/${owner.orgId}/storybox-summary`, undefined, stranger.session)).status).toBe(404);
    expect((await db.call('GET', `/api/orgs/${owner.orgId}/storybox-summary`)).status).toBe(401);
  });

  it("removes a box's votes and rounds with the box, and the audit log says who did what", async () => {
    const { owner, member, ta } = await setup();
    await round(owner, owner.orgId, 'box1', ta, 'start');
    await vote(member, owner.orgId, 'box1', ta, 5);
    await round(owner, owner.orgId, 'box1', ta, 'reveal');
    expect((await db.rows("SELECT 1 FROM audit_log WHERE action = 'storybox.vote' AND actor = $1", [member.userId])).length).toBe(1);
    expect((await db.rows("SELECT 1 FROM audit_log WHERE action IN ('storybox.start', 'storybox.reveal') AND actor = $1", [owner.userId])).length).toBe(2);
    expect((await db.call('DELETE', `/api/orgs/${owner.orgId}/objects/storybox/box1`, { version: 1 }, owner.session)).status).toBe(204);
    expect((await db.rows('SELECT 1 FROM story_votes WHERE org_id = $1', [owner.orgId])).length).toBe(0);
    expect((await db.rows('SELECT 1 FROM story_rounds WHERE org_id = $1', [owner.orgId])).length).toBe(0);
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
