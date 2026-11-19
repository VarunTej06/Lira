import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMe, login, logout, readResponse, signup } from './authApi';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const stubFetch = (reply: () => Response | Promise<Response>) => { const f = vi.fn(async () => reply()); vi.stubGlobal('fetch', f); return f; };

afterEach(() => vi.unstubAllGlobals());

describe('readResponse', () => {
  it('returns the data on success, and nothing for a 204', async () => {
    expect(await readResponse(json(200, { user: { id: '1' } }))).toEqual({ ok: true, data: { user: { id: '1' } } });
    expect(await readResponse(new Response(null, { status: 204 }))).toEqual({ ok: true, data: undefined });
  });

  it('returns the message and the field messages on failure', async () => {
    const r = await readResponse(json(400, { error: { code: 'invalid_input', message: 'Some fields need attention.', fields: { email: 'Bad.', ignored: 5 } } }));
    expect(r).toEqual({ ok: false, status: 400, message: 'Some fields need attention.', fields: { email: 'Bad.' } });
  });

  it('gives a plain message when the answer is not what the API sends', async () => {
    const r = await readResponse(new Response('<html>Bad gateway</html>', { status: 502 }));
    expect(r).toMatchObject({ ok: false, status: 502, message: expect.stringMatching(/Something went wrong/) });
    expect(r.ok === false && r.fields).toBeUndefined();
    expect(JSON.stringify(r)).not.toContain('Bad gateway');
  });
});

describe('calls', () => {
  it('sign-up posts the values as JSON with the page header, from the same site', async () => {
    const f = stubFetch(() => json(201, { user: { id: '1', email: 'a@b.co', name: 'A' }, organisations: [] }));
    const r = await signup({ name: 'A', email: 'a@b.co', password: 'a-long-enough-password' });
    expect(r.ok).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/auth/signup');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect(init.headers).toMatchObject({ 'X-Requested-With': 'liraspaces', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ name: 'A', email: 'a@b.co', password: 'a-long-enough-password' });
  });

  it('log-in, log-out and who-am-I use their own addresses and methods', async () => {
    const f = stubFetch(() => json(200, {}));
    await login({ email: 'a@b.co', password: 'p', remember: true });
    await logout();
    await fetchMe();
    expect(f.mock.calls.map(c => [(c as unknown as [string, RequestInit])[0], (c as unknown as [string, RequestInit])[1].method])).toEqual([
      ['/api/auth/login', 'POST'], ['/api/auth/logout', 'POST'], ['/api/me', 'GET']]);
    expect(JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).remember).toBe(true);
    expect((f.mock.calls[2] as unknown as [string, RequestInit])[1].body).toBeUndefined();
  });

  it('turns a wrong password, a taken email and a lock into messages, with the status', async () => {
    stubFetch(() => json(401, { error: { code: 'unauthorised', message: 'The email or password is not correct.' } }));
    expect(await login({ email: 'a@b.co', password: 'x' })).toMatchObject({ ok: false, status: 401, message: 'The email or password is not correct.' });
    stubFetch(() => json(409, { error: { code: 'conflict', message: 'An account with this email already exists.' } }));
    expect(await signup({ name: 'A', email: 'a@b.co', password: 'a-long-enough-password' })).toMatchObject({ ok: false, status: 409 });
    stubFetch(() => json(429, { error: { code: 'too_many_requests', message: 'Too many wrong attempts.' } }));
    expect(await login({ email: 'a@b.co', password: 'x' })).toMatchObject({ ok: false, status: 429 });
  });

  it('reports no connection instead of throwing', async () => {
    stubFetch(() => { throw new TypeError('Failed to fetch'); });
    expect(await fetchMe()).toEqual({ ok: false, status: 0, message: expect.stringMatching(/Could not reach the server/) });
  });

  it('never puts the password in an address or reads a cookie', async () => {
    const f = stubFetch(() => json(200, {}));
    await login({ email: 'a@b.co', password: 'secret-password-123' });
    expect((f.mock.calls[0] as unknown as [string])[0]).not.toContain('secret');
    expect(JSON.stringify((f.mock.calls[0] as unknown as [string, RequestInit])[1].headers)).not.toMatch(/cookie|authorization/i);
  });
});
