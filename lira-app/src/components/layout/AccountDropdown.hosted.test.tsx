import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { byText, cleanup, click, mount, q, settle } from '../../test/render';
import { AccountDropdown } from './AccountDropdown';

const go = vi.hoisted(() => vi.fn());
vi.mock('../../utils/navigate', () => ({ goTo: go }));
vi.mock('../../utils/edition', async importOriginal => ({ ...(await importOriginal<typeof import('../../utils/edition')>()), isHosted: () => true }));

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { go.mockReset(); fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Where() { return <p id="where">{useLocation().pathname}</p>; }
const open = () => mount(<MemoryRouter initialEntries={['/for-you']}><AccountDropdown /><Where /></MemoryRouter>);

describe('Log out in the hosted edition', () => {
  it('ends the session on the server and then opens the log-in page', async () => {
    open();
    await click(q('button[title="Your account"]'));
    await click(byText('button', 'Log out'));
    await settle(50);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/logout');
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST');
    expect(go).toHaveBeenCalledWith('/login');
  });
});

describe('Teams and access in the hosted edition', () => {
  it('is in the account menu and opens the Teams page', async () => {
    open();
    await click(q('button[title="Your account"]'));
    await click(byText('button', 'Teams and access'));
    expect(q('#where')!.textContent).toBe('/teams');
  });

  it('has Calls in the account menu, which opens the Manage calls page', async () => {
    open();
    await click(q('button[title="Your account"]'));
    await click(byText('button', 'Calls'));
    expect(q('#where')!.textContent).toBe('/calls');
  });
});
