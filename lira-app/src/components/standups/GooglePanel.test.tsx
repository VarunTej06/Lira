import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { byText, cleanup, click, mount, q, settle } from '../../test/render';
import { GooglePanel } from './GooglePanel';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let fetchMock: ReturnType<typeof vi.fn>;
const assign = vi.fn();

beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); assign.mockReset(); vi.stubGlobal('location', { ...window.location, assign }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const panel = (status: Parameters<typeof GooglePanel>[0]['status']) => mount(<GooglePanel org="o1" status={status} reload={() => undefined} />);

describe('the Google panel', () => {
  it('says Google is not set up, with nothing to press', () => {
    panel({ configured: false, connected: false, email: null });
    expect(q('p')!.textContent).toContain('not set up on this server');
    expect(q('button')).toBeNull();
  });

  it('offers to connect when nothing is connected, and not the calendar button', () => {
    panel({ configured: true, connected: false, email: null });
    expect(byText('button', 'Connect Google')).toBeDefined();
    expect(byText('button', 'Allow calendar invitations')).toBeUndefined();
  });

  it('says calls go into the calendar once the permission is there, with no button to ask again', () => {
    panel({ configured: true, connected: true, email: 'o@gmail.com', calendar: true });
    expect(q('section')!.textContent).toContain('each call goes into its calendar');
    expect(byText('button', 'Allow calendar invitations')).toBeUndefined();
    expect(byText('button', 'Disconnect Google')).toBeDefined();
  });

  it('asks the Owner to approve once more for a connection made before, and sends them to Google', async () => {
    fetchMock.mockResolvedValue(json(200, { url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' }));
    panel({ configured: true, connected: true, email: 'o@gmail.com', calendar: false });
    expect(q('section')!.textContent).toContain('invitation emails are sent from it');
    await click(byText('button', 'Allow calendar invitations'));
    await settle(30);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/orgs/o1/google/connect');
    expect(assign).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?x=1');
  });

  it('shows the reason when Google cannot be reached', async () => {
    fetchMock.mockResolvedValue(json(409, { error: { message: 'Google is not set up on this server.' } }));
    panel({ configured: true, connected: false, email: null });
    await click(byText('button', 'Connect Google'));
    await settle(30);
    expect(q('[role="alert"]')!.textContent).toContain('not set up');
    expect(assign).not.toHaveBeenCalled();
  });
});
