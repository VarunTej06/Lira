import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { byText, cleanup, click, mount, q, settle } from '../../test/render';
import { resetHostedKv } from '../../services/kvMirror';
import { loadProfile } from '../../utils/userPrefs';
import { SessionGate } from './SessionGate';

function ProfileProbe({ onRender }: { onRender: (name: string) => void }) {
  onRender(loadProfile().name);
  return <p id="probe">The app</p>;
}

const go = vi.hoisted(() => vi.fn());
vi.mock('../../utils/navigate', () => ({ goTo: go }));

const ME = { user: { id: '1', email: 'a@b.co', name: 'A' }, organisations: [{ orgId: 'org-1', orgName: 'A', role: 'owner' }] };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let fetchMock: ReturnType<typeof vi.fn>;

/** Answers each address with a fresh response, as the server does. */
const serve = (me: () => Response, kv: () => Response = () => json(200, { shared: {}, mine: {} })) =>
  fetchMock.mockImplementation(async (url: string) => (url === '/api/me' ? me() : url === '/api/orgs/org-1/kv' ? kv() : url.startsWith('/api/orgs/org-1/objects/') ? json(200, []) : json(404, {})));

beforeEach(() => { go.mockReset(); resetHostedKv(); localStorage.clear(); fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const gate = () => mount(<SessionGate><p id="secret">The app</p></SessionGate>);

describe('SessionGate', () => {
  it('shows a placeholder while it asks, and keeps the app hidden', async () => {
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    gate();
    await settle(20);
    expect(q('#secret')).toBeNull();
    expect(q('[role="status"]')!.textContent).toContain('Checking your session');
  });

  it('shows the app to someone who is signed in, asking the server with the session cookie', async () => {
    serve(() => json(200, ME));
    gate();
    await settle(50);
    expect(q('#secret')).not.toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/me');
    expect((fetchMock.mock.calls[0][1] as RequestInit).credentials).toBe('same-origin');
    expect(go).not.toHaveBeenCalled();
  });

  it('puts the signed-in person\'s own name and email into the profile before the app shows', async () => {
    serve(() => json(200, { user: { id: '1', email: 'test@gmail.com', name: 'Test User' }, organisations: [{ orgId: 'org-1', orgName: 'x', role: 'owner' }] }));
    let seen = '';
    mount(<SessionGate><ProfileProbe onRender={name => { seen = name; }} /></SessionGate>);
    await settle(80);
    expect(seen).toBe('Test User');
    expect(loadProfile().email).toBe('test@gmail.com');
  });

  it('loads the person\'s data from the server before the app shows, replacing what an earlier account left in this browser', async () => {
    localStorage.setItem('lira_projects', '[{"id":"left-behind"}]');
    serve(() => json(200, ME), () => json(200, { shared: { lira_sprint_defs: '{"r":1}' }, mine: { lira_theme: 'dark' } }));
    let atFirstRender: (string | null)[] = [];
    mount(<SessionGate><ProfileProbe onRender={() => { atFirstRender = [localStorage.getItem('lira_projects'), localStorage.getItem('lira_sprint_defs'), localStorage.getItem('lira_theme')]; }} /></SessionGate>);
    await settle(80);
    expect(atFirstRender).toEqual([null, '{"r":1}', 'dark']);
  });

  it('does not show the app, and offers to try again, when the person\'s data cannot be loaded', async () => {
    let kvDown = true;
    serve(() => json(200, ME), () => (kvDown ? json(503, { error: { message: 'x' } }) : json(200, { shared: {}, mine: {} })));
    gate();
    await settle(50);
    expect(q('#secret')).toBeNull();
    expect(q('[role="alert"]')).not.toBeNull();
    kvDown = false;
    await click(byText('button', 'Try again'));
    await settle(80);
    expect(q('#secret')).not.toBeNull();
  });

  it('sends someone who is not signed in to the log-in page, and never shows the app', async () => {
    serve(() => json(401, { error: { code: 'unauthorised', message: 'You are not signed in.' } }));
    gate();
    await settle(50);
    expect(go).toHaveBeenCalledWith('/login');
    expect(q('#secret')).toBeNull();
  });

  it('does not let the app in when the server is down, and offers to try again', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    gate();
    await settle(50);
    expect(q('#secret')).toBeNull();
    expect(q('[role="alert"]')!.textContent).toContain('could not check your session');
    expect(go).not.toHaveBeenCalled();
    serve(() => json(200, ME));
    await click(byText('button', 'Try again'));
    await settle(80);
    expect(q('#secret')).not.toBeNull();
  });

  it('treats a server error like no answer, not like being signed out', async () => {
    serve(() => json(503, { error: { code: 'unavailable', message: 'x' } }));
    gate();
    await settle(50);
    expect(q('[role="alert"]')).not.toBeNull();
    expect(go).not.toHaveBeenCalled();
  });
});
