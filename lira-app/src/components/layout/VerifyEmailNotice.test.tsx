import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { byText, cleanup, click, mount, q, settle } from '../../test/render';
import { VerifyEmailNotice } from './VerifyEmailNotice';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let fetchMock: ReturnType<typeof vi.fn>;
const serve = (providers: Response, resend: () => Response = () => new Response(null, { status: 204 })) =>
  fetchMock.mockImplementation(async (url: string) => (url === '/api/auth/providers' ? providers : resend()));

beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('the confirm-your-email reminder', () => {
  it('shows nothing when the server cannot send email, because the reminder would promise a link that never comes', async () => {
    serve(json(200, { google: false, email: false }));
    mount(<VerifyEmailNotice email="a@b.co" />);
    await settle(30);
    expect(q('[role="status"]')).toBeNull();
  });

  it('names the address and sends a new link when asked', async () => {
    serve(json(200, { google: false, email: true }));
    mount(<VerifyEmailNotice email="a@b.co" />);
    await settle(30);
    expect(q('[role="status"]')!.textContent).toContain('a@b.co');
    await click(byText('button', 'Send it again'));
    await settle(30);
    expect(fetchMock.mock.calls.some(c => c[0] === '/api/auth/resend-verification')).toBe(true);
    expect(q('[role="status"]')!.textContent).toContain('Sent. Check your inbox.');
  });

  it('shows the server\'s message when it refuses, and goes away when closed', async () => {
    serve(json(200, { email: true }), () => json(429, { error: { message: 'A link was sent a moment ago. Check your inbox, or wait a while and try again.' } }));
    mount(<VerifyEmailNotice email="a@b.co" />);
    await settle(30);
    await click(byText('button', 'Send it again'));
    await settle(30);
    expect(q('[role="status"]')!.textContent).toContain('A link was sent a moment ago');
    await click(byText('button', 'Not now'));
    expect(q('[role="status"]')).toBeNull();
  });
});
