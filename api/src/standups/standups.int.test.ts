import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_URL, startRealDb, type RealDb } from '../testing/realDb';

const LINK = 'https://meet.google.com/abc-defg-hij';

describe.skipIf(!ADMIN_URL)('stand-up calls on a real database', () => {
  let db: RealDb;
  beforeAll(async () => { db = await startRealDb(); });
  afterAll(async () => { await db?.stop(); });

  type Person = Awaited<ReturnType<RealDb['signUp']>>;
  const path = (p: Person, rest = '') => `/api/orgs/${p.orgId}/standups${rest}`;
  const body = (invitees: object[], extra: object = {}) => ({ title: 'Daily', startsAt: '2026-11-23T04:30:00Z', durationMinutes: 15, timeZone: 'Asia/Kolkata', link: LINK, invitees, ...extra });
  const create = (p: Person, invitees: object[], extra: object = {}) => db.call('POST', path(p), body(invitees, extra), p.session);
  const list = async (p: Person) => (await db.call('GET', path(p), undefined, p.session)).body as { id: string; title: string; link: string; invitees: object[] | null }[];

  it('lets the owner schedule a call for a team and chosen people, and emails each invited person once, not the maker', async () => {
    const owner = await db.signUp('su-owner@example.com');
    const a = await db.addMember(owner, 'su-a@example.com', 'member');
    const b = await db.addMember(owner, 'su-b@example.com', 'member');
    const team = ((await db.call('POST', `/api/orgs/${owner.orgId}/teams`, { name: 'Dev' }, owner.session)).body as { id: string }).id;
    await db.call('PUT', `/api/orgs/${owner.orgId}/teams/${team}/members`, { userIds: [a.userId, owner.userId] }, owner.session);
    const before = db.emails.sent.length;
    const r = await create(owner, [{ type: 'team', id: team }, { type: 'user', id: a.userId }, { type: 'user', id: b.userId }]);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ title: 'Daily', link: LINK, durationMinutes: 15, emailed: { sent: 2, total: 2 } });
    const mails = db.emails.sent.slice(before);
    expect(mails.map(m => m.to).sort()).toEqual(['su-a@example.com', 'su-b@example.com']);
    expect(mails[0].text).toContain(LINK);
  });

  it('shows a member only the calls they are invited to, directly or through a team, without the guest list, and lets them open the link', async () => {
    const owner = await db.signUp('su-vis@example.com');
    const direct = await db.addMember(owner, 'su-vis-d@example.com', 'member');
    const viaTeam = await db.addMember(owner, 'su-vis-t@example.com', 'viewer');
    const left = await db.addMember(owner, 'su-vis-x@example.com', 'guest');
    const team = ((await db.call('POST', `/api/orgs/${owner.orgId}/teams`, { name: 'T' }, owner.session)).body as { id: string }).id;
    await db.call('PUT', `/api/orgs/${owner.orgId}/teams/${team}/members`, { userIds: [viaTeam.userId] }, owner.session);
    await create(owner, [{ type: 'user', id: direct.userId }], { title: 'For direct' });
    await create(owner, [{ type: 'team', id: team }], { title: 'For team' });
    expect((await list(direct)).map(c => c.title)).toEqual(['For direct']);
    expect((await list(viaTeam)).map(c => c.title)).toEqual(['For team']);
    expect(await list(left)).toEqual([]);
    const seen = (await list(direct))[0];
    expect(seen.link).toBe(LINK);
    expect(seen.invitees).toBeNull();
    const all = await list(owner);
    expect(all.map(c => c.title).sort()).toEqual(['For direct', 'For team']);
    expect(all[0].invitees).not.toBeNull();
  });

  it('lets only Owner and Admin schedule, change, delete and see who can be invited', async () => {
    const owner = await db.signUp('su-perm@example.com');
    const admin = await db.addMember(owner, 'su-perm-a@example.com', 'admin');
    const member = await db.addMember(owner, 'su-perm-m@example.com', 'member');
    const made = (await create(admin, [{ type: 'user', id: member.userId }])).body as { id: string };
    expect((await create(member, [{ type: 'user', id: member.userId }])).status).toBe(403);
    expect((await db.call('PATCH', path(member, `/${made.id}`), { title: 'x' }, member.session)).status).toBe(403);
    expect((await db.call('DELETE', path(member, `/${made.id}`), undefined, member.session)).status).toBe(403);
    expect((await db.call('GET', path(member, '/audience'), undefined, member.session)).status).toBe(403);
    const audience = (await db.call('GET', path(admin, '/audience'), undefined, admin.session)).body as { people: { id: string }[]; teams: unknown[] };
    expect(audience.people.map(p => p.id)).toContain(member.userId);
    const changed = await db.call('PATCH', path(admin, `/${made.id}`), { title: 'Renamed', durationMinutes: 30 }, admin.session);
    expect(changed.body).toMatchObject({ title: 'Renamed', durationMinutes: 30, link: LINK });
    expect((await db.call('DELETE', path(owner, `/${made.id}`), undefined, owner.session)).status).toBe(204);
    expect(await list(owner)).toEqual([]);
  });

  it('keeps organisations apart: no seeing, changing, deleting or inviting across them', async () => {
    const a = await db.signUp('su-a-org@example.com');
    const b = await db.signUp('su-b-org@example.com');
    const made = (await create(b, [{ type: 'user', id: b.userId }])).body as { id: string };
    expect((await db.call('GET', path(b), undefined, a.session)).status).toBe(404);
    expect((await db.call('PATCH', path(a, `/${made.id}`), { title: 'mine' }, a.session)).status).toBe(404);
    expect((await db.call('DELETE', path(a, `/${made.id}`), undefined, a.session)).status).toBe(404);
    expect((await create(a, [{ type: 'user', id: b.userId }])).status).toBe(400);
    expect((await create(a, [{ type: 'team', id: '00000000-0000-4000-8000-000000000000' }])).status).toBe(400);
    expect(await list(a)).toEqual([]);
    expect((await db.rows('SELECT title FROM standup_calls WHERE id = $1', [made.id]))[0]).toEqual({ title: 'Daily' });
  });

  it('refuses a link that is not a meeting, unknown fields, no guests, no session, and a forged origin; and stores nothing', async () => {
    const owner = await db.signUp('su-bad@example.com');
    const g = [{ type: 'user', id: owner.userId }];
    for (const bad of [{ link: 'https://evil.example/x' }, { link: 'http://meet.google.com/x' }, { org_id: owner.orgId }, { durationMinutes: 1 }, { startsAt: 'soon' }]) {
      expect((await create(owner, g, bad)).status, JSON.stringify(bad)).toBe(400);
    }
    expect((await create(owner, [])).status).toBe(400);
    expect((await db.call('POST', path(owner), body(g))).status).toBe(401);
    expect((await db.call('POST', path(owner), body(g), { ...owner.session, Origin: 'https://evil.example' })).status).toBe(403);
    expect((await db.rows('SELECT 1 FROM standup_calls WHERE org_id = $1', [owner.orgId])).length).toBe(0);
  });

  it('audits each change without titles, links or addresses', async () => {
    const owner = await db.signUp('su-audit@example.com');
    const p = await db.addMember(owner, 'su-audit-p@example.com', 'member');
    const made = (await create(owner, [{ type: 'user', id: p.userId }], { title: 'Secret restructure' })).body as { id: string };
    await db.call('PATCH', path(owner, `/${made.id}`), { title: 'x' }, owner.session);
    await db.call('DELETE', path(owner, `/${made.id}`), undefined, owner.session);
    const rows = await db.rows<{ action: string }>("SELECT action, detail FROM audit_log WHERE org_id = $1 AND action LIKE 'standup.%' ORDER BY id", [owner.orgId]);
    expect(rows.map(r => r.action)).toEqual(['standup.create', 'standup.update', 'standup.delete']);
    expect(JSON.stringify(rows)).not.toMatch(/secret|meet\.google|su-audit/i);
  });

  it('removes a call from a person\'s list when they are removed from the organisation or from the team', async () => {
    const owner = await db.signUp('su-gone@example.com');
    const p = await db.addMember(owner, 'su-gone-p@example.com', 'member');
    const team = ((await db.call('POST', `/api/orgs/${owner.orgId}/teams`, { name: 'G' }, owner.session)).body as { id: string }).id;
    await db.call('PUT', `/api/orgs/${owner.orgId}/teams/${team}/members`, { userIds: [p.userId] }, owner.session);
    await create(owner, [{ type: 'team', id: team }]);
    expect(await list(p)).toHaveLength(1);
    await db.call('PUT', `/api/orgs/${owner.orgId}/teams/${team}/members`, { userIds: [] }, owner.session);
    expect(await list(p)).toHaveLength(0);
  });

  it('keeps a series: its rule, last day and time zone come back, an update can change or end it, and the email says it repeats', async () => {
    const owner = await db.signUp('su-series@example.com');
    const p = await db.addMember(owner, 'su-series-p@example.com', 'member');
    const before = db.emails.sent.length;
    const made = await create(owner, [{ type: 'user', id: p.userId }], { repeat: 'weekdays', repeatUntil: '2026-12-18', timeZone: 'Europe/London' });
    expect(made.body).toMatchObject({ repeat: 'weekdays', repeatUntil: '2026-12-18', timeZone: 'Europe/London', linkSource: 'pasted' });
    expect(db.emails.sent[before].text).toContain('repeats every weekday until 2026-12-18');
    expect(db.emails.sent[before].text).toContain('Europe/London');
    const id = (made.body as { id: string }).id;
    expect((await list(p))[0]).toMatchObject({ repeat: 'weekdays', repeatUntil: '2026-12-18' });
    const longer = await db.call('PATCH', path(owner, `/${id}`), { repeatUntil: '2027-01-15' }, owner.session);
    expect(longer.body).toMatchObject({ repeat: 'weekdays', repeatUntil: '2027-01-15' });
    const ended = await db.call('PATCH', path(owner, `/${id}`), { repeat: 'none' }, owner.session);
    expect(ended.body).toMatchObject({ repeat: 'none', repeatUntil: null });
    const needsDay = await db.call('PATCH', path(owner, `/${id}`), { repeat: 'daily' }, owner.session);
    expect(needsDay.status).toBe(400);
  });

  it('refuses a series with no end day, one over a year, an unknown time zone, and stores nothing', async () => {
    const owner = await db.signUp('su-series-bad@example.com');
    const g = [{ type: 'user', id: owner.userId }];
    for (const bad of [{ repeat: 'daily' }, { repeat: 'daily', repeatUntil: '2028-01-01' }, { timeZone: 'Mars/Olympus' }, { repeat: 'none', repeatUntil: '2026-12-01' }]) {
      expect((await create(owner, g, bad)).status, JSON.stringify(bad)).toBe(400);
    }
    expect((await db.rows('SELECT 1 FROM standup_calls WHERE org_id = $1', [owner.orgId])).length).toBe(0);
  });

  it('keeps what a call is for: a project, a sprint, a space or the whole organisation, and a member sees it only when invited', async () => {
    const owner = await db.signUp('su-scope@example.com');
    const p = await db.addMember(owner, 'su-scope-p@example.com', 'member');
    const other = await db.addMember(owner, 'su-scope-o@example.com', 'member');
    const g = [{ type: 'user', id: p.userId }];
    const sync = await create(owner, g, { title: 'Weekly sync', scopeType: 'project', scopeId: 'proj-lira-core', scopeName: 'Lira Core Platform' });
    expect(sync.body).toMatchObject({ scopeType: 'project', scopeId: 'proj-lira-core', scopeName: 'Lira Core Platform' });
    await create(owner, g, { title: 'Sprint review', scopeType: 'sprint', scopeId: '2026-11', scopeName: 'November 2026' });
    await create(owner, g, { title: 'Everyone', startsAt: '2026-11-24T04:30:00Z' });
    const mine = (await list(p)) as unknown as { title: string; scopeType: string; scopeId: string }[];
    expect(mine.map(c => [c.title, c.scopeType, c.scopeId]).sort()).toEqual([['Everyone', 'org', ''], ['Sprint review', 'sprint', '2026-11'], ['Weekly sync', 'project', 'proj-lira-core']]);
    expect(await list(other)).toEqual([]);
    expect(db.emails.sent.some(m => m.subject.startsWith('Lira Core Platform:'))).toBe(true);
    const id = (sync.body as { id: string }).id;
    expect((await db.call('PATCH', path(owner, `/${id}`), { scopeName: 'Renamed' }, owner.session)).body).toMatchObject({ scopeType: 'project', scopeId: 'proj-lira-core', scopeName: 'Renamed' });
    expect((await db.call('PATCH', path(owner, `/${id}`), { scopeType: 'space' }, owner.session)).status).toBe(400);
  });

  it('refuses a call for a space, project or sprint that does not say which, and a whole-organisation call that does', async () => {
    const owner = await db.signUp('su-scope-bad@example.com');
    const g = [{ type: 'user', id: owner.userId }];
    for (const bad of [{ scopeType: 'project' }, { scopeType: 'org', scopeId: 'x' }, { scopeType: 'team', scopeId: 'x' }]) {
      expect((await create(owner, g, bad)).status, JSON.stringify(bad)).toBe(400);
    }
    expect((await db.rows('SELECT 1 FROM standup_calls WHERE org_id = $1', [owner.orgId])).length).toBe(0);
  });
});
