import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { db } from '../../db/db';
import { makeIssue, makeSpace } from '../../test/factories';
import { byText, choose, cleanup, click, mount, q, settle, typeInto } from '../../test/render';
import { setActiveOrg } from '../../utils/hostedOrg';
import { StoryBoxesPage } from './StoryBoxesPage';

const dialog = vi.hoisted(() => ({ confirmDialog: vi.fn(async () => true) }));
vi.mock('../common/dialogStore', () => dialog);
const hosted = vi.hoisted(() => ({ on: false }));
vi.mock('../../utils/edition', async importOriginal => ({ ...(await importOriginal<typeof import('../../utils/edition')>()), isHosted: () => hosted.on }));
const votesApi = vi.hoisted(() => ({ getRoom: vi.fn(), roundAction: vi.fn(), confirmRound: vi.fn(), putVote: vi.fn() }));
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
  Object.values(votesApi).forEach(f => f.mockReset()); dialog.confirmDialog.mockReset(); dialog.confirmDialog.mockResolvedValue(true);
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
    expect(q('section[aria-label="Open boxes"]')!.textContent).toContain('Alpha planning');
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

describe('closing and history', () => {
  it('closes a box: it moves to the history, points can no longer be given, and it can be reopened', async () => {
    seed();
    page('/storyboxes/b1');
    await click(byText('button', 'Close the box'));
    expect(saved()[0].status).toBe('closed');
    expect(q('section[aria-label="History"]')!.textContent).toContain('Alpha estimate');
    expect(q('section[aria-label="Open boxes"]')!.textContent).toContain('None open');
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
