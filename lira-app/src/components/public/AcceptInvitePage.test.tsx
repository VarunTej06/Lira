import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { byText, cleanup, click, mount, q, settle } from '../../test/render';
import AcceptInvitePage from './AcceptInvitePage';

const accept = vi.hoisted(() => vi.fn());
vi.mock('../../services/accessApi', () => ({ acceptInvitation: accept }));
const go = vi.hoisted(() => vi.fn());
vi.mock('../../utils/navigate', () => ({ goTo: go }));

beforeEach(() => { accept.mockReset(); go.mockReset(); localStorage.removeItem('lira_workspace'); });
afterEach(cleanup);

const open = (search: string) => mount(<MemoryRouter initialEntries={[`/invite${search}`]}><AcceptInvitePage /></MemoryRouter>);
const TOKEN = 'T'.repeat(43);

describe('accepting an invitation', () => {
  it('does nothing until the person presses the button, then sends only the link\'s token', async () => {
    accept.mockResolvedValue({ ok: true, data: { orgId: 'o', orgName: 'Acme' } });
    open(`?token=${TOKEN}`);
    await settle(20);
    expect(accept).not.toHaveBeenCalled();
    await click(byText('button', 'Accept invitation'));
    expect(accept).toHaveBeenCalledWith(TOKEN);
    expect(q('[role="status"]')!.textContent).toContain('You have joined Acme');
    await click(byText('button', 'Open my workspace'));
    expect(go).toHaveBeenCalledWith('/app');
    expect(localStorage.getItem('lira_workspace')).toBeNull(); // their own workspace stays the default
    await click(byText('button', 'Open the shared workspace'));
    expect(localStorage.getItem('lira_workspace')).toBe('o'); // this time the one they just joined
    expect(go).toHaveBeenCalledTimes(2);
  });

  it('asks someone who is not signed in to log in or sign up first', async () => {
    accept.mockResolvedValue({ ok: false, status: 401, message: 'You are not signed in.' });
    open(`?token=${TOKEN}`);
    await click(byText('button', 'Accept invitation'));
    expect(q('[role="alert"]')!.textContent).toContain('not signed in yet');
    const back = encodeURIComponent(`/invite?token=${TOKEN}`);
    expect(q(`a[href="/login?next=${back}"]`)).not.toBeNull(); // after logging in the person comes back to accept
    expect(q(`a[href="/signup?next=${back}"]`)).not.toBeNull();
  });

  it('shows the server\'s reason when the link was meant for another address, or is used up or expired', async () => {
    accept.mockResolvedValue({ ok: false, status: 403, message: 'This invitation was sent to a different email address.' });
    open(`?token=${TOKEN}`);
    await click(byText('button', 'Accept invitation'));
    expect(q('[role="alert"]')!.textContent).toContain('different email address');
    expect(q('a[href^="/login"]')).toBeNull();
  });

  it('says the link is not complete when there is no token, and offers no button', () => {
    open('');
    expect(q('[role="alert"]')!.textContent).toContain('not complete');
    expect(byText('button', 'Accept invitation')).toBeUndefined();
  });
});
