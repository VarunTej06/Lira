import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { byText, cleanup, click, mount, q, settle, typeInto } from '../../test/render';
import { PublicSite } from './PublicSite';
import { forgetVerifications } from '../../hooks/useEmailVerification';

const go = vi.hoisted(() => vi.fn());
vi.mock('../../utils/navigate', () => ({ goTo: go }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const NOT_SIGNED_IN = () => json(401, { error: { message: 'Sign in.' } });
const TOKEN = 'A'.repeat(43);
let fetchMock: ReturnType<typeof vi.fn>;

/** Everything answers as `reply` does, except "who am I", which says nobody. */
const answerAs = (reply: (url: string, init?: RequestInit) => Response) =>
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => (url === '/api/me' ? NOT_SIGNED_IN() : reply(url, init)));
const callsTo = (path: string) => fetchMock.mock.calls.filter(c => c[0] === path);
const bodyOf = (path: string) => JSON.parse((callsTo(path)[0][1] as RequestInit).body as string);

beforeEach(() => { go.mockReset(); forgetVerifications(); fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function visit(path: string) {
  mount(<MemoryRouter initialEntries={[path]}><PublicSite /></MemoryRouter>);
  await settle(400);
}

describe('forgot password', () => {
  it('is reached from the log-in page', async () => {
    answerAs(() => json(200, { google: false }));
    await visit('/login');
    expect(q('a[href="/forgot-password"]')!.textContent).toBe('Forgot password?');
  });

  it('checks the email before it asks the server, then says the same thing whatever the server knows', async () => {
    answerAs(() => new Response(null, { status: 204 }));
    await visit('/forgot-password');
    await click(byText('button', 'Send the link'));
    expect(q('[role="alert"]')!.textContent).toBe('Enter your email.');
    expect(callsTo('/api/auth/forgot-password')).toHaveLength(0);
    await typeInto(q<HTMLInputElement>('#email'), 'asha@example.com');
    await click(byText('button', 'Send the link'));
    await settle(50);
    expect(bodyOf('/api/auth/forgot-password')).toEqual({ email: 'asha@example.com' });
    expect(q('[role="status"]')!.textContent).toContain('If there is an account for asha@example.com');
    expect(q('a[href="/login"]')).not.toBeNull();
  });

  it('shows the server message when email is not set up, and keeps the form', async () => {
    answerAs(() => json(503, { error: { code: 'email_not_set_up', message: 'Email is not set up on this server, so a reset link cannot be sent. Contact the administrator.' } }));
    await visit('/forgot-password');
    await typeInto(q<HTMLInputElement>('#email'), 'asha@example.com');
    await click(byText('button', 'Send the link'));
    await settle(50);
    expect(q('[role="alert"]')!.textContent).toContain('Email is not set up');
    expect(q('#email')).not.toBeNull();
  });
});

describe('reset password', () => {
  it('says the link is not valid when it has no token', async () => {
    answerAs(() => json(200, {}));
    await visit('/reset-password');
    expect(q('h1')!.textContent).toBe('This link is not valid');
    expect(q('a[href="/forgot-password"]')).not.toBeNull();
    expect(q('#password')).toBeNull();
  });

  it('asks for ten characters before it calls the server, then sends the token and the password once, and offers to log in', async () => {
    answerAs(() => new Response(null, { status: 204 }));
    await visit(`/reset-password?token=${TOKEN}`);
    await typeInto(q<HTMLInputElement>('#password'), 'short');
    await click(byText('button', 'Save the new password'));
    expect(q('[role="alert"]')!.textContent).toContain('Use at least 10 characters.');
    expect(callsTo('/api/auth/reset-password')).toHaveLength(0);
    await typeInto(q<HTMLInputElement>('#password'), 'a-brand-new-password');
    await click(byText('button', 'Save the new password'));
    await settle(50);
    expect(bodyOf('/api/auth/reset-password')).toEqual({ token: TOKEN, password: 'a-brand-new-password' });
    expect(q('h1')!.textContent).toBe('Password changed');
    expect(q('a[href="/login"]')).not.toBeNull();
  });

  it('shows an expired or used link as such and offers a new one', async () => {
    answerAs(() => json(400, { error: { code: 'invalid_token', message: 'This link has expired or was already used. Ask for a new one.' } }));
    await visit(`/reset-password?token=${TOKEN}`);
    await typeInto(q<HTMLInputElement>('#password'), 'a-brand-new-password');
    await click(byText('button', 'Save the new password'));
    await settle(50);
    expect(q('[role="alert"]')!.textContent).toContain('expired or was already used');
    expect(q('a[href="/forgot-password"]')).not.toBeNull();
  });
});

describe('confirm email', () => {
  it('confirms once with the link\'s token and offers to open the app', async () => {
    answerAs(() => new Response(null, { status: 204 }));
    await visit(`/verify-email?token=${TOKEN}`);
    expect(callsTo('/api/auth/verify-email')).toHaveLength(1);
    expect(bodyOf('/api/auth/verify-email')).toEqual({ token: TOKEN });
    expect(q('h1')!.textContent).toBe('Your email is confirmed');
    await click(byText('button', 'Open Liraspaces'));
    expect(go).toHaveBeenCalledWith('/app');
  });

  it('says plainly when the link does not work, and when there is no token at all', async () => {
    answerAs(() => json(400, { error: { code: 'invalid_token', message: 'This link has expired or was already used. Ask for a new one.' } }));
    await visit(`/verify-email?token=${TOKEN}`);
    expect(q('[role="alert"]')!.textContent).toContain('expired or was already used');
    cleanup();
    fetchMock.mockClear();
    await visit('/verify-email');
    expect(q('[role="alert"]')!.textContent).toContain('This link is not valid');
    expect(callsTo('/api/auth/verify-email')).toHaveLength(0);
  });
});
