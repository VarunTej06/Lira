import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { byText, cleanup, click, mount, q, qa, settle } from '../../test/render';
import { setActiveOrg } from '../../utils/hostedOrg';
import { TeamsPage } from './TeamsPage';

const api = vi.hoisted(() => ({
  myAccess: vi.fn(), listMembers: vi.fn(), listTeams: vi.fn(), listInvitations: vi.fn(), invite: vi.fn(), updateMember: vi.fn(), removeMember: vi.fn(),
  revokeInvitation: vi.fn(), createTeam: vi.fn(), deleteTeam: vi.fn(), setTeamMembers: vi.fn(), listGrants: vi.fn(), setGrant: vi.fn(), revokeGrant: vi.fn(),
}));
vi.mock('../../services/accessApi', async importOriginal => ({ ...(await importOriginal<typeof import('../../services/accessApi')>()), ...api }));
const work = vi.hoisted(() => ({ listSpaces: vi.fn(), listObjects: vi.fn() }));
vi.mock('../../services/workspaceApi', () => work);
const dialog = vi.hoisted(() => ({ confirmDialog: vi.fn(async () => true) }));
vi.mock('../common/dialogStore', () => dialog);

const ok = <T,>(data: T) => ({ ok: true as const, data });
const refused = (message: string, fields?: Record<string, string>) => ({ ok: false as const, status: 400, message, fields });
const owner = { userId: 'u0', name: 'Olive Owner', email: 'o@x.co', role: 'owner', manageAccess: true, teamIds: [] as string[] };
const asha = { userId: 'u1', name: 'Asha', email: 'asha@x.co', role: 'member', manageAccess: true, teamIds: [] as string[] };
const adm = { userId: 'u2', name: 'Adam Admin', email: 'adam@x.co', role: 'admin', manageAccess: true, teamIds: [] as string[] };
const qa1 = { id: 't1', name: 'QA', memberIds: ['u1'] };

beforeEach(() => {
  Object.values({ ...api, ...work, ...dialog }).forEach(f => f.mockClear());
  setActiveOrg('org-1');
  api.myAccess.mockResolvedValue(ok({ role: 'owner', canManageAccess: true }));
  api.listMembers.mockResolvedValue(ok([owner, asha, adm]));
  api.listTeams.mockResolvedValue(ok([qa1]));
  api.listInvitations.mockResolvedValue(ok([]));
  for (const f of [api.updateMember, api.removeMember, api.revokeInvitation, api.deleteTeam, api.setTeamMembers, api.revokeGrant]) f.mockResolvedValue(ok(undefined));
  work.listSpaces.mockResolvedValue(ok([{ id: 4, key: 'LIRA', name: 'Lira' }]));
  work.listObjects.mockResolvedValue(ok([{ id: 'p1', doc: { id: 'p1', name: 'Alpha' }, version: 1 }]));
  api.listGrants.mockResolvedValue(ok([]));
});
afterEach(() => { cleanup(); setActiveOrg(null); });

const open = async () => { mount(<TeamsPage />); await settle(40); };
const type = async (el: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const pick = async (el: HTMLSelectElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

describe('Teams and access page', () => {
  it('shows a loading state, then the people with their roles', async () => {
    api.myAccess.mockReturnValue(new Promise(() => undefined));
    mount(<TeamsPage />);
    expect(q('[aria-label="Loading people and teams"]')).not.toBeNull();
    cleanup();
    api.myAccess.mockResolvedValue(ok({ role: 'owner', canManageAccess: true }));
    await open();
    expect(qa('[aria-label="People"] li').map(li => li.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Olive Owner'), expect.stringContaining('Asha')]));
    expect(q('[aria-label="People"]')!.textContent).toContain('People (3)');
  });

  it('says so, and shows nothing else, to someone who may not manage access', async () => {
    api.myAccess.mockResolvedValue(ok({ role: 'member', canManageAccess: false }));
    await open();
    expect(q('[role="alert"]')!.textContent).toContain('do not have access');
    expect(api.listMembers).not.toHaveBeenCalled();
    expect(q('[role="tablist"]')).toBeNull();
  });

  it('shows an error with a way to try again when the server does not answer', async () => {
    api.myAccess.mockResolvedValueOnce({ ok: false, status: 0, message: 'Could not reach the server.' });
    await open();
    expect(q('[role="alert"]')!.textContent).toContain('Could not reach the server.');
    await click(byText('button', 'Try again'));
    await settle(40);
    expect(q('[role="tablist"]')).not.toBeNull();
  });

  it('lets the owner change a role and an Admin\'s access to manage people, and nobody else', async () => {
    await open();
    await pick(q<HTMLSelectElement>('select[aria-label="Role of Asha"]')!, 'viewer');
    expect(api.updateMember).toHaveBeenCalledWith('org-1', 'u1', { role: 'viewer' });
    await click(q('input[type="checkbox"]')!);
    expect(api.updateMember).toHaveBeenCalledWith('org-1', 'u2', { manageAccess: false });
    expect(q('select[aria-label="Role of Olive Owner"]')).toBeNull(); // the owner's role is not a choice
    cleanup();
    api.myAccess.mockResolvedValue(ok({ role: 'admin', canManageAccess: true }));
    await open();
    expect(q('select[aria-label="Role of Asha"]')).toBeNull();
    expect(q('input[type="checkbox"]')).toBeNull();
  });

  it('asks before removing someone, and does not remove them when the owner says no', async () => {
    await open();
    dialog.confirmDialog.mockResolvedValueOnce(false);
    await click(qa('[aria-label="People"] li')[1].querySelector('button')!);
    expect(api.removeMember).not.toHaveBeenCalled();
    await click(qa('[aria-label="People"] li')[1].querySelector('button')!);
    expect(api.removeMember).toHaveBeenCalledWith('org-1', 'u1');
  });

  it('invites by email, and when email is not connected shows the link to copy, once', async () => {
    api.invite.mockResolvedValue(ok({ id: 'i1', email: 'new@x.co', role: 'viewer', teamId: 't1', expiresAt: '2026-11-27T00:00:00Z', token: 'T'.repeat(43), emailed: false }));
    await open();
    await type(q<HTMLInputElement>('form[aria-label="Invite someone"] input[type="email"]')!, 'new@x.co');
    const [role, , team] = qa<HTMLSelectElement>('form[aria-label="Invite someone"] select'); // role, space, team
    await pick(role, 'viewer'); await pick(team, 't1');
    await click(byText('button', 'Invite'));
    await settle(30);
    expect(api.invite).toHaveBeenCalledWith('org-1', { email: 'new@x.co', role: 'viewer', teamId: 't1' });
    expect(q('[role="status"]')!.textContent).toContain('Email is not connected yet');
    expect(q<HTMLInputElement>('input[aria-label="Invitation link"]')!.value).toBe(`${window.location.origin}/invite?token=${'T'.repeat(43)}`);
  });

  it('invites to one space with an access level, leaves Admin out of the roles for it, and lists the pending invitation with the space', async () => {
    api.invite.mockResolvedValue(ok({ id: 'i1', email: 'new@x.co', role: 'guest', teamId: null, spaceId: 4, level: 'edit', expiresAt: '', token: 'T'.repeat(43), emailed: true }));
    api.listInvitations.mockResolvedValue(ok([{ id: 'i1', email: 'new@x.co', role: 'guest', teamId: null, spaceId: 4, level: 'edit', expiresAt: '' }]));
    await open();
    const form = 'form[aria-label="Invite someone"]';
    expect([...qa<HTMLOptionElement>(`${form} select option`)].some(o => o.value === 'admin')).toBe(true);
    await type(q<HTMLInputElement>(`${form} input[type="email"]`)!, 'new@x.co');
    const [role, space] = qa<HTMLSelectElement>(`${form} select`);
    await pick(space, '4');
    expect([...role.options].map(o => o.value)).not.toContain('admin');
    await pick(role, 'guest');
    expect(q(form)!.textContent).toContain('Access to the space');
    const switches = qa<HTMLInputElement>(`${form} fieldset input[type="checkbox"]`);
    expect(switches).toHaveLength(4); // projects, roadmaps, dashboards, sprints: all on to begin with
    expect(switches.every(c => c.checked)).toBe(true);
    await act(async () => { switches[0].click(); switches[3].click(); });
    await click(byText('button', 'Invite'));
    await settle(30);
    expect(api.invite).toHaveBeenCalledWith('org-1', { email: 'new@x.co', role: 'guest', spaceId: 4, level: 'edit', shares: { projects: false, roadmaps: true, dashboards: true, sprints: false } });
    expect(q('section[aria-label="Pending invitations"]')!.textContent).toContain('Lira (edit)');
  });

  it('says the email was sent when it was, with no link shown', async () => {
    api.invite.mockResolvedValue(ok({ id: 'i1', email: 'new@x.co', role: 'member', teamId: null, expiresAt: '', token: 'T'.repeat(43), emailed: true }));
    await open();
    await type(q<HTMLInputElement>('form[aria-label="Invite someone"] input[type="email"]')!, 'new@x.co');
    await click(byText('button', 'Invite'));
    await settle(30);
    expect(q('[role="status"]')!.textContent).toContain('was sent to');
    expect(q('input[aria-label="Invitation link"]')).toBeNull();
  });

  it('shows why an invitation was refused, and lists and cancels waiting ones', async () => {
    api.invite.mockResolvedValue(refused('This person is already in the organisation.'));
    api.listInvitations.mockResolvedValue(ok([{ id: 'i9', email: 'wait@x.co', role: 'guest', teamId: null, expiresAt: '' }]));
    await open();
    await type(q<HTMLInputElement>('form[aria-label="Invite someone"] input[type="email"]')!, 'asha@x.co');
    await click(byText('button', 'Invite'));
    await settle(30);
    expect(q('[role="alert"]')!.textContent).toContain('already in the organisation');
    expect(q('[aria-label="Pending invitations"]')!.textContent).toContain('wait@x.co');
    await click(byText('button', 'Cancel invitation'));
    expect(api.revokeInvitation).toHaveBeenCalledWith('org-1', 'i9');
  });

  it('makes teams, saves who is in one, and deletes one after asking', async () => {
    api.createTeam.mockResolvedValue(ok({ id: 't2', name: 'Design', memberIds: [] }));
    await open();
    await click(byText('[role="tab"]', 'Teams'));
    expect(q('section[aria-label="QA"]')!.textContent).toContain('1 person');
    await type(q<HTMLInputElement>('form[aria-label="Create a team"] input')!, 'Design');
    await click(byText('button', 'Create team'));
    expect(api.createTeam).toHaveBeenCalledWith('org-1', 'Design');
    const save = byText('button', 'Save people') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await click(q('section[aria-label="QA"] input[type="checkbox"]:not(:checked)')!);
    await click(byText('button', 'Save people'));
    expect(api.setTeamMembers).toHaveBeenCalledWith('org-1', 't1', expect.arrayContaining(['u1', 'u0']));
    await click(byText('button', 'Delete team'));
    expect(dialog.confirmDialog).toHaveBeenCalled();
    expect(api.deleteTeam).toHaveBeenCalledWith('org-1', 't1');
  });

  it('shows why a team name was refused', async () => {
    api.createTeam.mockResolvedValue(refused('A team with this name already exists.'));
    await open();
    await click(byText('[role="tab"]', 'Teams'));
    await type(q<HTMLInputElement>('form[aria-label="Create a team"] input')!, 'QA');
    await click(byText('button', 'Create team'));
    expect(q('[role="alert"]')!.textContent).toContain('already exists');
  });

  it('gives and takes away access to one object, by person or team, naming who has it', async () => {
    api.listGrants.mockResolvedValue(ok([{ id: 'g1', subjectType: 'team', subjectId: 't1', kind: 'space', objectId: '4', level: 'edit' }]));
    api.setGrant.mockResolvedValue(ok({}));
    await open();
    await click(byText('[role="tab"]', 'Access'));
    await settle(40);
    expect(api.listGrants).toHaveBeenCalledWith('org-1', 'space', '4');
    expect(q('[aria-label="Who has access"]')!.textContent).toContain('Team: QA');
    const subject = q<HTMLSelectElement>('form[aria-label="Give access"] select')!;
    expect([...subject.options].map(o => o.textContent)).not.toContain('Olive Owner'); // Owner and Admins always have everything
    expect([...subject.options].map(o => o.textContent)).not.toContain('Adam Admin');
    await pick(subject, 'user:u1');
    await pick(qa<HTMLSelectElement>('form[aria-label="Give access"] select')[1], 'manage');
    await click(byText('button', 'Give access'));
    expect(api.setGrant).toHaveBeenCalledWith('org-1', { subjectType: 'user', subjectId: 'u1', kind: 'space', objectId: '4', level: 'manage' });
    await pick(q<HTMLSelectElement>('select[aria-label="Level of Team: QA"]')!, 'view');
    expect(api.setGrant).toHaveBeenCalledWith('org-1', expect.objectContaining({ subjectId: 't1', level: 'view' }));
    await click(byText('button', 'Remove access'));
    expect(api.revokeGrant).toHaveBeenCalledWith('org-1', 'g1');
  });

  it('lists projects, roadmaps and dashboards by name when another kind is chosen', async () => {
    await open();
    await click(byText('[role="tab"]', 'Access'));
    await settle(40);
    await pick(q<HTMLSelectElement>('select[aria-label="Kind"]')!, 'project');
    await settle(40);
    expect(work.listObjects).toHaveBeenCalledWith('org-1', 'project');
    expect([...q<HTMLSelectElement>('select[aria-label="Object"]')!.options].map(o => o.textContent)).toEqual(['Alpha']);
    expect(api.listGrants).toHaveBeenLastCalledWith('org-1', 'project', 'p1');
  });

  it('says there is nothing to give access to when there is none', async () => {
    work.listSpaces.mockResolvedValue(ok([]));
    await open();
    await click(byText('[role="tab"]', 'Access'));
    await settle(40);
    expect(q('[role="tabpanel"]')!.textContent).toContain('There is nothing of this kind yet.');
    expect(q('form[aria-label="Give access"]')).toBeNull();
  });
});
