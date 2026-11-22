import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, mount, settle } from '../test/render';
import { useRedirectIfSignedIn } from './useRedirectIfSignedIn';

const go = vi.hoisted(() => vi.fn());
vi.mock('../utils/navigate', () => ({ goTo: go }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let fetchMock: ReturnType<typeof vi.fn>;
function Probe({ active }: { active: boolean }) { useRedirectIfSignedIn(active); return null; }

beforeEach(() => { go.mockReset(); fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('useRedirectIfSignedIn', () => {
  it('opens the app when the server knows the session', async () => {
    fetchMock.mockResolvedValue(json(200, { user: { id: 'u', email: 'a@b.co', name: 'A' }, organisations: [] }));
    mount(<Probe active />);
    await settle(30);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/me');
    expect(go).toHaveBeenCalledWith('/app');
  });

  it('leaves the page alone when there is no session, the server fails, or it cannot be reached', async () => {
    for (const reply of [() => json(401, { error: { message: 'Sign in.' } }), () => json(500, {}), () => { throw new TypeError('offline'); }]) {
      fetchMock.mockImplementation(async () => reply());
      mount(<Probe active />);
      await settle(30);
      cleanup();
    }
    expect(go).not.toHaveBeenCalled();
  });

  it('does not ask at all on pages where it is off', async () => {
    mount(<Probe active={false} />);
    await settle(30);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
