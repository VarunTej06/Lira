import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_URL, startRealDb, type RealDb } from '../testing/realDb';

const ticket = {
  title: 'With files', type: 'task', status: 'todo', priority: 'medium', rank: 1, description: '', reporter: 'A', reporterInitials: 'A',
  labels: [], subtasks: [], comments: [], activity: [], linkedIssues: [], watchers: [],
};
const png = { name: 'plan.png', size: 2048, type: 'image/png' };

describe.skipIf(!ADMIN_URL)('attachments on a real database', () => {
  let db: RealDb;
  beforeAll(async () => { db = await startRealDb(); });
  afterAll(async () => { await db?.stop(); });

  type Person = Awaited<ReturnType<RealDb['signUp']>>;
  const setup = async (email: string) => {
    const p = await db.signUp(email);
    const space = ((await db.call('POST', `/api/orgs/${p.orgId}/spaces`, { key: 'LIRA', name: 'L', icon: 'x', color: '#336699' }, p.session)).body as { id: number }).id;
    const t = ((await db.call('POST', `/api/orgs/${p.orgId}/spaces/${space}/tickets`, ticket, p.session)).body as { id: number }).id;
    return { p, space, t };
  };
  const ask = (p: Person, t: number, body: unknown = png) => db.call('POST', `/api/orgs/${p.orgId}/tickets/${t}/attachments`, body, p.session);
  const confirm = (p: Person, id: string) => db.call('POST', `/api/orgs/${p.orgId}/attachments/${id}/confirm`, undefined, p.session);
  type Asked = { attachment: { id: string }; upload: { url: string; method: string; headers: Record<string, string> } };
  const upload = async (p: Person, t: number, body: { name: string; size: number; type: string } = png) => {
    const asked = (await ask(p, t, body)).body as Asked;
    const path = db.blobs.issued.at(-1)!.path;
    db.blobs.put(path, body.size);
    return { id: asked.attachment.id, path, asked };
  };

  it('hands out an upload address, then lists the file only once it has arrived and been confirmed', async () => {
    const { p, t } = await setup('flow@example.com');
    const r = await ask(p, t);
    const body = r.body as Asked;
    expect(r.status).toBe(201);
    expect(body.upload).toMatchObject({ method: 'PUT', headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'image/png' } });
    expect(body.upload.url).toMatch(/^memory:\/\/upload\//);
    const path = db.blobs.issued.at(-1)!;
    expect(path).toMatchObject({ kind: 'upload', ttlSeconds: 600 });
    expect(path.path).toMatch(new RegExp(`^${p.orgId}/${t}/[0-9a-f-]{36}$`));
    expect(path.path).not.toContain('plan');

    const list = () => db.call('GET', `/api/orgs/${p.orgId}/tickets/${t}/attachments`, undefined, p.session);
    expect((await list()).body).toEqual([]);
    expect((await confirm(p, body.attachment.id)).status).toBe(409);
    db.blobs.put(path.path, 2048);
    const done = await confirm(p, body.attachment.id);
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ name: 'plan.png', size: 2048, type: 'image/png', ticketId: t });
    expect((await list()).body).toHaveLength(1);
  });

  it('removes a file whose size is not the one declared, and its row', async () => {
    const { p, t } = await setup('size@example.com');
    const asked = (await ask(p, t)).body as Asked;
    const path = db.blobs.issued.at(-1)!.path;
    db.blobs.put(path, 999_999);
    const r = await confirm(p, asked.attachment.id);
    expect(r.status).toBe(409);
    expect((r.body as { error: { code: string } }).error.code).toBe('size_mismatch');
    expect(db.blobs.files.has(path)).toBe(false);
    expect((await db.rows('SELECT 1 FROM attachments WHERE id = $1', [asked.attachment.id])).length).toBe(0);
  });

  it('downloads only as a download: a picture keeps its type, anything else is a plain file, and the link is short', async () => {
    const { p, t } = await setup('download@example.com');
    const img = await upload(p, t);
    const pdf = await upload(p, t, { name: 'report.pdf', size: 10, type: 'application/pdf' });
    await confirm(p, img.id); await confirm(p, pdf.id);
    const get = (id: string) => db.call('GET', `/api/orgs/${p.orgId}/attachments/${id}/download`, undefined, p.session);
    expect((await get(img.id)).status).toBe(200);
    expect(db.blobs.issued.at(-1)).toMatchObject({ kind: 'download', ttlSeconds: 300, filename: 'plan.png', contentType: 'image/png' });
    await get(pdf.id);
    expect(db.blobs.issued.at(-1)).toMatchObject({ filename: 'report.pdf', contentType: 'application/octet-stream' });
  });

  it('does not give a download for a file that was never confirmed', async () => {
    const { p, t } = await setup('pending@example.com');
    const asked = (await ask(p, t)).body as Asked;
    expect((await db.call('GET', `/api/orgs/${p.orgId}/attachments/${asked.attachment.id}/download`, undefined, p.session)).status).toBe(404);
  });

  it('keeps organisations apart for every attachment call', async () => {
    const a = await setup('fa@example.com');
    const b = await setup('fb@example.com');
    const mine = await upload(b.p, b.t); await confirm(b.p, mine.id);
    expect((await ask(a.p, b.t)).status).toBe(404);
    expect((await db.call('POST', `/api/orgs/${b.p.orgId}/tickets/${b.t}/attachments`, png, a.p.session)).status).toBe(404);
    expect((await db.call('GET', `/api/orgs/${a.p.orgId}/tickets/${b.t}/attachments`, undefined, a.p.session)).status).toBe(404);
    expect((await db.call('GET', `/api/orgs/${a.p.orgId}/attachments/${mine.id}/download`, undefined, a.p.session)).status).toBe(404);
    expect((await confirm(a.p, mine.id)).status).toBe(404);
    expect((await db.call('DELETE', `/api/orgs/${a.p.orgId}/attachments/${mine.id}`, undefined, a.p.session)).status).toBe(404);
    expect(db.blobs.files.has(mine.path)).toBe(true);
  });

  it('refuses a member without a grant, a missing session, a forged origin, and bad input', async () => {
    const { p, t } = await setup('guard@example.com');
    const member = await db.signUp('guard-member@example.com');
    await db.admin.query("INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'member')", [p.orgId, member.userId]);
    expect((await db.call('POST', `/api/orgs/${p.orgId}/tickets/${t}/attachments`, png, member.session)).status).toBe(404);
    expect((await db.call('POST', `/api/orgs/${p.orgId}/tickets/${t}/attachments`, png)).status).toBe(401);
    expect((await db.call('POST', `/api/orgs/${p.orgId}/tickets/${t}/attachments`, png, { ...p.session, Origin: 'https://evil.example' })).status).toBe(403);
    for (const bad of [{ ...png, type: 'text/html' }, { ...png, size: 26 * 1024 * 1024 }, { ...png, name: '../x' }, { ...png, path: 'x' }]) expect((await ask(p, t, bad)).status, JSON.stringify(bad)).toBe(400);
    expect((await db.call('GET', `/api/orgs/${p.orgId}/attachments/not-a-uuid/download`, undefined, p.session)).status).toBe(400);
    expect((await db.rows('SELECT 1 FROM attachments WHERE org_id = $1', [p.orgId])).length).toBe(0);
  });

  it('limits a ticket to 50 files', async () => {
    const { p, t } = await setup('many@example.com');
    // Fifty files already pending, put in directly: fifty requests one after another would only test how slow the network is
    await db.admin.query(
      `INSERT INTO attachments (org_id, ticket_id, name, size, content_type, blob_path) SELECT $1, $2, 'f' || n || '.png', 10, 'image/png', gen_random_uuid()::text FROM generate_series(1, 50) n`, [p.orgId, t]);
    const over = await ask(p, t);
    expect(over.status).toBe(409);
    expect((over.body as { error: { code: string } }).error.code).toBe('too_many_files');
  });

  it('deletes the file from storage with its row, with an audit row that holds no file name', async () => {
    const { p, t } = await setup('delete@example.com');
    const f = await upload(p, t, { name: 'secret-merger.pdf', size: 10, type: 'application/pdf' });
    await confirm(p, f.id);
    expect((await db.call('DELETE', `/api/orgs/${p.orgId}/attachments/${f.id}`, undefined, p.session)).status).toBe(204);
    expect(db.blobs.files.has(f.path)).toBe(false);
    const audit = await db.rows<{ action: string }>("SELECT action, detail FROM audit_log WHERE action LIKE 'attachment.%' AND org_id = $1 ORDER BY id", [p.orgId]);
    expect(audit.map(a => a.action)).toEqual(['attachment.add', 'attachment.delete']);
    expect(JSON.stringify(audit)).not.toMatch(/secret|merger/i);
  });

  it('removes the stored files when their ticket or their space is deleted', async () => {
    const { p, space, t } = await setup('purge@example.com');
    const one = await upload(p, t); await confirm(p, one.id);
    expect((await db.call('DELETE', `/api/orgs/${p.orgId}/tickets/${t}`, { version: 1 }, p.session)).status).toBe(204);
    expect(db.blobs.files.has(one.path)).toBe(false);

    const t2 = ((await db.call('POST', `/api/orgs/${p.orgId}/spaces/${space}/tickets`, ticket, p.session)).body as { id: number }).id;
    const two = await upload(p, t2); await confirm(p, two.id);
    expect((await db.call('DELETE', `/api/orgs/${p.orgId}/spaces/${space}`, { version: 1 }, p.session)).status).toBe(204);
    expect(db.blobs.files.has(two.path)).toBe(false);
    expect((await db.rows('SELECT 1 FROM attachments WHERE org_id = $1', [p.orgId])).length).toBe(0);
  });
});
