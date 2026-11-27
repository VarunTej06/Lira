import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { byText, cleanup, click, mount, q, qa, settle } from '../../test/render';
import { setActiveOrg } from '../../utils/hostedOrg';
import { forgetCallAccess } from './useCallAccess';
import { StandupButton } from './StandupButton';

const edition = vi.hoisted(() => ({ hosted: true }));
vi.mock('../../utils/edition', async importOriginal => ({ ...(await importOriginal<typeof import('../../utils/edition')>()), isHosted: () => edition.hosted }));
const access = vi.hoisted(() => ({ myAccess: vi.fn() }));
vi.mock('../../services/accessApi', () => access);
const api = vi.hoisted(() => ({ listStandups: vi.fn(), standupAudience: vi.fn(), createStandup: vi.fn(), updateStandup: vi.fn(), deleteStandup: vi.fn() }));
vi.mock('../../services/standupsApi', async importOriginal => ({ ...(await importOriginal<typeof import('../../services/standupsApi')>()), ...api }));
vi.mock('../common/DatePicker', () => ({
  // The real picker has its own tests; a plain field stands in here
  DatePicker: ({ value, onChange, 'aria-label': label }: { value: string; onChange: (v: string) => void; 'aria-label'?: string }) => <input aria-label={label} value={value} onChange={e => onChange(e.target.value)} />,
}));
const dialog = vi.hoisted(() => ({ confirmDialog: vi.fn(async () => true) }));
vi.mock('../common/dialogStore', () => dialog);
vi.mock('../../utils/clock', () => ({ currentTimeMs: () => new Date('2026-11-23T00:00:00Z').getTime() }));
vi.mock('../../hooks/useIssues', () => ({ useAllIssues: () => [] }));

const ok = <T,>(data: T) => ({ ok: true as const, data });
const once = { repeat: 'none' as const, repeatUntil: null, timeZone: 'Asia/Kolkata', linkSource: 'pasted' as const, invitees: [{ type: 'team' as const, id: 't1' }] };
const projectCall = { ...once, id: 'c1', title: 'Weekly sync', startsAt: '2026-11-24T04:30:00Z', durationMinutes: 30, link: 'https://meet.google.com/abc-defg-hij', scopeType: 'project' as const, scopeId: 'project:proj-a', scopeName: 'Alpha' };
const otherCall = { ...projectCall, id: 'c2', title: 'Beta sync', scopeId: 'project:proj-b', scopeName: 'Beta' };
const standup = { ...projectCall, id: 'c3', title: 'Daily', scopeType: 'org' as const, scopeId: '', scopeName: '' };
const audience = { people: [{ id: 'u1', name: 'Asha', email: 'a@x.co' }], teams: [{ id: 't1', name: 'Dev' }], canMakeMeetLink: true };
const projectScope = { type: 'project' as const, id: 'project:proj-a', name: 'Alpha' };

function Where() { return <p id="where">{useLocation().pathname}</p>; }
const render = async () => {
  mount(<MemoryRouter initialEntries={['/projects']}><StandupButton scope={projectScope} /><Where /></MemoryRouter>);
  await settle(40);
};
const typeInto = async (el: HTMLInputElement, value: string) => {
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); });
};

beforeEach(() => {
  edition.hosted = true;
  forgetCallAccess();
  Object.values({ ...access, ...api, ...dialog }).forEach(f => f.mockClear());
  setActiveOrg('org-1');
  access.myAccess.mockResolvedValue(ok({ role: 'owner', canManageAccess: true }));
  api.listStandups.mockResolvedValue(ok([projectCall, otherCall, standup]));
  api.standupAudience.mockResolvedValue(ok(audience));
});
afterEach(() => { cleanup(); setActiveOrg(null); });

describe('the call button in the hosted edition', () => {
  it('is one button for everyone, Owner and Admin included: Manage calls is in the popup, not beside the button', async () => {
    await render();
    expect(byText('button', 'Project sync')).toBeDefined();
    expect(byText('button', 'Manage calls')).toBeUndefined();
    expect(qa('button')).toHaveLength(1);
    cleanup();
    access.myAccess.mockResolvedValue(ok({ role: 'member', canManageAccess: false }));
    forgetCallAccess();
    await render();
    expect(qa('button')).toHaveLength(1);
  });

  it('is the old stand-up hub in the local edition, with no Manage calls button', async () => {
    edition.hosted = false;
    await render();
    expect(byText('button', 'Manage calls')).toBeUndefined();
    expect(access.myAccess).not.toHaveBeenCalled();
  });
});

describe('the popup of a call button', () => {
  const open = async () => { await render(); await click(byText('button', 'Project sync')); await settle(40); };

  it('lists the calls of that one project, and not those of another project or the stand-ups, each with a Join link that opens safely', async () => {
    await open();
    const body = q('[role="dialog"]')?.textContent ?? document.body.textContent!;
    expect(body).toContain('Weekly sync');
    expect(body).not.toContain('Beta sync');
    expect(body).not.toContain('Daily');
    const join = qa<HTMLAnchorElement>('a').find(a => a.textContent === 'Join call')!;
    expect(join.getAttribute('href')).toBe(projectCall.link);
    expect(join.getAttribute('target')).toBe('_blank');
    expect(join.getAttribute('rel')).toContain('noopener');
  });

  it('lets an Owner or Admin change and delete an existing call right there, and open the Manage calls page from the popup', async () => {
    api.updateStandup.mockResolvedValue(ok(projectCall));
    api.deleteStandup.mockResolvedValue(ok(undefined));
    await open();
    await click(byText('button', 'Change'));
    expect(document.body.textContent).toContain('Project sync: Alpha');
    await click(byText('button', 'Save changes'));
    await settle(30);
    expect(api.updateStandup).toHaveBeenCalledWith('org-1', 'c1', expect.objectContaining({ title: 'Weekly sync' }));
    expect(api.updateStandup.mock.calls[0][2]).not.toHaveProperty('scopeType');
    await click(byText('button', 'Delete'));
    expect(api.deleteStandup).toHaveBeenCalledWith('org-1', 'c1');
    await click(byText('button', 'Manage calls'));
    expect(q('#where')!.textContent).toBe('/settings/calls');
  });

  it('lets an Owner or Admin schedule a call for that project right there, with its scope fixed', async () => {
    api.listStandups.mockResolvedValue(ok([]));
    api.createStandup.mockResolvedValue(ok({ ...projectCall, emailed: { sent: 0, total: 1 } }));
    await open();
    expect(document.body.textContent).toContain('No project sync is scheduled here.');
    await click(byText('button', 'Schedule a project sync'));
    expect(q('select[aria-label="What is this call for"]')).toBeNull(); // the popup is for this project only
    await typeInto(q<HTMLInputElement>('input[aria-label="First day"]')!, '2026-12-01');
    await click(qa<HTMLInputElement>('form fieldset input')[0]);
    await click(byText('button', 'Schedule'));
    await settle(30);
    expect(api.createStandup.mock.calls[0][1]).toMatchObject({ scopeType: 'project', scopeId: 'project:proj-a', scopeName: 'Alpha', title: 'Project sync' });
  });

  it('gives a member the calls and Join links only: nothing to schedule, change, delete or manage', async () => {
    access.myAccess.mockResolvedValue(ok({ role: 'member', canManageAccess: false }));
    api.listStandups.mockResolvedValue(ok([{ ...projectCall, invitees: null }]));
    await open();
    expect(byText('a', 'Join call')).toBeDefined();
    for (const name of ['Change', 'Delete', 'Manage calls']) expect(byText('button', name), name).toBeUndefined();
    expect(qa('button').some(b => b.textContent?.startsWith('Schedule a'))).toBe(false);
    expect(api.standupAudience).not.toHaveBeenCalled();
  });

  it('shows an error with a way to try again when the calls cannot be loaded', async () => {
    api.listStandups.mockResolvedValueOnce({ ok: false, status: 0, message: 'Could not reach the server.' }).mockResolvedValue(ok([projectCall]));
    await open();
    expect(document.body.textContent).toContain('Could not reach the server.');
    await click(byText('button', 'Try again'));
    await settle(40);
    expect(document.body.textContent).toContain('Weekly sync');
  });
});
