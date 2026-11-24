import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { db } from '../../db/db';
import { makeIssue, makeSpace } from '../../test/factories';
import { byText, choose, cleanup, click, mount, q, qa, settle, typeInto } from '../../test/render';
import { setActiveOrg } from '../../utils/hostedOrg';
import { StoryBoxesPage } from './StoryBoxesPage';

const dialog = vi.hoisted(() => ({ confirmDialog: vi.fn(async () => true), alertDialog: vi.fn(async () => undefined) }));
const access = vi.hoisted(() => ({ listTeams: vi.fn(), listMembers: vi.fn() }));
vi.mock('../../services/accessApi', () => access);
const invites = vi.hoisted(() => ({ inviteToBox: vi.fn(async () => ({ failed: 0, reason: '' })) }));
vi.mock('../../services/storyInvites', () => invites);
vi.mock('../common/dialogStore', () => dialog);
const hosted = vi.hoisted(() => ({ on: false }));
vi.mock('../../utils/edition', async importOriginal => ({ ...(await importOriginal<typeof import('../../utils/edition')>()), isHosted: () => hosted.on }));
const votesApi = vi.hoisted(() => ({ getRoom: vi.fn(), roundAction: vi.fn(), confirmRound: vi.fn(), putVote: vi.fn(), getSummary: vi.fn() }));
vi.mock('../../services/storyVotesApi', () => votesApi);

const KEY = 'lira_storyboxes';
const spaces = [makeSpace({ id: 1, key: 'AAA', name: 'Alpha' }), makeSpace({ id: 2, key: 'BBB', name: 'Beta' })];
const issues = [
  makeIssue({ id: 10, spaceId: 1, key: 'AAA-1', title: 'First', sprint: '2026-11' }), makeIssue({ id: 11, spaceId: 1, key: 'AAA-2', title: 'Second', storyPoints: 3 }),
  makeIssue({ id: 20, spaceId: 2, key: 'BBB-1', title: 'Other space', sprint: '2026-11' }), makeIssue({ id: 21, spaceId: 1, key: 'AAA-3', title: 'Epic', type: 'epic' }),
];
const saved = () => JSON.parse(localStorage.getItem(KEY) ?? '[]') as { id: string; name: string; status: string; scope: object; localVotes?: Record<string, number> }[];
function Where() { return <p id="where">{useLocation().pathname}</p>; }
const page = (at = '/storyboxes') => mount(
  <MemoryRouter initialEntries={[at]}><Routes><Route path="/storyboxes" element={<StoryBoxesPage issues={issues} spaces={spaces} />} /><Route path="/storyboxes/:boxId" element={<StoryBoxesPage issues={issues} spaces={spaces} />} /></Routes><Where /></MemoryRouter>);
const seed = (over: object = {}) => localStorage.setItem(KEY, JSON.stringify([{ id: 'b1', name: 'Alpha estimate', scope: { type: 'space', spaceId: 1 }, status: 'open', scale: [0, 1, 2, 3, 5, 8], createdAt: '2026-11-20T00:00:00Z', createdBy: 'Asha', ...over }]));

beforeEach(async () => {
  localStorage.clear(); hosted.on = false; setActiveOrg(null);
  Object.values(votesApi).forEach(f => f.mockReset()); votesApi.getSummary.mockResolvedValue({ ok: true, data: [] }); access.listTeams.mockResolvedValue({ ok: true, data: [] }); access.listMembers.mockResolvedValue({ ok: true, data: [] }); dialog.confirmDialog.mockReset(); dialog.confirmDialog.mockResolvedValue(true);
  await db.issues.clear(); await db.issues.bulkPut(issues);
});
afterEach(cleanup);

describe('making story boxes', () => {
  it('makes a box for a space, opens it, and lists it as open', async () => {
    page();
    await click(byText('button', 'New story box'));
    await typeInto(q<HTMLInputElement>('form[aria-label="New story box"] input'), 'Alpha planning');
    expect(byText<HTMLButtonElement>('button', 'Make the box')!.disabled).toBe(true); // the time to vote is asked every time, with no default
    await choose(q<HTMLSelectElement>('select:has(option[value="10"])'), '4');
    await click(byText('button', 'Make the box'));
    await settle(30);
    expect(saved()).toMatchObject([{ name: 'Alpha planning', status: 'open', votingMinutes: 4, scope: { type: 'space', spaceId: 1 } }]);
    expect(q('#where')!.textContent).toBe(`/storyboxes/${saved()[0].id}`);
    expect(q('section[aria-label="Alpha planning"]')).not.toBeNull(); // the planning room of the new box
  });

  it('makes a box for a sprint across every space', async () => {
    page();
    await click(byText('button', 'New story box'));
    await click(q('input[name="by"][type="radio"]:not(:checked)'));
    await choose(q<HTMLSelectElement>('select:has(option[value="10"])'), '10');
    await click(byText('button', 'Make the box'));
    await settle(30);
    expect(saved()[0].scope).toEqual({ type: 'sprint', sprintKey: '2026-11' });
    expect(q('section[aria-label="Alpha estimate"], section[aria-label="Sprint 2026-11, all spaces"]')).not.toBeNull();
  });

  it('offers no way to make a box to someone who is only in the organisation by invitation', () => {
    hosted.on = true; setActiveOrg('o', 'member'); votesApi.getRoom.mockResolvedValue({ ok: true, data: { now: new Date().toISOString(), rounds: [], votes: [], people: [], activeTicketId: null } });
    seed();
    page('/storyboxes/b1');
    expect(byText('button', 'New story box')).toBeUndefined();
    expect(byText('button', 'Close the box')).toBeUndefined();
    expect(byText('button', 'Delete')).toBeUndefined();
  });
});

describe('inviting teams and people while making a box', () => {
  const team = { id: 't1', name: 'Platform', memberIds: [] };
  const members = [
    { userId: 'u0', name: 'Owner Person', email: 'o@x.io', role: 'owner', manageAccess: true, teamIds: [] },
    { userId: 'u1', name: 'Maya Rao', email: 'm@x.io', role: 'member', manageAccess: false, teamIds: [] },
    { userId: 'u2', name: 'Ben Li', email: 'b@x.io', role: 'viewer', manageAccess: false, teamIds: [] },
  ];
  const fill = async () => {
    await click(byText('button', 'New story box'));
    await settle(30);
    await choose(q<HTMLSelectElement>('#sb-minutes'), '4');
  };
  beforeEach(() => {
    hosted.on = true; setActiveOrg('org-1', 'owner');
    votesApi.getSummary.mockResolvedValue({ ok: true, data: [] });
    votesApi.getRoom.mockResolvedValue({ ok: true, data: { now: new Date().toISOString(), rounds: [], votes: [], people: [], activeTicketId: null } }); // the new box opens its room
    access.listTeams.mockResolvedValue({ ok: true, data: [team] }); access.listMembers.mockResolvedValue({ ok: true, data: members });
    invites.inviteToBox.mockClear(); dialog.alertDialog.mockClear();
  });

  it('offers the teams and the people who are not Owners or Admins, who always take part', async () => {
    page();
    await fill();
    const who = q('fieldset[aria-label="Who takes part"]')!;
    expect(who.textContent).toContain('Owners and Admins always take part');
    expect(q('[aria-label="Teams"]')!.textContent).toBe('Team Platform');
    expect(q('[aria-label="People"]')!.textContent).toBe('Maya RaoBen Li');
  });

  it('invites the chosen teams and people into the new box in this organisation, and opens the box', async () => {
    page();
    await fill();
    await click(byText('label', 'Team Platform'));
    await click(byText('label', 'Maya Rao'));
    await click(byText('button', 'Make the box'));
    await settle(30);
    const id = saved()[0].id;
    expect(invites.inviteToBox).toHaveBeenCalledWith('org-1', id, { teams: ['t1'], users: ['u1'] });
    expect(q('#where')!.textContent).toBe(`/storyboxes/${id}`);
    expect(dialog.alertDialog).not.toHaveBeenCalled();
  });

  it('can take a choice back, and invites nobody when none is made', async () => {
    page();
    await fill();
    await click(byText('label', 'Ben Li')); await click(byText('label', 'Ben Li'));
    await click(byText('button', 'Make the box'));
    await settle(30);
    expect(invites.inviteToBox).not.toHaveBeenCalled();
  });

  it('says so when some could not be invited, and still makes the box', async () => {
    invites.inviteToBox.mockResolvedValueOnce({ failed: 1, reason: 'You do not have access to this.' });
    page();
    await fill();
    await click(byText('label', 'Ben Li'));
    await click(byText('button', 'Make the box'));
    await settle(30);
    expect(saved()).toHaveLength(1);
    expect(dialog.alertDialog).toHaveBeenCalledWith(expect.objectContaining({ title: 'Not everyone could be invited', message: expect.stringContaining('You do not have access to this.') }));
  });

  it('says there is nobody to invite yet when the organisation has no teams or other people', async () => {
    access.listTeams.mockResolvedValue({ ok: true, data: [] }); access.listMembers.mockResolvedValue({ ok: true, data: [members[0]] });
    page();
    await fill();
    expect(q('fieldset[aria-label="Who takes part"]')!.textContent).toContain('no teams or other people');
  });

  it('is not shown in the local edition, which has one person', async () => {
    hosted.on = false; setActiveOrg(null);
    page();
    await click(byText('button', 'New story box'));
    expect(q('fieldset[aria-label="Who takes part"]')).toBeNull();
    expect(access.listTeams).not.toHaveBeenCalled();
  });
});

describe('the overview', () => {
  const done = { 10: { endsAt: 'x', revealed: true, finalPoints: 5 }, 11: { endsAt: 'x', revealed: true, finalPoints: 3 } };

  it('says there is nothing yet, and offers to make a box to the people who run the workspace only', () => {
    page();
    expect(q('section[aria-label="Current story boxes"]')!.textContent).toContain('Make a story box to start');
    expect(byText('button', 'New story box')).toBeDefined();
    expect(q('section[aria-label="All story boxes"]')).toBeNull();
    cleanup();
    hosted.on = true; setActiveOrg('o', 'member'); votesApi.getSummary.mockResolvedValue({ ok: true, data: [] });
    page();
    expect(byText('button', 'New story box')).toBeUndefined();
    expect(q('section[aria-label="Current story boxes"]')!.textContent).toContain('Nobody has made a story box');
  });

  it('shows the headline numbers, the current box with its progress, and every box in a table with the older ones', async () => {
    localStorage.setItem(KEY, JSON.stringify([
      { id: 'open1', name: 'Alpha estimate', scope: { type: 'space', spaceId: 1 }, status: 'open', scale: [1, 2, 3], createdAt: '2026-11-20T00:00:00Z', createdBy: 'Asha', votingMinutes: 4, localRounds: done },
      { id: 'old1', name: 'October planning', scope: { type: 'space', spaceId: 2 }, status: 'closed', scale: [1, 2, 3], createdAt: '2026-10-05T00:00:00Z', closedAt: '2026-10-09T00:00:00Z', createdBy: 'Asha', localRounds: { 20: { endsAt: 'x', revealed: true, finalPoints: 8 } } },
    ]));
    page();
    await settle(1200); // the numbers count up
    const text = document.body.textContent!;
    expect(text).toContain('Open boxes');
    expect(text).toContain('Points boxed');
    const current = q('section[aria-label="Current story boxes"]')!.textContent!;
    expect(current).toContain('Alpha estimate');
    expect(current).toContain('2 of 2 tickets sized'); // the two non-epic tickets of the space
    expect(current).toContain('8 points boxed');
    expect(current).toContain('4 min to vote');
    expect(current).not.toContain('October planning'); // it is closed
    const table = qa('section[aria-label="All story boxes"] tbody tr');
    expect(table.map(r => r.textContent)).toEqual([expect.stringContaining('Alpha estimate'), expect.stringContaining('October planning')]); // newest first
    expect(table[1].textContent).toContain('Closed');
    expect(table[1].textContent).toContain('1/1'); // BBB-1 is the one ticket of that space
    expect(q('section[aria-label="Points boxed per story box"]')!.textContent).toContain('8 pts');
  });

  it('opens a box from its card and from its row in the table', async () => {
    seed();
    page();
    await click(q('section[aria-label="Current story boxes"] button'));
    expect(q('#where')!.textContent).toBe('/storyboxes/b1');
    cleanup();
    seed();
    page();
    await click(q('section[aria-label="All story boxes"] tbody tr'));
    expect(q('#where')!.textContent).toBe('/storyboxes/b1');
  });
});

describe('closing and history', () => {
  it('closes a box: it moves to the history, points can no longer be given, and it can be reopened', async () => {
    seed();
    page('/storyboxes/b1');
    await click(byText('button', 'Close the box'));
    expect(saved()[0].status).toBe('closed');
    await click(byText('button', 'All story boxes'));
    expect(q('section[aria-label="All story boxes"]')!.textContent).toContain('Alpha estimate');
    expect(q('section[aria-label="All story boxes"]')!.textContent).toContain('Closed');
    expect(q('section[aria-label="Current story boxes"]')!.textContent).toContain('No story box is open');
    await click(byText('button', 'Alpha estimate'));
    expect(q('section[aria-label="Voting stage"]')).toBeNull(); // nothing can be put up for voting
    expect(document.body.textContent).toContain('This box is closed');
    await click(byText('button', 'Reopen'));
    expect(saved()[0].status).toBe('open');
    expect(q('section[aria-label="Voting stage"]')).not.toBeNull();
  });

  it('deletes a box only after asking, and goes back to the list', async () => {
    seed();
    page('/storyboxes/b1');
    dialog.confirmDialog.mockResolvedValueOnce(false);
    await click(byText('button', 'Delete'));
    expect(saved()).toHaveLength(1);
    await click(byText('button', 'Delete'));
    await settle(30);
    expect(saved()).toHaveLength(0);
    expect(q('#where')!.textContent).toBe('/storyboxes');
  });
});
