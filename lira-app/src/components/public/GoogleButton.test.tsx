import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { forgetProviders } from '../../hooks/useGoogleOffered';
import { cleanup, mount, q, settle } from '../../test/render';
import AuthPage from './AuthPage';
import { EmailBar } from './EmailBar';
import { GoogleButton } from './GoogleButton';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { forgetProviders(); fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('the Google button', () => {
  it('is a link to the server\'s Google sign-in when the server offers Google', async () => {
    fetchMock.mockResolvedValue(json(200, { google: true }));
    mount(<GoogleButton />);
    await settle(30);
    const link = q<HTMLAnchorElement>('a')!;
    expect(link.getAttribute('href')).toBe('/api/auth/google/start');
    expect(link.textContent).toBe('Google');
    expect(link.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(q('button')).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/providers');
  });

  it('asks for the Meet and email permissions only when it is the sign-up button', async () => {
    fetchMock.mockResolvedValue(json(200, { google: true }));
    mount(<GoogleButton intent="signup" />);
    await settle(30);
    expect(q<HTMLAnchorElement>('a')!.getAttribute('href')).toBe('/api/auth/google/start?intent=signup');
  });

  it('is switched off, and says why, when the server does not offer Google, does not answer, or answers something else', async () => {
    for (const reply of [() => json(200, { google: false }), () => { throw new TypeError('offline'); }, () => json(500, {}), () => json(200, { google: 'yes' })]) {
      forgetProviders();
      fetchMock.mockImplementation(async () => reply());
      mount(<GoogleButton />);
      await settle(30);
      const button = q<HTMLButtonElement>('button')!;
      expect(button.disabled).toBe(true);
      expect(button.title).toContain('not set up');
      expect(button.textContent).toBe('Google');
      expect(q('a')).toBeNull();
      cleanup();
    }
  });

  it('asks the server once for all the Google buttons of a page', async () => {
    fetchMock.mockResolvedValue(json(200, { google: true }));
    mount(<><GoogleButton /><GoogleButton /><GoogleButton /></>);
    await settle(30);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('the pages with a Google button', () => {
  it('log in and the sign-up email bar both offer it when Google is set up', async () => {
    fetchMock.mockResolvedValue(json(200, { google: true }));
    mount(<MemoryRouter><AuthPage /></MemoryRouter>);
    await settle(30);
    expect(q('a[href="/api/auth/google/start"]')).not.toBeNull();
    cleanup();
    mount(<EmailBar id="e" onValid={() => undefined} />);
    await settle(30);
    expect(q('a[href="/api/auth/google/start?intent=signup"]')).not.toBeNull();
  });

  it('log in says plainly when Google sent the person back with a problem, and offers the other way', async () => {
    fetchMock.mockResolvedValue(json(200, { google: true }));
    mount(<MemoryRouter initialEntries={['/login?error=google']}><AuthPage /></MemoryRouter>);
    await settle(30);
    expect(q('[role="alert"]')!.textContent).toContain('Google sign-in did not work');
    expect(q('#email')).not.toBeNull();
  });

  it('log in shows no such message in the normal case', async () => {
    fetchMock.mockResolvedValue(json(200, { google: true }));
    mount(<MemoryRouter><AuthPage /></MemoryRouter>);
    await settle(30);
    expect(q('[role="alert"]')).toBeNull();
  });
});
