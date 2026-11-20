import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { byText, cleanup, click, mount, q, settle } from '../../test/render';
import { loadProfile } from '../../utils/userPrefs';
import { SessionGate } from './SessionGate';

function ProfileProbe({ onRender }: { onRender: (name: string) => void }) {
  onRender(loadProfile().name);
  return <p id="probe">The app</p>;
}

const go = vi.hoisted(() => vi.fn());
vi.mock('../../utils/navigate', () => ({ goTo: go }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => { go.mockReset(); fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
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
    fetchMock.mockResolvedValue(json(200, { user: { id: '1', email: 'a@b.co', name: 'A' }, organisations: [] }));
    gate();
    await settle(50);
    expect(q('#secret')).not.toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/me');
    expect((fetchMock.mock.calls[0][1] as RequestInit).credentials).toBe('same-origin');
    expect(go).not.toHaveBeenCalled();
  });

  it('puts the signed-in person\'s own name and email into the profile before the app shows', async () => {
    fetchMock.mockResolvedValue(json(200, { user: { id: '1', email: 'test@gmail.com', name: 'Test User' }, organisations: [{ orgId: 'o', orgName: 'x', role: 'owner' }] }));
    let seen = '';
    mount(<SessionGate><ProfileProbe onRender={name => { seen = name; }} /></SessionGate>);
    await settle(50);
    expect(seen).toBe('Test User');
    expect(loadProfile().email).toBe('test@gmail.com');
  });

  it('sends someone who is not signed in to the log-in page, and never shows the app', async () => {
    fetchMock.mockResolvedValue(json(401, { error: { code: 'unauthorised', message: 'You are not signed in.' } }));
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
    fetchMock.mockResolvedValue(json(200, { user: { id: '1', email: 'a@b.co', name: 'A' }, organisations: [] }));
    await click(byText('button', 'Try again'));
    await settle(50);
    expect(q('#secret')).not.toBeNull();
  });

  it('treats a server error like no answer, not like being signed out', async () => {
    fetchMock.mockResolvedValue(json(503, { error: { code: 'unavailable', message: 'x' } }));
    gate();
    await settle(50);
    expect(q('[role="alert"]')).not.toBeNull();
    expect(go).not.toHaveBeenCalled();
  });
});
