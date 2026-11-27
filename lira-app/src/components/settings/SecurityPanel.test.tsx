import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { byText, cleanup, click, mount, q, qa, settle, typeInto } from '../../test/render';
import { SecurityPanel } from './SecurityPanel';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let fetchMock: ReturnType<typeof vi.fn>;
let state = { available: true, enabled: false };
const answers: Record<string, () => Response> = {};
const callsTo = (path: string) => fetchMock.mock.calls.filter(c => c[0] === path);

beforeEach(() => {
  state = { available: true, enabled: false };
  for (const k of Object.keys(answers)) delete answers[k];
  fetchMock = vi.fn(async (url: string) => (url === '/api/me/two-step' ? json(200, state) : answers[url]?.() ?? json(500, {})));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const open = async () => { mount(<SecurityPanel />); await settle(40); };
const body = (path: string) => JSON.parse((callsTo(path)[0][1] as RequestInit).body as string);

describe('the security dialog', () => {
  it('says so when the server does not offer two-step sign-in, and offers nothing to turn on', async () => {
    state = { available: false, enabled: false };
    await open();
    expect(document.body.textContent).toContain('not set up on this server');
    expect(byText('button', 'Turn on')).toBeUndefined();
  });

  it('turns it on in three steps: the key to type, the first code, then the ten recovery codes once', async () => {
    answers['/api/me/two-step/begin'] = () => json(200, { secret: 'ABCDEFGHIJKLMNOP', uri: 'otpauth://totp/Liraspaces%3Aa%40b.co?secret=ABCDEFGHIJKLMNOP' });
    answers['/api/me/two-step/confirm'] = () => json(200, { recoveryCodes: ['aaaaa-bbbbb', 'ccccc-ddddd'] });
    await open();
    await click(byText('button', 'Turn on'));
    await settle(30);
    expect(q('code[aria-label="Setup key"]')!.textContent).toBe('ABCDEFGHIJKLMNOP');
    expect(q('a[href^="otpauth://"]')).not.toBeNull();
    await typeInto(q<HTMLInputElement>('input[aria-label="Code"]'), '123456');
    await click(byText('section[aria-label="Set up two-step sign-in"] button', 'Turn on'));
    await settle(30);
    expect(body('/api/me/two-step/confirm')).toEqual({ code: '123456' });
    expect(qa('section[aria-label="Recovery codes"] li').map(li => li.textContent)).toEqual(['aaaaa-bbbbb', 'ccccc-ddddd']);
    await click(byText('button', 'I have saved them'));
    expect(document.body.textContent).toContain('On. After your password');
    expect(document.body.textContent).not.toContain('aaaaa-bbbbb'); // not shown again
  });

  it('shows the reason and stays on the step when the first code is wrong', async () => {
    answers['/api/me/two-step/begin'] = () => json(200, { secret: 'ABCDEFGHIJKLMNOP', uri: 'otpauth://x' });
    answers['/api/me/two-step/confirm'] = () => json(400, { error: { message: 'That code is not correct. Check the time on your phone and try the newest code.' } });
    await open();
    await click(byText('button', 'Turn on'));
    await settle(30);
    await typeInto(q<HTMLInputElement>('input[aria-label="Code"]'), '000000');
    await click(byText('section[aria-label="Set up two-step sign-in"] button', 'Turn on'));
    await settle(30);
    expect(q('[role="alert"]')!.textContent).toContain('not correct');
    expect(q('section[aria-label="Recovery codes"]')).toBeNull();
  });

  it('turns it off only with a code, and says it is off', async () => {
    state = { available: true, enabled: true };
    answers['/api/me/two-step/disable'] = () => new Response(null, { status: 204 });
    await open();
    expect(document.body.textContent).toContain('On. After your password');
    await click(byText('button', 'Turn off'));
    expect(byText('section[aria-label="Turn off two-step sign-in"] button', 'Turn off')!.hasAttribute('disabled')).toBe(true); // nothing typed yet
    await typeInto(q<HTMLInputElement>('input[aria-label="Code"]'), '654321');
    await click(byText('section[aria-label="Turn off two-step sign-in"] button', 'Turn off'));
    await settle(30);
    expect(body('/api/me/two-step/disable')).toEqual({ code: '654321' });
    expect(document.body.textContent).toContain('Off. Add an authenticator app');
  });
});
