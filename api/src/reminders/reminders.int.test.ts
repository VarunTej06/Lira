import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FakeMailer } from '../testing/fake-mailer';
import { ADMIN_URL, startRealDb, type RealDb } from '../testing/realDb';
import { RemindersService } from './reminders.service';

const LINK = 'https://meet.google.com/abc-defg-hij';
const ticket = {
  title: 'Ship the thing', type: 'task', status: 'todo', priority: 'medium', rank: 1000, description: '<p>x</p>', dueDate: '2026-12-01T00:00:00.000Z',
  reporter: 'Test Person', reporterInitials: 'TP', labels: [], subtasks: [], comments: [], activity: [], linkedIssues: [], watchers: [],
};

describe.skipIf(!ADMIN_URL)('reminders by email on a real database', () => {
  let db: RealDb;
  const mail = new FakeMailer();
  let reminders: RemindersService;
  beforeAll(async () => { db = await startRealDb({ systemMailer: mail }); reminders = db.app.get(RemindersService); });
  afterAll(async () => { await db?.stop(); });
  beforeEach(async () => { mail.sent.length = 0; mail.accept = true; mail.enabled = true; await db.admin.query('DELETE FROM standup_calls'); }); // each test sees only its own calls

  type Person = Awaited<ReturnType<RealDb['signUp']>>;
  let n = 0;
  const call = (owner: Person, startsAt: string, invitees: object[], extra: object = {}) =>
    db.call('POST', `/api/orgs/${owner.orgId}/standups`, { title: 'Daily sync', startsAt, durationMinutes: 15, timeZone: 'UTC', link: LINK, invitees, ...extra }, owner.session);
  const setup = async () => {
    const owner = await db.signUp(`owner${++n}@example.com`);
    const member = await db.addMember(owner, `member${n}@example.com`, 'member');
    return { owner, member };
  };
  const at = (iso: string) => new Date(iso);
  /** Only the reminders: signing people up also sends them a confirmation email. */
  const reminded = () => mail.sent.filter(m => /^(Reminder|Due)/.test(m.subject));
  const to = (email: string) => reminded().filter(m => m.to === email);

  it('emails each invited person once, shortly before a call, with the time and the link', async () => {
    const { owner, member } = await setup();
    await call(owner, '2026-12-01T10:00:00Z', [{ type: 'user', id: member.userId }]);
    expect(await reminders.runOnce(at('2026-12-01T09:30:00Z'))).toBe(0); // too early
    expect(await reminders.runOnce(at('2026-12-01T09:46:00Z'))).toBe(1);
    expect(to(`member${n}@example.com`)).toHaveLength(1);
    expect(reminded()[0].subject).toBe('Reminder: Daily sync starts in 15 minutes');
    expect(reminded()[0].text).toContain(LINK);
    expect(await reminders.runOnce(at('2026-12-01T09:50:00Z'))).toBe(0); // the same call is not sent again
    expect(await reminders.runOnce(at('2026-12-01T10:05:00Z'))).toBe(0); // and none after it started
    expect(to(`owner${n}@example.com`)).toHaveLength(0); // the owner is not invited
  });

  it('reaches the people of an invited team, and a repeating call once for each day', async () => {
    const { owner, member } = await setup();
    const team = (await db.call('POST', `/api/orgs/${owner.orgId}/teams`, { name: 'QA' }, owner.session)).body as { id: string };
    await db.call('PUT', `/api/orgs/${owner.orgId}/teams/${team.id}/members`, { userIds: [member.userId] }, owner.session);
    await call(owner, '2026-12-01T10:00:00Z', [{ type: 'team', id: team.id }], { repeat: 'daily', repeatUntil: '2026-12-05' });
    expect(await reminders.runOnce(at('2026-12-02T09:50:00Z'))).toBe(1);
    expect(await reminders.runOnce(at('2026-12-02T09:55:00Z'))).toBe(0);
    expect(await reminders.runOnce(at('2026-12-03T09:50:00Z'))).toBe(1);
    expect(await reminders.runOnce(at('2026-12-06T09:50:00Z'))).toBe(0); // after the last day
    expect(to(`member${n}@example.com`)).toHaveLength(2);
  });

  it('keeps to each person\'s own switch, and gives the claim back when sending fails so the next minute tries again', async () => {
    const { owner, member } = await setup();
    await call(owner, '2026-12-01T10:00:00Z', [{ type: 'user', id: member.userId }]);
    mail.accept = false;
    expect(await reminders.runOnce(at('2026-12-01T09:46:00Z'))).toBe(0);
    mail.accept = true;
    expect(await reminders.runOnce(at('2026-12-01T09:47:00Z'))).toBe(1);

    const other = await setup();
    await call(other.owner, '2026-12-01T10:00:00Z', [{ type: 'user', id: other.member.userId }]);
    expect((await db.call('PUT', '/api/me/reminders', { calls: false }, other.member.session)).body).toMatchObject({ calls: false, due: true });
    mail.sent.length = 0;
    expect(await reminders.runOnce(at('2026-12-01T09:48:00Z'))).toBe(0);
  });

  it('reminds the assignee the day before a ticket is due, once, and only a person the name clearly stands for who may see the space', async () => {
    const { owner, member } = await setup();
    const space = ((await db.call('POST', `/api/orgs/${owner.orgId}/spaces`, { key: 'REM', name: 'Rem', icon: 'x', color: '#336699' }, owner.session)).body as { id: number }).id;
    await db.call('POST', `/api/orgs/${owner.orgId}/grants`, { subjectType: 'user', subjectId: member.userId, kind: 'space', objectId: String(space), level: 'edit' }, owner.session);
    await db.admin.query("UPDATE users SET name = 'Maya Member' WHERE id = $1", [member.userId]);
    await db.call('POST', `/api/orgs/${owner.orgId}/spaces/${space}/tickets`, { ...ticket, assignee: 'Maya Member' }, owner.session);
    await db.call('POST', `/api/orgs/${owner.orgId}/spaces/${space}/tickets`, { ...ticket, title: 'Done one', status: 'done', assignee: 'Maya Member' }, owner.session);
    await db.call('POST', `/api/orgs/${owner.orgId}/spaces/${space}/tickets`, { ...ticket, title: 'Nobody', assignee: 'Someone Else' }, owner.session);
    expect(await reminders.runOnce(at('2026-11-30T05:00:00Z'))).toBe(0); // before the hour of the day
    expect(await reminders.runOnce(at('2026-11-30T08:00:00Z'))).toBe(1);
    expect(await reminders.runOnce(at('2026-11-30T09:00:00Z'))).toBe(0);
    expect(reminded().at(-1)).toMatchObject({ to: `member${n}@example.com`, subject: `Due tomorrow: REM-1` });
    expect(reminded().at(-1)!.text).not.toContain('Done one');

    await db.admin.query("UPDATE users SET name = 'Maya Member' WHERE id = $1", [owner.userId]); // two people with that name: not clear who it means
    mail.sent.length = 0;
    await db.call('POST', `/api/orgs/${owner.orgId}/spaces/${space}/tickets`, { ...ticket, title: 'Second', assignee: 'Maya Member' }, owner.session);
    expect(await reminders.runOnce(at('2026-11-30T08:30:00Z'))).toBe(0);
  });

  it('sends nothing when the email service is not set up, and lets a person read and change only their own switches', async () => {
    const { owner, member } = await setup();
    await call(owner, '2026-12-01T10:00:00Z', [{ type: 'user', id: member.userId }]);
    mail.enabled = false;
    expect(await reminders.runOnce(at('2026-12-01T09:46:00Z'))).toBe(0);
    expect((await db.call('GET', '/api/me/reminders', undefined, member.session)).body).toEqual({ calls: true, due: true, available: false });
    mail.enabled = true;
    expect((await db.call('PUT', '/api/me/reminders', { due: false }, member.session)).body).toEqual({ calls: true, due: false, available: true });
    expect((await db.call('GET', '/api/me/reminders', undefined, owner.session)).body).toMatchObject({ due: true }); // not the other person's
    for (const bad of [{}, { calls: 'no' }, { calls: true, extra: 1 }]) expect((await db.call('PUT', '/api/me/reminders', bad, member.session)).status).toBe(400);
    expect((await db.call('GET', '/api/me/reminders')).status).toBe(401);
  });
});
