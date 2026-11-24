import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { act } from 'react';
import { db } from '../../db/db';
import { makeIssue, makeSpace } from '../../test/factories';
import { byText, cleanup, click, mount, q, qa, settle, typeInto } from '../../test/render';
import { setActiveOrg } from '../../utils/hostedOrg';
import { StoryBoxesPage } from './StoryBoxesPage';

const dialog = vi.hoisted(() => ({ confirmDialog: vi.fn(async () => true) }));
vi.mock('../common/dialogStore', () => dialog);
const hosted = vi.hoisted(() => ({ on: false }));
vi.mock('../../utils/edition', async importOriginal => ({ ...(await importOriginal<typeof import('../../utils/edition')>()), isHosted: () => hosted.on }));
const votesApi = vi.hoisted(() => ({ listVotes: vi.fn(), putVote: vi.fn() }));
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
const mineFor = (key: string) => qa<HTMLButtonElement>(`[aria-label="Your points for ${key}"] button`);

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
    await click(byText('button', 'Make the box'));
    await settle(30);
    expect(saved()).toMatchObject([{ name: 'Alpha planning', status: 'open', scope: { type: 'space', spaceId: 1 } }]);
    expect(q('#where')!.textContent).toBe(`/storyboxes/${saved()[0].id}`);
    expect(q('section[aria-label="Open boxes"]')!.textContent).toContain('Alpha planning');
  });

  it('makes a box for a sprint across every space', async () => {
    page();
    await click(byText('button', 'New story box'));
    await click(q('input[name="by"][type="radio"]:not(:checked)'));
    await click(byText('button', 'Make the box'));
    await settle(30);
    expect(saved()[0].scope).toEqual({ type: 'sprint', sprintKey: '2026-11' });
    expect(q('section[aria-label="Alpha estimate"], section[aria-label="Sprint 2026-11, all spaces"]')).not.toBeNull();
  });

  it('offers no way to make a box to someone who is only in the organisation by invitation', () => {
    hosted.on = true; setActiveOrg('o', 'member'); votesApi.listVotes.mockResolvedValue({ ok: true, data: [] });
    seed();
    page('/storyboxes/b1');
    expect(byText('button', 'New story box')).toBeUndefined();
    expect(byText('button', 'Close the box')).toBeUndefined();
    expect(byText('button', 'Delete')).toBeUndefined();
    expect(q('select[aria-label="Points of AAA-1"]')).toBeNull(); // points are shown, not changed
  });
});

describe('the board', () => {
  it('lists the tickets of the space, without epics, with their points', async () => {
    seed();
    page('/storyboxes/b1');
    await settle(30);
    const rows = qa('tbody tr');
    expect(rows.map(r => r.textContent)).toEqual([expect.stringContaining('AAA-1'), expect.stringContaining('AAA-2')]);
    expect(q<HTMLSelectElement>('select[aria-label="Points of AAA-2"]')!.value).toBe('3');
  });

  it('keeps your own points in the box (local edition), shows them as votes by You, and takes them back on a second press', async () => {
    seed();
    page('/storyboxes/b1');
    await click(mineFor('AAA-1').find(b => b.textContent === '5'));
    expect(saved()[0].localVotes).toEqual({ '10': 5 });
    expect(mineFor('AAA-1').find(b => b.textContent === '5')!.getAttribute('aria-pressed')).toBe('true');
    expect(qa('tbody tr')[0].textContent).toContain('1 votes, average 5');
    expect(qa('tbody tr')[0].textContent).toContain('You 5');
    await click(mineFor('AAA-1').find(b => b.textContent === '5'));
    expect(saved()[0].localVotes).toEqual({});
  });

  it('puts the suggested points on one ticket, and on every ticket without points, after asking', async () => {
    seed({ localVotes: { '10': 5 } });
    page('/storyboxes/b1');
    await click(q('button[aria-label="Use 5 for AAA-1"]'));
    await settle(30);
    expect((await db.issues.get(10))!.storyPoints).toBe(5);
    await db.issues.update(10, { storyPoints: undefined });
    await click(byText('button', 'Apply suggested points'));
    await settle(30);
    expect((await db.issues.get(10))!.storyPoints).toBe(5);
    expect((await db.issues.get(11))!.storyPoints).toBe(3); // already had points: left alone
  });

  it('sets the final points of a ticket by hand, and clears them', async () => {
    seed();
    page('/storyboxes/b1');
    await act(async () => {
      const sel = q<HTMLSelectElement>('select[aria-label="Points of AAA-1"]')!;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(sel, '8');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle(30);
    expect((await db.issues.get(10))!.storyPoints).toBe(8);
  });

  it('filters by search and by "without points only", and by space in a sprint box', async () => {
    seed();
    page('/storyboxes/b1');
    await typeInto(q<HTMLInputElement>('input[aria-label="Search tickets"]'), 'second');
    expect(qa('tbody tr')).toHaveLength(1);
    cleanup();
    seed();
    page('/storyboxes/b1');
    await click(q('input[type="checkbox"]'));
    expect(qa('tbody tr').map(r => r.textContent)).toEqual([expect.stringContaining('AAA-1')]);
    cleanup();
    seed({ scope: { type: 'sprint', sprintKey: '2026-11' } });
    page('/storyboxes/b1');
    expect(qa('tbody tr')).toHaveLength(2);
    await act(async () => {
      const sel = q<HTMLSelectElement>('select[aria-label="Space"]')!;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(sel, '2');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(qa('tbody tr').map(r => r.textContent)).toEqual([expect.stringContaining('BBB-1')]);
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
    expect(mineFor('AAA-1').every(b => b.disabled)).toBe(true);
    expect(document.body.textContent).toContain('This box is closed');
    await click(byText('button', 'Reopen'));
    expect(saved()[0].status).toBe('open');
    expect(mineFor('AAA-1').every(b => !b.disabled)).toBe(true);
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

describe('in the hosted edition', () => {
  const others = [{ ticketId: 10, userId: 'u2', name: 'Maya', points: 8 }];
  beforeEach(() => { hosted.on = true; setActiveOrg('org-1', 'owner'); votesApi.listVotes.mockResolvedValue({ ok: true, data: others }); });

  it('shows everyone\'s points from the server, and gives your own through it, then reads them again', async () => {
    votesApi.putVote.mockResolvedValue({ ok: true, data: undefined });
    seed();
    page('/storyboxes/b1');
    await settle(40);
    expect(votesApi.listVotes).toHaveBeenCalledWith('org-1', 'b1');
    expect(qa('tbody tr')[0].textContent).toContain('Maya 8');
    votesApi.listVotes.mockResolvedValue({ ok: true, data: [...others, { ticketId: 10, userId: 'me', name: 'You', points: 5 }] });
    await click(mineFor('AAA-1').find(b => b.textContent === '5'));
    await settle(40);
    expect(votesApi.putVote).toHaveBeenCalledWith('org-1', 'b1', 10, 5);
    expect(qa('tbody tr')[0].textContent).toContain('2 votes');
    expect(saved()[0].localVotes).toBeUndefined(); // nothing is kept in the box itself
  });

  it('shows the server\'s reason when it refuses a vote, such as a closed box', async () => {
    votesApi.putVote.mockResolvedValue({ ok: false, status: 409, message: 'This story box is closed.' });
    seed();
    page('/storyboxes/b1');
    await settle(40);
    await click(mineFor('AAA-1')[1]);
    await settle(30);
    expect(q('[role="alert"]')!.textContent).toContain('closed');
  });
});
