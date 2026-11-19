import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { byText, cleanup, click, mount, q, settle } from '../../test/render';
import { AccountDropdown } from './AccountDropdown';

const go = vi.hoisted(() => vi.fn());
vi.mock('../../utils/navigate', () => ({ goTo: go }));
vi.mock('../../utils/edition', async importOriginal => ({ ...(await importOriginal<typeof import('../../utils/edition')>()), isHosted: () => true }));

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { go.mockReset(); fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Log out in the hosted edition', () => {
  it('ends the session on the server and then opens the log-in page', async () => {
    mount(<AccountDropdown />);
    await click(q('button[title="Your account"]'));
    await click(byText('button', 'Log out'));
    await settle(50);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/logout');
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST');
    expect(go).toHaveBeenCalledWith('/login');
  });
});
