import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeMailer } from '../testing/fake-mailer';
import { ADMIN_URL, startRealDb, type RealDb } from '../testing/realDb';
import { BREACHED, type BreachHttp } from './breach.service';

const LEAKED = 'password-that-leaked';
const ending = createHash('sha1').update(LEAKED).digest('hex').toUpperCase();
let asked: string[] = [];
let listDown = false;
const list: BreachHttp = async url => {
  asked.push(url);
  if (listDown) throw new TypeError('offline');
  return new Response(url.endsWith(ending.slice(0, 5)) ? `${ending.slice(5)}:9` : 'ABCDEF:1', { status: 200 });
};

describe.skipIf(!ADMIN_URL)('leaked passwords are refused, on a real database', () => {
  let db: RealDb;
  const mail = new FakeMailer();
  beforeAll(async () => { db = await startRealDb({ breachHttp: list, systemMailer: mail, env: { BREACH_CHECK: 'true' } }); });
  afterAll(async () => { await db?.stop(); });

  it('refuses a sign-up with a leaked password, naming the password field, and creates nothing', async () => {
    asked = [];
    const r = await db.call('POST', '/api/auth/signup', { name: 'Asha', email: 'leak@example.com', password: LEAKED });
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ error: { code: 'breached_password', fields: { password: BREACHED } } });
    expect((await db.rows("SELECT 1 FROM users WHERE email = 'leak@example.com'")).length).toBe(0);
    expect(asked).toEqual([`https://api.pwnedpasswords.com/range/${ending.slice(0, 5)}`]);
    expect(JSON.stringify(asked)).not.toContain(LEAKED);
  });

  it('accepts a password that is not leaked, and also when the list cannot be reached', async () => {
    expect((await db.call('POST', '/api/auth/signup', { name: 'Asha', email: 'fine@example.com', password: 'a-long-enough-password' })).status).toBe(201);
    listDown = true;
    expect((await db.call('POST', '/api/auth/signup', { name: 'Asha', email: 'down@example.com', password: LEAKED })).status).toBe(201);
    listDown = false;
  });

  it('refuses a leaked password when resetting too, and the old password keeps working', async () => {
    const s = await db.call('POST', '/api/auth/signup', { name: 'Reset', email: 'reset-leak@example.com', password: 'a-long-enough-password' });
    expect(s.status).toBe(201);
    await db.call('POST', '/api/auth/forgot-password', { email: 'reset-leak@example.com' });
    await new Promise(r => setTimeout(r, 200));
    const token = mail.tokenFor('reset-leak@example.com')!;
    const r = await db.call('POST', '/api/auth/reset-password', { token, password: LEAKED });
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ error: { code: 'breached_password' } });
    expect((await db.call('POST', '/api/auth/login', { email: 'reset-leak@example.com', password: 'a-long-enough-password' })).status).toBe(200);
    expect((await db.call('POST', '/api/auth/reset-password', { token, password: 'another-long-password-ok' })).status).toBe(204); // the link was not used up
  });
});
