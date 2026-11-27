import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeGoogle } from '../testing/fake-google';
import { ADMIN_URL, startRealDb, type RealDb } from '../testing/realDb';
import { codeFor, stepAt } from './totp';

const PASSWORD = 'a-long-enough-password';

describe.skipIf(!ADMIN_URL)('two-step sign-in, on a real database', () => {
  let db: RealDb;
  let plain: RealDb;
  beforeAll(async () => { db = await startRealDb({ google: new FakeGoogle() }); plain = await startRealDb(); });
  afterAll(async () => { await db?.stop(); await plain?.stop(); });

  type Person = Awaited<ReturnType<RealDb['signUp']>> & { email: string };
  let n = 0;
  const person = async (): Promise<Person> => { const email = `two${++n}@example.com`; return { ...(await db.signUp(email)), email }; };
  /** Turns it on the way the page does, and gives the secret and the recovery codes. */
  async function turnOn(p: Person) {
    const begun = await db.call('POST', '/api/me/two-step/begin', undefined, p.session);
    expect(begun.status).toBe(200);
    const { secret, uri } = begun.body as { secret: string; uri: string };
    expect(uri).toContain(`secret=${secret}`);
    const confirmed = await db.call('POST', '/api/me/two-step/confirm', { code: codeFor(secret, stepAt(Date.now())) }, p.session);
    expect(confirmed.status).toBe(200);
    return { secret, recovery: (confirmed.body as { recoveryCodes: string[] }).recoveryCodes };
  }
  const logIn = (p: Person) => db.call('POST', '/api/auth/login', { email: p.email, password: PASSWORD });
  const answer = (challenge: string, code: string) => db.call('POST', '/api/auth/login/two-step', { challenge, code });
  /** The code for a later step, so one test can give more than one valid code (each works once). */
  const codeAt = (secret: string, ahead: number) => codeFor(secret, stepAt(Date.now()) + ahead);

  it('is off for everyone to begin with, and is not offered on a server without the key', async () => {
    const p = await person();
    expect((await db.call('GET', '/api/me/two-step', undefined, p.session)).body).toEqual({ available: true, enabled: false });
    expect((await logIn(p)).cookie).toBeDefined(); // an ordinary log-in, no second step
    const q = await plain.signUp('plain-two@example.com');
    expect((await plain.call('GET', '/api/me/two-step', undefined, q.session)).body).toEqual({ available: false, enabled: false });
    expect((await plain.call('POST', '/api/me/two-step/begin', undefined, q.session)).status).toBe(503);
  });

  it('turns on only after a first code is typed, gives ten recovery codes once, and keeps only an encrypted secret and hashes', async () => {
    const p = await person();
    const begun = (await db.call('POST', '/api/me/two-step/begin', undefined, p.session)).body as { secret: string };
    expect((await db.call('GET', '/api/me/two-step', undefined, p.session)).body).toMatchObject({ enabled: false }); // not on yet
    expect((await logIn(p)).cookie).toBeDefined(); // a half-finished set-up never locks anyone out
    const wrong = await db.call('POST', '/api/me/two-step/confirm', { code: codeFor(begun.secret, stepAt(Date.now()) + 5) }, p.session);
    expect(wrong.status).toBe(400);
    const ok = await db.call('POST', '/api/me/two-step/confirm', { code: codeFor(begun.secret, stepAt(Date.now())) }, p.session);
    expect((ok.body as { recoveryCodes: string[] }).recoveryCodes).toHaveLength(10);
    expect((await db.call('GET', '/api/me/two-step', undefined, p.session)).body).toMatchObject({ enabled: true });
    const stored = await db.rows<{ secret: string }>('SELECT secret FROM user_two_step WHERE user_id = $1', [p.userId]);
    expect(stored[0].secret).toMatch(/^v1\./);
    expect(stored[0].secret).not.toContain(begun.secret);
    const hashes = await db.rows<{ code_hash: string }>('SELECT code_hash FROM two_step_recovery WHERE user_id = $1', [p.userId]);
    expect(hashes).toHaveLength(10);
    for (const code of (ok.body as { recoveryCodes: string[] }).recoveryCodes) expect(JSON.stringify(hashes)).not.toContain(code);
    expect((await db.call('POST', '/api/me/two-step/begin', undefined, p.session)).status).toBe(409); // already on
  });

  it('asks for a code after the right password, gives no session until it is right, and then signs in', async () => {
    const p = await person();
    const { secret } = await turnOn(p);
    const first = await logIn(p);
    expect(first.status).toBe(200);
    expect(first.cookie).toBeUndefined();
    expect(first.body).toMatchObject({ twoStep: true });
    expect(JSON.stringify(first.body)).not.toMatch(/user|organisations|token_hash/);
    const { challenge } = first.body as { challenge: string };
    expect((await answer(challenge, '000000')).status).toBe(401);
    const good = await answer(challenge, codeAt(secret, 1)); // the step after the one used to set up
    expect(good.status).toBe(200);
    expect(good.cookie).toMatch(/^lira_session=/);
    expect(good.body).toMatchObject({ user: { email: p.email } });
    expect((await db.call('GET', '/api/me', undefined, { Cookie: good.cookie!.split(';')[0] })).status).toBe(200);
    expect((await answer(challenge, codeAt(secret, 1))).status).toBe(401); // the challenge is used up
  });

  it('works once per code, refuses a wrong password at the first step, and ends a challenge after five wrong codes', async () => {
    const p = await person();
    const { secret } = await turnOn(p);
    expect((await db.call('POST', '/api/auth/login', { email: p.email, password: 'not-the-password-at-all' })).status).toBe(401);
    const a = (await logIn(p)).body as { challenge: string };
    const code = codeAt(secret, 1);
    expect((await answer(a.challenge, code)).status).toBe(200);
    const b = (await logIn(p)).body as { challenge: string };
    expect((await answer(b.challenge, code)).status).toBe(401); // the same code, seen once already

    const c = (await logIn(p)).body as { challenge: string };
    for (let i = 0; i < 5; i++) expect((await answer(c.challenge, '111111')).status).toBe(401);
    expect((await answer(c.challenge, codeAt(secret, 0 === 0 ? 2 : 0))).status).toBe(429); // even the right code is too late now
  });

  it('accepts a recovery code once, in any case and with or without the dash, and not another person\'s', async () => {
    const p = await person();
    const { recovery } = await turnOn(p);
    const other = await person();
    await turnOn(other);
    const first = (await logIn(p)).body as { challenge: string };
    expect((await answer(first.challenge, recovery[0].toUpperCase().replace('-', ''))).status).toBe(200);
    const again = (await logIn(p)).body as { challenge: string };
    expect((await answer(again.challenge, recovery[0])).status).toBe(401); // used
    expect((await answer(again.challenge, recovery[1])).status).toBe(200);
    const stolen = (await logIn(other)).body as { challenge: string };
    expect((await answer(stolen.challenge, recovery[2])).status).toBe(401); // belongs to the first person
  });

  it('refuses a challenge that is unknown, expired, or not shaped like one', async () => {
    const p = await person();
    await turnOn(p);
    const { challenge } = (await logIn(p)).body as { challenge: string };
    await db.admin.query("UPDATE login_challenges SET expires_at = now() - interval '1 minute'");
    expect((await answer(challenge, '123456')).status).toBe(401);
    expect((await answer('A'.repeat(43), '123456')).status).toBe(401);
    for (const bad of [{ challenge: 'short', code: '123456' }, { challenge, code: '1' }, { challenge, code: '123456', extra: 1 }]) {
      expect((await db.call('POST', '/api/auth/login/two-step', bad)).status).toBe(400);
    }
  });

  it('turns off only with a current code, and then logs in as before; and every change is in the audit log', async () => {
    const p = await person();
    const { secret } = await turnOn(p);
    expect((await db.call('POST', '/api/me/two-step/disable', { code: '000000' }, p.session)).status).toBe(403);
    expect((await db.call('POST', '/api/me/two-step/disable', { code: codeAt(secret, 1) }, p.session)).status).toBe(204);
    expect((await db.call('GET', '/api/me/two-step', undefined, p.session)).body).toMatchObject({ enabled: false });
    expect((await logIn(p)).cookie).toBeDefined();
    const actions = await db.rows<{ action: string; outcome: string }>("SELECT action, outcome FROM audit_log WHERE actor = $1 AND action LIKE 'auth.two_step%' ORDER BY id", [p.userId]);
    expect(actions.map(a => `${a.action}:${a.outcome}`)).toEqual(['auth.two_step.enable:ok', 'auth.two_step.disable:denied', 'auth.two_step.disable:ok']);
    expect((await db.call('POST', '/api/me/two-step/begin', undefined)).status).toBe(401);
  });
});
