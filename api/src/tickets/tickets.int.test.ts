import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_URL, startRealDb, type RealDb } from '../testing/realDb';

const ticket = {
  title: 'Fix the board', type: 'task', status: 'todo', priority: 'medium', rank: 1000, description: '<p>text</p>',
  reporter: 'Asha Rao', reporterInitials: 'AR', labels: ['ui'], subtasks: [], comments: [], activity: [], linkedIssues: [], watchers: [],
};

describe.skipIf(!ADMIN_URL)('tickets on a real database', () => {
  let db: RealDb;
  beforeAll(async () => { db = await startRealDb(); });
  afterAll(async () => { await db?.stop(); });

  type Person = Awaited<ReturnType<RealDb['signUp']>>;
  const makeSpace = async (p: Person, key = 'LIRA') =>
    ((await db.call('POST', `/api/orgs/${p.orgId}/spaces`, { key, name: key, icon: 'rocket', color: '#336699' }, p.session)).body as { id: number }).id;
  const listPath = (p: Person, spaceId: number) => `/api/orgs/${p.orgId}/spaces/${spaceId}/tickets`;
  const onePath = (p: Person, id: number) => `/api/orgs/${p.orgId}/tickets/${id}`;
  const create = (p: Person, spaceId: number, extra: object = {}) => db.call('POST', listPath(p, spaceId), { ...ticket, ...extra }, p.session);
  const idOf = (r: { body: unknown }) => (r.body as { id: number }).id;

  it('creates tickets with keys the server numbers, per space, and keeps every field the app sent', async () => {
    const p = await db.signUp('keys@example.com');
    const a = await makeSpace(p, 'AAA'); const b = await makeSpace(p, 'BBB');
    const first = await create(p, a); const second = await create(p, a, { title: 'Second' }); const other = await create(p, b);
    expect([first.status, (first.body as { key: string }).key, (second.body as { key: string }).key, (other.body as { key: string }).key]).toEqual([201, 'AAA-1', 'AAA-2', 'BBB-1']);
    expect(first.body).toMatchObject({ spaceId: a, title: 'Fix the board', labels: ['ui'], description: '<p>text</p>', version: 1, reporter: 'Asha Rao' });
    expect(typeof (first.body as { id: unknown }).id).toBe('number');
    const listed = await db.call('GET', listPath(p, a), undefined, p.session);
    expect((listed.body as { key: string }[]).map(t => t.key)).toEqual(['AAA-1', 'AAA-2']);
    expect((await db.call('GET', onePath(p, idOf(first)), undefined, p.session)).body).toMatchObject({ key: 'AAA-1', labels: ['ui'] });
  });

  it('changes some fields and leaves the rest, clears a field with null, and counts the version', async () => {
    const p = await db.signUp('edit@example.com');
    const space = await makeSpace(p);
    const id = idOf(await create(p, space, { assignee: 'Asha Rao', dueDate: '2026-12-01T00:00:00.000Z' }));
    const changed = await db.call('PATCH', onePath(p, id), { version: 1, status: 'done', labels: ['ui', 'api'], assignee: null, dueDate: null }, p.session);
    expect(changed.status).toBe(200);
    const body = changed.body as Record<string, unknown>;
    expect(body).toMatchObject({ status: 'done', labels: ['ui', 'api'], version: 2, title: 'Fix the board', description: '<p>text</p>' });
    expect(body.assignee).toBeUndefined();
    expect(body.dueDate).toBeUndefined();
  });

  it('refuses a stale version with 409 and a delete on a stale version with 409', async () => {
    const p = await db.signUp('stale@example.com');
    const id = idOf(await create(p, await makeSpace(p)));
    await db.call('PATCH', onePath(p, id), { version: 1, title: 'First' }, p.session);
    expect((await db.call('PATCH', onePath(p, id), { version: 1, title: 'Second' }, p.session)).status).toBe(409);
    expect((await db.call('DELETE', onePath(p, id), { version: 1 }, p.session)).status).toBe(409);
    expect((await db.call('DELETE', onePath(p, id), { version: 2 }, p.session)).status).toBe(204);
    expect((await db.call('GET', onePath(p, id), undefined, p.session)).status).toBe(404);
  });

  it('writes an audit row for each change that names the ticket and the fields, never its text', async () => {
    const p = await db.signUp('audit@example.com');
    const id = idOf(await create(p, await makeSpace(p), { title: 'Secret plans' }));
    await db.call('PATCH', onePath(p, id), { version: 1, description: '<p>more secrets</p>' }, p.session);
    await db.call('DELETE', onePath(p, id), { version: 2 }, p.session);
    const rows = await db.rows<{ action: string; detail: Record<string, unknown> }>("SELECT action, detail FROM audit_log WHERE action LIKE 'ticket.%' AND org_id = $1 ORDER BY id", [p.orgId]);
    expect(rows.map(r => r.action)).toEqual(['ticket.create', 'ticket.update', 'ticket.delete']);
    expect(rows[1].detail).toMatchObject({ ticketId: id, fields: 'description' });
    expect(JSON.stringify(rows)).not.toMatch(/secret/i);
  });

  it('keeps organisations apart for every ticket call', async () => {
    const a = await db.signUp('ta@example.com');
    const b = await db.signUp('tb@example.com');
    const spaceB = await makeSpace(b, 'SECRET');
    const idB = idOf(await create(b, spaceB));

    expect((await db.call('GET', listPath(b, spaceB), undefined, a.session)).status).toBe(404);
    expect((await db.call('POST', listPath(b, spaceB), ticket, a.session)).status).toBe(404);
    // A uses its own organisation in the address but B's numbers: they are simply not there.
    expect((await db.call('GET', listPath(a, spaceB), undefined, a.session)).status).toBe(404);
    expect((await db.call('POST', listPath(a, spaceB), ticket, a.session)).status).toBe(404);
    expect((await db.call('GET', onePath(a, idB), undefined, a.session)).status).toBe(404);
    expect((await db.call('PATCH', onePath(a, idB), { version: 1, title: 'Mine' }, a.session)).status).toBe(404);
    expect((await db.call('DELETE', onePath(a, idB), { version: 1 }, a.session)).status).toBe(404);
    expect((await db.rows<{ title: string }>('SELECT title FROM tickets WHERE id = $1', [idB]))[0].title).toBe('Fix the board');
    expect((await db.rows('SELECT 1 FROM tickets WHERE org_id = $1', [a.orgId])).length).toBe(0);
  });

  it('refuses a parent or epic from another space or organisation, and a ticket as its own parent', async () => {
    const p = await db.signUp('parent@example.com');
    const other = await db.signUp('parent-other@example.com');
    const s1 = await makeSpace(p, 'ONE'); const s2 = await makeSpace(p, 'TWO'); const so = await makeSpace(other, 'OTH');
    const epic = idOf(await create(p, s1, { type: 'epic' }));
    const foreign = idOf(await create(other, so));
    expect((await create(p, s1, { type: 'subtask', parentId: epic })).status).toBe(201);
    expect((await create(p, s2, { parentId: epic })).status).toBe(400);
    expect((await create(p, s1, { parentId: foreign })).status).toBe(400);
    expect((await create(p, s1, { parentId: 999999 })).status).toBe(400);
    expect((await db.call('PATCH', onePath(p, epic), { version: 1, parentId: epic }, p.session)).status).toBe(400);
    expect((await db.call('PATCH', onePath(p, epic), { version: 1, parentId: foreign }, p.session)).status).toBe(400);
  });

  it('shows nothing to a member without a grant (not found), and nothing without a session or from a forged origin', async () => {
    const owner = await db.signUp('tboss@example.com');
    const member = await db.signUp('tmember@example.com');
    await db.admin.query("INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'member')", [owner.orgId, member.userId]);
    const space = await makeSpace(owner);
    expect((await db.call('GET', listPath(owner, space), undefined, member.session)).status).toBe(404);
    expect((await db.call('POST', listPath(owner, space), ticket, member.session)).status).toBe(404);
    expect((await db.call('GET', listPath(owner, space))).status).toBe(401);
    expect((await db.call('POST', listPath(owner, space), ticket, { ...owner.session, Origin: 'https://evil.example' })).status).toBe(403);
  });

  it('refuses unknown fields, a smuggled id or organisation, and ticket numbers it did not give', async () => {
    const p = await db.signUp('smuggle@example.com');
    const space = await makeSpace(p);
    for (const extra of [{ org_id: p.orgId }, { id: 5 }, { key: 'LIRA-99' }, { version: 7 }, { spaceId: 1 }, { attachments: [] }]) {
      expect((await create(p, space, extra)).status, JSON.stringify(extra)).toBe(400);
    }
    expect((await create(p, space, { title: '' })).status).toBe(400);
    expect((await db.rows('SELECT 1 FROM tickets WHERE org_id = $1', [p.orgId])).length).toBe(0);
  });

  it('takes a larger body on ticket routes only: a 100 KB description is stored, a 100 KB space description is refused', async () => {
    const p = await db.signUp('size@example.com');
    const space = await makeSpace(p);
    const big = await create(p, space, { description: 'x'.repeat(100_000) });
    expect(big.status).toBe(201);
    expect(((await db.call('GET', onePath(p, idOf(big)), undefined, p.session)).body as { description: string }).description.length).toBe(100_000);
    expect((await create(p, space, { description: 'x'.repeat(200_001) })).status).toBe(400);
    expect((await db.call('POST', `/api/orgs/${p.orgId}/spaces`, { key: 'BIG', name: 'x', icon: 'a', color: '#336699', description: 'x'.repeat(100_000) }, p.session)).status).toBe(413);
    expect((await create(p, space, { description: 'x'.repeat(600_000) })).status).toBe(413);
  });

  it('removes a space with its tickets, and a deleted parent leaves its children without a parent', async () => {
    const p = await db.signUp('cascade@example.com');
    const space = await makeSpace(p);
    const parent = idOf(await create(p, space, { type: 'epic' }));
    const child = idOf(await create(p, space, { type: 'task', parentId: parent }));
    expect((await db.call('DELETE', onePath(p, parent), { version: 1 }, p.session)).status).toBe(204);
    expect((await db.call('GET', onePath(p, child), undefined, p.session)).body).not.toHaveProperty('parentId', parent);
    expect((await db.call('DELETE', `/api/orgs/${p.orgId}/spaces/${space}`, { version: 1 }, p.session)).status).toBe(204);
    expect((await db.rows('SELECT 1 FROM tickets WHERE org_id = $1', [p.orgId])).length).toBe(0);
  });
});
