import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { byText, cleanup, click, mount, q, settle, typeInto } from '../../test/render';
import { PublicSite } from './PublicSite';

const go = vi.hoisted(() => vi.fn());
vi.mock('../../utils/navigate', () => ({ goTo: go }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const CHALLENGE = 'C'.repeat(43);
let fetchMock: ReturnType<typeof vi.fn>;

/** "Who am I" says nobody; the password step asks for a code; the code step answers as `second` does. */
const serve = (second: () => Response) => fetchMock.mockImplementation(async (url: string) => {
  if (url === '/api/me') return json(401, { error: { message: 'Sign in.' } });
  if (url === '/api/auth/login') return json(200, { twoStep: true, challenge: CHALLENGE });
  if (url === '/api/auth/login/two-step') return second();
  return json(200, { google: false });
});
const callsTo = (path: string) => fetchMock.mock.calls.filter(c => c[0] === path);

beforeEach(() => { go.mockReset(); fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function toCodeStep(path = '/login') {
  mount(<MemoryRouter initialEntries={[path]}><PublicSite /></MemoryRouter>);
  await settle(400);
  await typeInto(q<HTMLInputElement>('#email'), 'asha@example.com');
  await typeInto(q<HTMLInputElement>('#password'), 'a-long-enough-password');
  await click(byText('button', 'Log in'));
  await settle(50);
}

describe('logging in with two-step sign-in on', () => {
  it('asks for the code after the password, without signing in or going anywhere yet', async () => {
    serve(() => json(200, {}));
    await toCodeStep();
    expect(q('h1')!.textContent).toBe('Enter your code');
    expect(q('#password')).toBeNull();
    expect(go).not.toHaveBeenCalled();
  });

  it('sends the challenge with the code, and opens the app when it is right', async () => {
    serve(() => json(200, { user: { id: '1', email: 'asha@example.com', name: 'Asha' }, organisations: [] }));
    await toCodeStep();
    await click(byText('button', 'Continue'));
    expect(q('[role="alert"]')!.textContent).toBe('Enter the code.');
    expect(callsTo('/api/auth/login/two-step')).toHaveLength(0);
    await typeInto(q<HTMLInputElement>('#code'), ' 123456 ');
    await click(byText('button', 'Continue'));
    await settle(50);
    expect(JSON.parse((callsTo('/api/auth/login/two-step')[0][1] as RequestInit).body as string)).toEqual({ challenge: CHALLENGE, code: '123456' });
    expect(go).toHaveBeenCalledWith('/app');
  });

  it('goes back to the invitation after the code when the person came from one, and nowhere else', async () => {
    const token = 'B'.repeat(43);
    serve(() => json(200, { user: { id: '1', email: 'asha@example.com', name: 'Asha' }, organisations: [] }));
    await toCodeStep(`/login?next=${encodeURIComponent(`/invite?token=${token}`)}`);
    await typeInto(q<HTMLInputElement>('#code'), '123456');
    await click(byText('button', 'Continue'));
    await settle(50);
    expect(go).toHaveBeenCalledWith(`/invite?token=${token}`);
  });

  it('shows the server\'s reason for a wrong or late code, stays on the step, and can go back to the password', async () => {
    serve(() => json(401, { error: { code: 'wrong_code', message: 'That code is not correct. Check the time on your phone and try the newest code.' } }));
    await toCodeStep();
    await typeInto(q<HTMLInputElement>('#code'), '000000');
    await click(byText('button', 'Continue'));
    await settle(50);
    expect(q('[role="alert"]')!.textContent).toContain('not correct');
    expect(go).not.toHaveBeenCalled();
    await click(byText('button', 'Back to log in'));
    expect(q('#password')).not.toBeNull();
  });
});
