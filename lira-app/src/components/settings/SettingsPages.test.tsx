import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { byText, cleanup, click, mount, q, qa, settle } from '../../test/render';
import { setActiveOrg, setOrganisations } from '../../utils/hostedOrg';
import { appStorage } from '../../utils/appStorage';
import { SettingsRoutes } from './SettingsRoutes';

const api = vi.hoisted(() => ({
  myAccess: vi.fn(), listMembers: vi.fn(), listTeams: vi.fn(), listInvitations: vi.fn(), listAllGrants: vi.fn(), setGrant: vi.fn(), revokeGrant: vi.fn(),
}));
vi.mock('../../services/accessApi', async importOriginal => ({ ...(await importOriginal<typeof import('../../services/accessApi')>()), ...api }));
const work = vi.hoisted(() => ({ listSpaces: vi.fn(), listObjects: vi.fn() }));
vi.mock('../../services/workspaceApi', () => work);
vi.mock('../standups/StandupsPage', () => ({ StandupsPage: () => <p>Calls page</p> }));
vi.mock('../../services/twoStepApi', () => ({ twoStepStatus: vi.fn(async () => ({ ok: true, data: { available: false, enabled: false } })), beginTwoStep: vi.fn(), confirmTwoStep: vi.fn(), disableTwoStep: vi.fn() }));

const ok = <T,>(data: T) => ({ ok: true as const, data });
const owner = { userId: 'u0', name: 'Olive Owner', email: 'o@x.co', role: 'owner', manageAccess: true, teamIds: [] as string[] };
const asha = { userId: 'u1', name: 'Asha', email: 'asha@x.co', role: 'member', manageAccess: false, teamIds: ['t1'] };
const qaTeam = { id: 't1', name: 'QA', memberIds: ['u1'] };
const grants = [
  { id: 'g1', subjectType: 'user', subjectId: 'u1', kind: 'space', objectId: '4', level: 'view' },
  { id: 'g2', subjectType: 'team', subjectId: 't1', kind: 'project', objectId: 'p1', level: 'edit' },
];

beforeEach(() => {
  Object.values({ ...api, ...work }).forEach(f => f.mockReset());
  setActiveOrg('org-1');
  api.myAccess.mockResolvedValue(ok({ role: 'owner', canManageAccess: true }));
  api.listMembers.mockResolvedValue(ok([owner, asha]));
  api.listTeams.mockResolvedValue(ok([qaTeam]));
  api.listInvitations.mockResolvedValue(ok([]));
  api.listAllGrants.mockResolvedValue(ok(grants));
  api.setGrant.mockResolvedValue(ok({}));
  api.revokeGrant.mockResolvedValue(ok(undefined));
  work.listSpaces.mockResolvedValue(ok([{ id: 4, key: 'LIRA', name: 'Lira' }]));
  work.listObjects.mockImplementation(async (_o: string, kind: string) => ok(kind === 'project' ? [{ id: 'p1', doc: { name: 'Alpha' }, version: 1 }] : []));
});
afterEach(() => { cleanup(); setActiveOrg(null); setOrganisations([]); });

const open = async (path: string) => {
  mount(<MemoryRouter initialEntries={[path]}><Routes><Route path="/settings/*" element={<SettingsRoutes />} /></Routes></MemoryRouter>);
  await settle(40);
};
const pick = async (el: HTMLSelectElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
};
const railLabels = () => qa('nav[aria-label="Settings"] a').map(a => a.textContent);

describe('the Settings rail', () => {
  it('lists every page, in groups, for a person who may manage access, and opens Account settings first', async () => {
    await open('/settings');
    expect(railLabels()).toEqual(['Users', 'Teams', 'Access', 'Account settings', 'Security', 'Calls', 'Notifications', 'Import']);
    expect(q('main h2')!.textContent).toBe('Account settings');
  });

  it('leaves out the people and access pages for everyone else, and says so on the page if they type its address', async () => {
    api.myAccess.mockResolvedValue(ok({ role: 'member', canManageAccess: false }));
    await open('/settings/users');
    expect(railLabels()).toEqual(['Account settings', 'Security', 'Calls', 'Notifications']);
    expect(q('main')!.textContent).toContain('You do not have access to manage people and teams here.');
    expect(api.listMembers).not.toHaveBeenCalled();
  });

  it('shows the Calls page and the Security page inside Settings', async () => {
    await open('/settings/calls');
    expect(q('main')!.textContent).toContain('Calls page');
    await click(byText('nav a', 'Security'));
    await settle(10);
    expect(q('main')!.textContent).toContain('Two-step sign-in is not set up on this server.');
  });

  it('shows who is signed in and where on the Account settings page', async () => {
    appStorage.set('lira_user_name', 'Test Admin'); appStorage.set('lira_user_email', 'test@x.co');
    setOrganisations([{ orgId: 'org-1', orgName: 'Acme', role: 'owner' }]);
    await open('/settings/account');
    expect(q('main dl')!.textContent).toContain('Test Admin');
    expect(q('main dl')!.textContent).toContain('Acme');
    expect(q('main dl')!.textContent).toContain('owner');
  });
});

describe('a person\'s page', () => {
  const openAsha = async () => { await open('/settings/users'); await click(byText('button', 'Asha')); await settle(40); };

  it('opens from the list and shows the role, the teams and what they can reach, with the team it comes through', async () => {
    await openAsha();
    expect(q('main h2')!.textContent).toBe('Asha');
    expect(q('main dl')!.textContent).toContain('Member');
    expect(q('main dl')!.textContent).toContain('QA');
    const rows = qa('section[aria-label="Access"] tbody tr').map(r => r.textContent);
    expect(rows[0]).toContain('Lira (LIRA)'); expect(rows[0]).toContain('Directly');
    expect(rows[1]).toContain('Alpha'); expect(rows[1]).toContain('Team QA');
  });

  it('changes the level of a direct grant, takes one away, and leaves a grant that comes through a team to the team\'s page', async () => {
    await openAsha();
    await pick(q<HTMLSelectElement>('select[aria-label="Level for Lira (LIRA)"]')!, 'manage');
    expect(api.setGrant).toHaveBeenCalledWith('org-1', { subjectType: 'user', subjectId: 'u1', kind: 'space', objectId: '4', level: 'manage' });
    const rows = qa('section[aria-label="Access"] tbody tr');
    expect(byText('button', 'Remove', rows[1])).toBeUndefined();
    expect(q('select[aria-label="Level for Alpha"]')).toBeNull();
    await click(byText('button', 'Remove', rows[0])!);
    expect(api.revokeGrant).toHaveBeenCalledWith('org-1', 'g1');
  });

  it('gives more access by kind, thing and level', async () => {
    await openAsha();
    const form = q('form[aria-label="Give access"]')!;
    await pick(q<HTMLSelectElement>('select[aria-label="Kind"]', form)!, 'project');
    await pick(q<HTMLSelectElement>('select[aria-label="Level"]', form)!, 'edit');
    await click(byText('button', 'Give access', form)!);
    expect(api.setGrant).toHaveBeenCalledWith('org-1', { subjectType: 'user', subjectId: 'u1', kind: 'project', objectId: 'p1', level: 'edit' });
  });

  it('shows the server\'s refusal when access cannot be given', async () => {
    api.setGrant.mockResolvedValue({ ok: false, status: 403, message: 'Only the owner can do that.' });
    await openAsha();
    await click(byText('button', 'Give access')!);
    expect(q('[role="alert"]')!.textContent).toContain('Only the owner can do that.');
  });

  it('lists nothing for the Owner, who reaches everything, and says why', async () => {
    await open('/settings/users');
    await click(byText('button', 'Olive Owner'));
    await settle(10);
    expect(q('main')!.textContent).toContain('can always reach and do everything');
    expect(q('section[aria-label="Access"]')).toBeNull();
  });

  it('says so when the person is not in the organisation', async () => {
    await open('/settings/users/not-here');
    expect(q('main')!.textContent).toContain('That person is not in this organisation.');
  });
});

describe('a team\'s page', () => {
  it('shows who is in the team and what the team can reach, and changes it', async () => {
    await open('/settings/teams');
    await click(byText('button', 'QA'));
    await settle(40);
    expect(q('main h2')!.textContent).toBe('QA');
    expect(qa('ul[aria-label="Members"] li').map(li => li.textContent)).toEqual([expect.stringContaining('Asha')]);
    const rows = qa('section[aria-label="Access"] tbody tr');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Alpha');
    await click(byText('button', 'Remove', rows[0])!);
    expect(api.revokeGrant).toHaveBeenCalledWith('org-1', 'g2');
  });

  it('says so when the team does not exist', async () => {
    await open('/settings/teams/gone');
    expect(q('main')!.textContent).toContain('That team does not exist.');
  });
});
