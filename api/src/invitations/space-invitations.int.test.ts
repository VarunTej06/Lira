import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_URL, startRealDb, type RealDb } from '../testing/realDb';

const ticket = {
  title: 'Fix the board', type: 'task', status: 'todo', priority: 'medium', rank: 1000, description: '<p>text</p>',
  reporter: 'Asha Rao', reporterInitials: 'AR', labels: [], subtasks: [], comments: [], activity: [], linkedIssues: [], watchers: [],
};

describe.skipIf(!ADMIN_URL)('inviting someone to one space', () => {
  let db: RealDb;
  beforeAll(async () => { db = await startRealDb(); });
  afterAll(async () => { await db?.stop(); });

  type Person = Awaited<ReturnType<RealDb['signUp']>>;
  let n = 0;
  const space = async (p: Person, key: string) =>
    ((await db.call('POST', `/api/orgs/${p.orgId}/spaces`, { key, name: `Space ${key}`, icon: 'rocket', color: '#336699' }, p.session)).body as { id: number }).id;
  const tickets = (orgId: string, spaceId: number) => `/api/orgs/${orgId}/spaces/${spaceId}/tickets`;
  const invite = (owner: Person, email: string, body: object) => db.call('POST', `/api/orgs/${owner.orgId}/invitations`, { email, ...body }, owner.session);

  /** An owner with two spaces, one ticket in each. */
  async function setup() {
    const owner = await db.signUp(`owner${++n}@example.com`);
    const a = await space(owner, 'AAA'); const b = await space(owner, 'BBB');
    await db.call('POST', tickets(owner.orgId, a), ticket, owner.session);
    await db.call('POST', tickets(owner.orgId, b), { ...ticket, title: 'Secret plan' }, owner.session);
    return { owner, a, b };
  }
  /** The invited person signs up with the invited address and accepts. They land in their own workspace; the shared one is another entry. */
  async function join(owner: Person, email: string, token: string) {
    const person = await db.signUp(email);
    const accepted = await db.call('POST', '/api/invitations/accept', { token }, person.session);
    expect(accepted.status).toBe(200);
    const me = (await db.call('GET', '/api/me', undefined, person.session)).body as { organisations: { orgId: string; role: string; hideSprints: boolean }[] };
    expect(me.organisations[0].orgId).toBe(person.orgId);
    const shared = me.organisations.find(o => o.orgId === owner.orgId)!;
    return { person, orgId: owner.orgId, role: shared.role, hideSprints: shared.hideSprints };
  }

  it('gives the invited person that one space and nothing else, with all of its tickets', async () => {
    const { owner, a, b } = await setup();
    const sent = await invite(owner, 'guest1@example.com', { role: 'guest', spaceId: a, level: 'edit' });
    expect(sent.status).toBe(201);
    expect(sent.body).toMatchObject({ spaceId: a, level: 'edit', shares: { projects: true, roadmaps: true, dashboards: true, sprints: true } });
    const { person, orgId, role } = await join(owner, 'guest1@example.com', (sent.body as { token: string }).token);
    expect(role).toBe('guest');
    const spaces = (await db.call('GET', `/api/orgs/${orgId}/spaces`, undefined, person.session)).body as { id: number }[];
    expect(spaces.map(s => s.id)).toEqual([a]);
    const inA = await db.call('GET', tickets(orgId, a), undefined, person.session);
    expect(inA.status).toBe(200);
    expect((inA.body as { title: string }[]).map(t => t.title)).toEqual(['Fix the board']);
    expect((await db.call('GET', tickets(orgId, b), undefined, person.session)).status).toBe(404);
    expect((await db.call('GET', `/api/orgs/${orgId}/teams`, undefined, person.session)).status).toBeGreaterThanOrEqual(403);
  });

  it('lets them work in the space as far as the access allows: edit can add tickets, view cannot, and a Viewer role never can', async () => {
    const { owner, a } = await setup();
    const editor = await invite(owner, 'edit@example.com', { role: 'guest', spaceId: a, level: 'edit' });
    const viewer = await invite(owner, 'view@example.com', { role: 'guest', spaceId: a, level: 'view' });
    const capped = await invite(owner, 'capped@example.com', { role: 'viewer', spaceId: a, level: 'edit' });
    const e = await join(owner, 'edit@example.com', (editor.body as { token: string }).token);
    const v = await join(owner, 'view@example.com', (viewer.body as { token: string }).token);
    const c = await join(owner, 'capped@example.com', (capped.body as { token: string }).token);
    expect((await db.call('POST', tickets(e.orgId, a), { ...ticket, title: 'Mine' }, e.person.session)).status).toBe(201);
    expect((await db.call('POST', tickets(v.orgId, a), ticket, v.person.session)).status).toBe(403);
    expect((await db.call('GET', tickets(v.orgId, a), undefined, v.person.session)).status).toBe(200);
    expect((await db.call('POST', tickets(c.orgId, a), ticket, c.person.session)).status).toBe(403);
  });

  it('refuses a space invitation that is incomplete, for an Admin, for a space that is not in the organisation, or with extra fields', async () => {
    const { owner, a } = await setup();
    const other = await db.signUp(`other${++n}@example.com`);
    const foreign = await space(other, 'ZZZ');
    expect((await invite(owner, 'x1@example.com', { role: 'guest', spaceId: a })).status).toBe(400);
    expect((await invite(owner, 'x2@example.com', { role: 'guest', level: 'edit' })).status).toBe(400);
    expect((await invite(owner, 'x3@example.com', { role: 'admin', spaceId: a, level: 'edit' })).status).toBe(400);
    expect((await invite(owner, 'x4@example.com', { role: 'guest', spaceId: 999999, level: 'edit' })).status).toBe(404);
    expect((await invite(owner, 'x5@example.com', { role: 'guest', spaceId: foreign, level: 'edit' })).status).toBe(404); // another organisation's space
    expect((await invite(owner, 'x6@example.com', { role: 'guest', spaceId: a, level: 'edit', orgId: 'x' })).status).toBe(400);
    expect((await invite(owner, 'x7@example.com', { role: 'guest', spaceId: a, level: 'god' })).status).toBe(400);
    expect((await invite(owner, 'x8@example.com', { role: 'guest', shares: { projects: false } })).status).toBe(400); // switches need a space
    expect((await invite(owner, 'x9@example.com', { role: 'guest', spaceId: a, level: 'edit', shares: { everything: true } })).status).toBe(400);
  });

  it('lists the space, access and switches on the pending invitation, and records them in the audit log', async () => {
    const { owner, a } = await setup();
    await invite(owner, 'pending@example.com', { role: 'guest', spaceId: a, level: 'view', shares: { sprints: false } });
    const list = (await db.call('GET', `/api/orgs/${owner.orgId}/invitations`, undefined, owner.session)).body as { email: string; spaceId: number; level: string; shares: { sprints: boolean; projects: boolean } }[];
    expect(list.find(i => i.email === 'pending@example.com')).toMatchObject({ spaceId: a, level: 'view', shares: { sprints: false, projects: true } });
    const audit = await db.rows<{ detail: { spaceId: number; sprints: boolean } }>("SELECT detail FROM audit_log WHERE action = 'invitation.create' ORDER BY id DESC LIMIT 1");
    expect(audit[0].detail).toMatchObject({ spaceId: a, sprints: false });
  });

  it('names the space in the invitation email', async () => {
    const { owner, a } = await setup();
    await invite(owner, 'named@example.com', { role: 'guest', spaceId: a, level: 'edit' });
    const mail = [...db.emails.sent].reverse().find(m => m.to === 'named@example.com');
    expect(mail?.text).toContain('the space "Space AAA"');
    expect(mail?.text).toContain('edit access');
  });

  describe('what else of the space they see', () => {
    const put = (p: Person, orgId: string, kind: string, id: string, doc: object) => db.call('PUT', `/api/orgs/${orgId}/objects/${kind}/${id}`, { doc }, p.session);
    const ids = async (p: Person, orgId: string, kind: string) =>
      ((await db.call('GET', `/api/orgs/${orgId}/objects/${kind}`, undefined, p.session)).body as { id: string }[]).map(o => o.id).sort();
    const shares = (orgId: string, a: number, userId: string) => `/api/orgs/${orgId}/spaces/${a}/shares/${userId}`;

    /** An owner with two spaces and a project, a roadmap and a dashboard tied to each, plus ones tied to none or to both. */
    async function withObjects() {
      const { owner, a, b } = await setup();
      const objects: [string, string, object][] = [
        ['project', 'pa', { name: 'In A', spaceId: a }], ['project', 'pb', { name: 'In B', spaceId: b }], ['project', 'pn', { name: 'Loose' }],
        ['roadmap', 'ra', { name: 'In A', spaceKey: 'AAA' }], ['roadmap', 'rb', { name: 'In B', spaceKey: 'BBB' }],
        ['dashboard', 'da', { name: 'Only A', filters: { spaceIds: [a] } }], ['dashboard', 'dab', { name: 'A and B', filters: { spaceIds: [a, b] } }], ['dashboard', 'dall', { name: 'All', filters: { spaceIds: [] } }],
      ];
      for (const [kind, id, doc] of objects) expect((await put(owner, owner.orgId, kind, id, doc)).status, id).toBeLessThan(300);
      return { owner, a, b };
    }
    const member = async (owner: Person, a: number, email: string, extra: object = {}, level = 'edit') => {
      const sent = await invite(owner, email, { role: 'member', spaceId: a, level, ...extra });
      expect(sent.status).toBe(201);
      return join(owner, email, (sent.body as { token: string }).token);
    };

    it('shows the projects, roadmaps and single-space dashboards of the invited space, and nothing tied to other spaces or to none', async () => {
      const { owner, a } = await withObjects();
      const g = await member(owner, a, 'tied@example.com');
      expect(await ids(g.person, g.orgId, 'project')).toEqual(['pa']);
      expect(await ids(g.person, g.orgId, 'roadmap')).toEqual(['ra']);
      expect(await ids(g.person, g.orgId, 'dashboard')).toEqual(['da']);
    });

    it('hides each kind when its switch is off, and only that kind', async () => {
      const { owner, a } = await withObjects();
      const g = await member(owner, a, 'nop@example.com', { shares: { projects: false } });
      expect(await ids(g.person, g.orgId, 'project')).toEqual([]);
      expect(await ids(g.person, g.orgId, 'roadmap')).toEqual(['ra']);
      expect(await ids(g.person, g.orgId, 'dashboard')).toEqual(['da']);
      const h = await member(owner, a, 'none@example.com', { shares: { projects: false, roadmaps: false, dashboards: false } });
      for (const kind of ['project', 'roadmap', 'dashboard']) expect(await ids(h.person, h.orgId, kind), kind).toEqual([]);
      expect((await db.call('PUT', `/api/orgs/${h.orgId}/objects/project/pa`, { doc: { name: 'x', spaceId: a }, version: 1 }, h.person.session)).status).toBe(404);
    });

    it('says in the session when sprints are switched off for someone whose only access is through spaces, and not otherwise', async () => {
      const { owner, a } = await withObjects();
      expect((await member(owner, a, 'sp-on@example.com')).hideSprints).toBe(false);
      expect((await member(owner, a, 'sp-off@example.com', { shares: { sprints: false } })).hideSprints).toBe(true);
      const me = (await db.call('GET', '/api/me', undefined, owner.session)).body as { organisations: { hideSprints: boolean }[] };
      expect(me.organisations[0].hideSprints).toBe(false);
    });

    it('lets the owner change the switches later, which takes effect at once, and refuses anyone else', async () => {
      const { owner, a } = await withObjects();
      const g = await member(owner, a, 'later@example.com');
      const listed = (await db.call('GET', `/api/orgs/${owner.orgId}/spaces/${a}/shares`, undefined, owner.session)).body as { userId: string; projects: boolean }[];
      expect(listed.find(s => s.userId === g.person.userId)).toMatchObject({ projects: true });
      expect((await db.call('PUT', shares(owner.orgId, a, g.person.userId), { projects: false }, owner.session)).status).toBe(204);
      expect(await ids(g.person, g.orgId, 'project')).toEqual([]);
      expect((await db.call('PUT', shares(owner.orgId, a, g.person.userId), { projects: true }, g.person.session)).status).toBeGreaterThanOrEqual(403);
      expect((await db.call('PUT', shares(owner.orgId, a, g.person.userId), {}, owner.session)).status).toBe(400);
      expect((await db.call('PUT', shares(owner.orgId, a, g.person.userId), { projects: true, role: 'owner' }, owner.session)).status).toBe(400);
      expect((await db.call('PUT', shares(owner.orgId, a, owner.userId), { projects: false }, owner.session)).status).toBe(404); // someone who was not invited
    });

    it('lets a person who can edit the space add a project or roadmap to it, but not to another space, and a viewer nothing', async () => {
      const { owner, a, b } = await withObjects();
      const g = await member(owner, a, 'maker@example.com');
      expect((await put(g.person, g.orgId, 'project', 'mine', { name: 'Mine', spaceId: a })).status).toBeLessThan(300);
      expect((await put(g.person, g.orgId, 'roadmap', 'mine-rm', { name: 'Mine', spaceKey: 'AAA' })).status).toBeLessThan(300);
      expect((await put(g.person, g.orgId, 'project', 'elsewhere', { name: 'No', spaceId: b })).status).toBe(403);
      expect((await put(g.person, g.orgId, 'project', 'loose', { name: 'No' })).status).toBe(403);
      const v = await member(owner, a, 'viewonly@example.com', {}, 'view');
      expect((await put(v.person, v.orgId, 'project', 'v1', { name: 'No', spaceId: a })).status).toBe(403);
      expect(await ids(owner, owner.orgId, 'project')).toContain('mine');
    });
  });
});
