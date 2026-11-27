import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { byText, cleanup, click, mount, q, settle } from '../../test/render';
import { setActiveOrg, setOrganisations } from '../../utils/hostedOrg';
import { AccountDropdown } from './AccountDropdown';

const go = vi.hoisted(() => vi.fn());
vi.mock('../../utils/navigate', () => ({ goTo: go }));
vi.mock('../../utils/edition', async importOriginal => ({ ...(await importOriginal<typeof import('../../utils/edition')>()), isHosted: () => true }));

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { go.mockReset(); fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); setOrganisations([]); setActiveOrg(null); localStorage.clear(); });

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

describe('switching workspace in the hosted edition', () => {
  const mine = { orgId: 'own', orgName: 'Asha Rao space', role: 'owner' };
  const shared = { orgId: 'theirs', orgName: 'Acme', role: 'member' };

  it('offers nothing to switch when the person is in one workspace only', async () => {
    setOrganisations([mine]); setActiveOrg('own', 'owner');
    open();
    await click(q('button[title="Your account"]'));
    expect(byText('button', 'My workspace')).toBeUndefined();
  });

  it('lists their own and the shared workspace, marks the open one, and switches to the other with a reload', async () => {
    setOrganisations([mine, shared]); setActiveOrg('own', 'owner');
    open();
    await click(q('button[title="Your account"]'));
    expect(byText('button', 'My workspace')!.getAttribute('aria-current')).toBe('true');
    await click(byText('button', 'My workspace'));
    expect(go).not.toHaveBeenCalled(); // already open
    await click(q('button[title="Your account"]'));
    await click(byText('button', 'Acme (invited)'));
    expect(localStorage.getItem('lira_workspace')).toBe('theirs');
    expect(go).toHaveBeenCalledWith('/app');
  });

  it('forgets the choice at log out, so the next sign-in opens their own workspace', async () => {
    localStorage.setItem('lira_workspace', 'theirs');
    open();
    await click(q('button[title="Your account"]'));
    await click(byText('button', 'Log out'));
    await settle(50);
    expect(localStorage.getItem('lira_workspace')).toBeNull();
  });
});

describe('Settings in the hosted edition', () => {
  it('is in the account menu and opens the Settings page', async () => {
    open();
    await click(q('button[title="Your account"]'));
    await click(byText('button', 'Settings'));
    expect(q('#where')!.textContent).toBe('/settings');
  });

  it('no longer lists Teams and access, Security or Calls in the menu, because they are pages inside Settings', async () => {
    open();
    await click(q('button[title="Your account"]'));
    for (const gone of ['Teams and access', 'Security', 'Calls']) expect(byText('button', gone)).toBeUndefined();
    expect(byText('button', 'Account settings')).toBeUndefined();
  });
});
