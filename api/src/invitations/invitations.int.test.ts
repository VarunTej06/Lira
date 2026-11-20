import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashToken } from '../auth/session';
import { ADMIN_URL, startRealDb, type RealDb } from '../testing/realDb';

describe.skipIf(!ADMIN_URL)('invitations on a real database', () => {
  let db: RealDb;
  beforeAll(async () => { db = await startRealDb(); });
  afterAll(async () => { await db?.stop(); });

  type Person = Awaited<ReturnType<RealDb['signUp']>>;
  const invite = (owner: Person, body: object) => db.call('POST', `/api/orgs/${owner.orgId}/invitations`, body, owner.session);
  const accept = (p: Person, token: string) => db.call('POST', '/api/invitations/accept', { token }, p.session);
  const token = (r: { body: unknown }) => (r.body as { token: string }).token;

  it('invites by email, stores only a hash of the link, and says the email went out', async () => {
    const owner = await db.signUp('inv-owner@example.com');
    const before = db.emails.sent.length;
    const r = await invite(owner, { email: ' New.Person@Example.com ', role: 'member' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ email: 'new.person@example.com', role: 'member', emailed: true });
    expect(token(r)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const mail = db.emails.sent[before];
    expect(mail.to).toBe('new.person@example.com');
    expect(mail.text).toContain(`/invite?token=${token(r)}`);
    const rows = await db.rows<{ token_hash: string }>('SELECT token_hash FROM invitations WHERE org_id = $1', [owner.orgId]);
    expect(rows[0].token_hash).toBe(hashToken(token(r)));
    expect(JSON.stringify(rows)).not.toContain(token(r));
    expect(((await db.call('GET', `/api/orgs/${owner.orgId}/invitations`, undefined, owner.session)).body as unknown[]).length).toBe(1);
  });

  it('joins the invited person with the role and team, once, for the invited address only', async () => {
    const owner = await db.signUp('inv-owner2@example.com');
    const team = ((await db.call('POST', `/api/orgs/${owner.orgId}/teams`, { name: 'QA' }, owner.session)).body as { id: string }).id;
    const t = token(await invite(owner, { email: 'inv-guest@example.com', role: 'viewer', teamId: team }));
    const wrong = await db.signUp('inv-someone-else@example.com');
    const forbidden = await accept(wrong, t);
    expect(forbidden.status).toBe(403);
    expect((forbidden.body as { error: { code: string } }).error.code).toBe('wrong_email');
    expect((await db.rows('SELECT 1 FROM memberships WHERE org_id = $1 AND user_id = $2', [owner.orgId, wrong.userId])).length).toBe(0);

    const invited = await db.signUp('inv-guest@example.com');
    const ok = await accept(invited, t);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ orgId: owner.orgId });
    const m = await db.rows<{ role: string }>('SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2', [owner.orgId, invited.userId]);
    expect(m).toEqual([{ role: 'viewer' }]);
    expect((await db.rows('SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2', [team, invited.userId])).length).toBe(1);
    const again = await accept(invited, t);
    expect(again.status).toBe(404); // used once
    expect(((await db.call('GET', `/api/orgs/${owner.orgId}/invitations`, undefined, owner.session)).body as unknown[]).length).toBe(0);
    const me = (await db.call('GET', '/api/me', undefined, invited.session)).body as { organisations: { orgId: string }[] };
    expect(me.organisations.map(o => o.orgId)).toContain(owner.orgId);
  });

  it('refuses an expired, revoked, unknown or badly shaped link', async () => {
    const owner = await db.signUp('inv-owner3@example.com');
    const p = await db.signUp('inv-late@example.com');
    const expired = token(await invite(owner, { email: 'inv-late@example.com', role: 'member' }));
    await db.admin.query("UPDATE invitations SET expires_at = now() - interval '1 minute' WHERE org_id = $1", [owner.orgId]);
    expect((await accept(p, expired)).status).toBe(404);
    const created = await invite(owner, { email: 'inv-late@example.com', role: 'member' });
    expect((await db.call('DELETE', `/api/orgs/${owner.orgId}/invitations/${(created.body as { id: string }).id}`, undefined, owner.session)).status).toBe(204);
    expect((await accept(p, token(created))).status).toBe(404);
    expect((await accept(p, 'a'.repeat(43))).status).toBe(404);
    expect((await accept(p, 'short')).status).toBe(400);
    expect((await db.call('POST', '/api/invitations/accept', { token: 'a'.repeat(43) })).status).toBe(401);
  });

  it('lets only people who manage access invite, refuses someone already in, bad input and a team of another organisation', async () => {
    const owner = await db.signUp('inv-owner4@example.com');
    const other = await db.signUp('inv-other@example.com');
    const member = await db.addMember(owner, 'inv-member@example.com', 'member');
    expect((await invite(member, { email: 'x@example.com', role: 'member' })).status).toBe(403);
    expect((await invite(owner, { email: 'inv-member@example.com', role: 'member' })).status).toBe(409);
    expect((await invite(owner, { email: 'bad', role: 'member' })).status).toBe(400);
    expect((await invite(owner, { email: 'x@example.com', role: 'owner' })).status).toBe(400);
    expect((await invite(owner, { email: 'x@example.com', role: 'member', orgId: other.orgId })).status).toBe(400);
    const foreignTeam = ((await db.call('POST', `/api/orgs/${other.orgId}/teams`, { name: 'Theirs' }, other.session)).body as { id: string }).id;
    expect((await invite(owner, { email: 'x@example.com', role: 'member', teamId: foreignTeam })).status).toBe(404);
    expect((await db.call('POST', `/api/orgs/${owner.orgId}/invitations`, { email: 'x@example.com', role: 'member' }, { ...owner.session, Origin: 'https://evil.example' })).status).toBe(403);
    expect((await db.call('GET', `/api/orgs/${owner.orgId}/invitations`, undefined, other.session)).status).toBe(404);
  });

  it('replaces an earlier open invitation to the same address, so only the newest link works', async () => {
    const owner = await db.signUp('inv-owner5@example.com');
    const p = await db.signUp('inv-twice@example.com');
    const first = token(await invite(owner, { email: 'inv-twice@example.com', role: 'viewer' }));
    const second = token(await invite(owner, { email: 'inv-twice@example.com', role: 'member' }));
    expect((await accept(p, first)).status).toBe(404);
    expect((await accept(p, second)).status).toBe(200);
  });

  it('audits an invitation and its acceptance without the address or the link', async () => {
    const owner = await db.signUp('inv-owner6@example.com');
    const p = await db.signUp('inv-audit@example.com');
    await accept(p, token(await invite(owner, { email: 'inv-audit@example.com', role: 'member' })));
    const rows = await db.rows<{ action: string }>("SELECT action, detail FROM audit_log WHERE org_id = $1 AND action LIKE 'invitation.%' ORDER BY id", [owner.orgId]);
    expect(rows.map(r => r.action)).toEqual(['invitation.create', 'invitation.accept']);
    expect(JSON.stringify(rows)).not.toMatch(/inv-audit@|token/);
  });
});
