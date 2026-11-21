import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { byText, cleanup, click, mount, q, qa, settle, typeInto } from '../../test/render';
import { PublicSite } from './PublicSite';

const go = vi.hoisted(() => vi.fn());
vi.mock('../../utils/navigate', () => ({ goTo: go }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => { go.mockReset(); fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function visit(path: string) {
  mount(<MemoryRouter initialEntries={[path]}><PublicSite /></MemoryRouter>);
  await settle(400);
}
const body = () => JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
const alerts = () => qa('[role="alert"]').map(a => a.textContent);

describe('log in', () => {
  it('does not call the server until both fields are filled in correctly', async () => {
    await visit('/login');
    await click(byText('button', 'Log in'));
    expect(alerts()).toEqual(['Enter your email.', 'Enter your password.']);
    expect(fetchMock.mock.calls.filter(c => String(c[0]).includes('/auth/login'))).toHaveLength(0); // the page may ask which ways of signing in are offered, but never sends a log-in
  });

  it('sends the email and password, and opens the app on success', async () => {
    fetchMock.mockResolvedValue(json(200, { user: { id: '1', email: 'asha@example.com', name: 'Asha' }, organisations: [] }));
    await visit('/login');
    await typeInto(q<HTMLInputElement>('#email'), 'asha@example.com');
    await typeInto(q<HTMLInputElement>('#password'), 'a-long-enough-password');
    await click(q('#remember'));
    await click(byText('button', 'Log in'));
    await settle(50);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/login');
    expect(body()).toEqual({ email: 'asha@example.com', password: 'a-long-enough-password', remember: true });
    expect(go).toHaveBeenCalledWith('/app');
  });

  it('shows the server message for a wrong password, stays on the page, and keeps the typing', async () => {
    fetchMock.mockResolvedValue(json(401, { error: { code: 'unauthorised', message: 'The email or password is not correct.' } }));
    await visit('/login');
    await typeInto(q<HTMLInputElement>('#email'), 'asha@example.com');
    await typeInto(q<HTMLInputElement>('#password'), 'wrong-password-here');
    await click(byText('button', 'Log in'));
    await settle(50);
    expect(alerts()).toContain('The email or password is not correct.');
    expect(go).not.toHaveBeenCalled();
    expect(q<HTMLInputElement>('#email')!.value).toBe('asha@example.com');
    expect(byText<HTMLButtonElement>('button', 'Log in')!.disabled).toBe(false);
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await visit('/login');
    await typeInto(q<HTMLInputElement>('#email'), 'asha@example.com');
    await typeInto(q<HTMLInputElement>('#password'), 'whatever-password');
    await click(byText('button', 'Log in'));
    await settle(50);
    expect(alerts().join(' ')).toMatch(/Could not reach the server/);
  });

  it('keeps the button off while the request is out, so a double click sends once', async () => {
    let finish: (r: Response) => void = () => undefined;
    fetchMock.mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
    await visit('/login');
    await typeInto(q<HTMLInputElement>('#email'), 'asha@example.com');
    await typeInto(q<HTMLInputElement>('#password'), 'whatever-password');
    await click(byText('button', 'Log in'));
    const busy = byText<HTMLButtonElement>('button', 'Signing in')!;
    expect(busy.disabled).toBe(true);
    await click(busy);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish(json(200, {}));
    await settle(50);
  });
});

describe('sign up', () => {
  async function toDetails(email = 'asha@example.com') {
    await visit(`/signup?email=${encodeURIComponent(email)}`);
    await click(byText('button', 'Sign up'));
  }

  it('checks the name and a password of ten characters before it calls the server', async () => {
    await toDetails();
    await typeInto(q<HTMLInputElement>('#password'), 'short');
    await click(byText('button', 'Create account'));
    expect(alerts()).toEqual(['Enter your name.', 'Use at least 10 characters.']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates the account and opens the app', async () => {
    fetchMock.mockResolvedValue(json(201, { user: { id: '1', email: 'asha@example.com', name: 'Asha Rao' }, organisations: [] }));
    await toDetails();
    await typeInto(q<HTMLInputElement>('#name'), 'Asha Rao');
    await typeInto(q<HTMLInputElement>('#password'), 'a-long-enough-password');
    await click(byText('button', 'Create account'));
    await settle(50);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/signup');
    expect(body()).toEqual({ name: 'Asha Rao', email: 'asha@example.com', password: 'a-long-enough-password' });
    expect(go).toHaveBeenCalledWith('/app');
  });

  it('says when the email already has an account, and offers to log in', async () => {
    fetchMock.mockResolvedValue(json(409, { error: { code: 'conflict', message: 'An account with this email already exists.' } }));
    await toDetails();
    await typeInto(q<HTMLInputElement>('#name'), 'Asha Rao');
    await typeInto(q<HTMLInputElement>('#password'), 'a-long-enough-password');
    await click(byText('button', 'Create account'));
    await settle(50);
    expect(alerts()).toContain('An account with this email already exists.');
    expect(q('[role="dialog"]')!.textContent).toContain('Already have an account? Log in');
    expect(go).not.toHaveBeenCalled();
  });

  it('shows the server\'s message for a field it refuses', async () => {
    fetchMock.mockResolvedValue(json(400, { error: { code: 'invalid_input', message: 'Some fields need attention.', fields: { name: 'Use at most 100 characters.' } } }));
    await toDetails();
    await typeInto(q<HTMLInputElement>('#name'), 'Asha Rao');
    await typeInto(q<HTMLInputElement>('#password'), 'a-long-enough-password');
    await click(byText('button', 'Create account'));
    await settle(50);
    expect(q('#name-error')!.textContent).toBe('Use at most 100 characters.');
  });
});
