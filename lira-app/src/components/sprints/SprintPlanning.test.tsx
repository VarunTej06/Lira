import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { cleanup, click, mount, q, qa, typeInto } from '../../test/render';

const move = vi.hoisted(() => vi.fn(async (list: unknown[]) => list.length));
vi.mock('../../utils/sprintUtils', async orig => ({ ...(await orig<typeof import('../../utils/sprintUtils')>()), moveIssuesToSprint: move }));

import { SprintPlanning } from './SprintPlanning';
import { getSprintMeta, setSprintMeta } from '../../utils/sprintUtils';

beforeEach(() => {
  localStorage.clear();
  move.mockClear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 9, 10, 0, 0));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const SPRINT = '2026-11';
const KEYS = ['2026-10', '2026-11', '2026-12'];
const space = (id: number, key: string): Space => ({ id, key, name: key, icon: 'x', color: '#112233', createdAt: new Date(0), updatedAt: new Date(0) });
const SPACES = [space(1, 'AAA'), space(2, 'BBB')];

let n = 0;
const ticket = (over: Partial<Issue> = {}): Issue => ({
  id: ++n, spaceId: 1, key: `AAA-${n}`, title: `Ticket ${n}`, description: '', type: 'task', status: 'todo', priority: 'medium',
  reporter: 'A', reporterInitials: 'A', assigneeInitials: 'VT', labels: [], subtasks: [], comments: [], activity: [], attachments: [], linkedIssues: [],
  rank: n, watchers: [], sprint: SPRINT, createdAt: new Date(2026, 10, 1), updatedAt: new Date(2026, 10, 2), ...over,
} as Issue);

function show(issues: Issue[], over: Partial<Parameters<typeof SprintPlanning>[0]> = {}) {
  const h = { onIssueClick: vi.fn(), flash: vi.fn() };
  mount(<SprintPlanning issues={issues} spaces={SPACES} sprint={SPRINT} keys={KEYS} scope="all" {...h} {...over} />);
  return h;
}
const card = (side: string, i: Issue) => q(`[data-testid="plan-${side}-${i.key}"]`);
const section = (label: string) => q(`section[aria-label="${label}"]`)!;

/** A drag event the fake browser can carry data on. */
function drag(el: Element, type: 'dragstart' | 'dragover' | 'drop', data: Record<string, string> = {}) {
  const store = new Map(Object.entries(data));
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'dataTransfer', { value: { types: [...store.keys()], setData: (k: string, v: string) => store.set(k, v), getData: (k: string) => store.get(k) ?? '', effectAllowed: '' } });
  act(() => { el.dispatchEvent(e); });
  return e;
}

describe('SprintPlanning', () => {
  describe('the two lists', () => {
    it('puts sprint tickets on the right and other open tickets on the left', () => {
      const inIt = ticket();
      const waiting = ticket({ sprint: '2026-10', status: 'backlog' });
      const done = ticket({ sprint: '2026-10', status: 'done' });
      show([inIt, waiting, done]);
      expect(card('sprint', inIt)).not.toBeNull();
      expect(card('backlog', waiting)).not.toBeNull();
      expect(card('backlog', done)).toBeNull();
    });

    it('lists real backlog first, then tickets in other sprints', () => {
      const other = ticket({ sprint: '2026-12', status: 'todo', rank: 1 });
      const back = ticket({ sprint: '2026-10', status: 'backlog', rank: 9 });
      show([other, back]);
      const keys = qa('[data-testid^="plan-backlog-"]').map(e => e.getAttribute('data-testid'));
      expect(keys).toEqual([`plan-backlog-${back.key}`, `plan-backlog-${other.key}`]);
    });

    it('shows the counts and the empty messages', () => {
      show([]);
      expect(document.body.textContent).toContain('Nothing left to plan.');
      expect(document.body.textContent).toContain('Empty. Drag tickets here from the backlog.');
    });

    it('searches the backlog by key or title', async () => {
      const a = ticket({ sprint: '2026-10', status: 'backlog', title: 'Fix login' });
      const b = ticket({ sprint: '2026-10', status: 'backlog', title: 'Add export' });
      show([a, b]);
      await typeInto(q<HTMLInputElement>('input[aria-label="Search the backlog"]'), 'LOGIN');
      expect(card('backlog', a)).not.toBeNull();
      expect(card('backlog', b)).toBeNull();
      await typeInto(q<HTMLInputElement>('input[aria-label="Search the backlog"]'), 'zzz');
      expect(document.body.textContent).toContain('No tickets match.');
    });

    it('limits to one space when the scope is a space', () => {
      const mine = ticket({ spaceId: 1, sprint: '2026-10', status: 'backlog' });
      const theirs = ticket({ spaceId: 2, sprint: '2026-10', status: 'backlog' });
      show([mine, theirs], { scope: 1 });
      expect(card('backlog', mine)).not.toBeNull();
      expect(card('backlog', theirs)).toBeNull();
    });

    it('shows the space chip only in the all-spaces view, and the sprint chip on tickets from other sprints', () => {
      const other = ticket({ spaceId: 2, sprint: '2026-12', status: 'todo' });
      show([other]);
      expect(card('backlog', other)!.textContent).toContain('BBB');
      expect(card('backlog', other)!.textContent).toContain('Dec');
      cleanup();
      show([other], { scope: 2 });
      expect(card('backlog', other)!.textContent).not.toContain('BBB');
    });

    it('shows story points, or ? when not estimated', () => {
      const est = ticket({ storyPoints: 5 });
      const raw = ticket();
      show([est, raw]);
      expect(card('sprint', est)!.querySelector('[title="Story points"]')!.textContent).toBe('5');
      expect(card('sprint', raw)!.querySelector('[title="Not estimated"]')!.textContent).toBe('?');
    });

    it('opens a ticket on click', async () => {
      const t = ticket();
      const h = show([t]);
      await click(card('sprint', t));
      expect(h.onIssueClick).toHaveBeenCalledWith(t);
    });
  });

  describe('moving tickets', () => {
    it('+ adds a backlog ticket to the sprint and says so', async () => {
      const t = ticket({ sprint: '2026-10', status: 'backlog' });
      const h = show([t]);
      await click(q(`button[aria-label="Add ${t.key} to sprint"]`));
      expect(move).toHaveBeenCalledWith([t], SPRINT);
      expect(h.flash).toHaveBeenCalledWith(expect.stringMatching(/^1 ticket added to /));
      expect(h.onIssueClick).not.toHaveBeenCalled();
    });

    it('− moves a sprint ticket to the next sprint', async () => {
      const t = ticket();
      const h = show([t]);
      await click(q(`button[aria-label="Move ${t.key} out of sprint"]`));
      expect(move).toHaveBeenCalledWith([t], '2026-12');
      expect(h.flash).toHaveBeenCalledWith(expect.stringMatching(/^1 ticket moved to /));
    });

    it('stays quiet when nothing moved', async () => {
      move.mockResolvedValueOnce(0);
      const t = ticket({ sprint: '2026-10', status: 'backlog' });
      const h = show([t]);
      await click(q(`button[aria-label="Add ${t.key} to sprint"]`));
      expect(h.flash).not.toHaveBeenCalled();
    });

    it('drags a backlog ticket into the sprint, and a sprint ticket back out', () => {
      const back = ticket({ sprint: '2026-10', status: 'backlog' });
      const inIt = ticket();
      show([back, inIt]);
      drag(section('Sprint'), 'drop', { 'application/x-lira-issue': String(back.id) });
      expect(move).toHaveBeenLastCalledWith([back], SPRINT);
      drag(section('Backlog'), 'drop', { 'application/x-lira-issue': String(inIt.id) });
      expect(move).toHaveBeenLastCalledWith([inIt], '2026-12');
    });

    it('ignores a drop that changes nothing, or of an unknown ticket', () => {
      const inIt = ticket();
      show([inIt]);
      drag(section('Sprint'), 'drop', { 'application/x-lira-issue': String(inIt.id) });
      drag(section('Sprint'), 'drop', { 'application/x-lira-issue': '99999' });
      expect(move).not.toHaveBeenCalled();
    });

    it('accepts a drag over only when it carries a ticket, and highlights the target', () => {
      show([ticket()]);
      expect(drag(section('Sprint'), 'dragover', { 'text/plain': 'x' }).defaultPrevented).toBe(false);
      expect(drag(section('Sprint'), 'dragover', { 'application/x-lira-issue': '1' }).defaultPrevented).toBe(true);
      expect(section('Sprint').className).toContain('border-lira-blue');
      expect(section('Backlog').className).not.toContain('border-lira-blue');
    });

    it('stores the ticket id when a card is dragged', () => {
      const t = ticket();
      show([t]);
      const e = drag(card('sprint', t)!, 'dragstart');
      expect((e as unknown as { dataTransfer: { getData: (k: string) => string } }).dataTransfer.getData('application/x-lira-issue')).toBe(String(t.id));
    });
  });

  describe('capacity', () => {
    it('shows the committed points and tickets', () => {
      show([ticket({ storyPoints: 3 }), ticket({ storyPoints: 2 })]);
      expect(q('[data-testid="plan-points"]')!.textContent).toContain('5');
      expect(q('[data-testid="plan-points"]')!.textContent).toContain('2 tickets');
    });

    it('saves the capacity typed, and clears it when emptied', async () => {
      show([ticket({ storyPoints: 3 })]);
      const input = q<HTMLInputElement>('input[aria-label="Team capacity in story points"]');
      await typeInto(input, '10');
      expect(getSprintMeta('all', SPRINT).capacity).toBe(10);
      expect(q('[role="progressbar"]')!.getAttribute('aria-valuemax')).toBe('10');
      await typeInto(input, '');
      expect(getSprintMeta('all', SPRINT).capacity).toBeUndefined();
    });

    it('never saves a negative capacity', async () => {
      show([ticket()]);
      await typeInto(q<HTMLInputElement>('input[aria-label="Team capacity in story points"]'), '-4');
      expect(getSprintMeta('all', SPRINT).capacity).toBe(0);
    });

    it('colours the bar green, amber from 90 percent, red when over', () => {
      setSprintMeta('all', SPRINT, { capacity: 10 });
      show([ticket({ storyPoints: 3 })]);
      expect(q('[role="progressbar"] div')!.className).toContain('bg-green-500');
      cleanup();
      show([ticket({ storyPoints: 9 })]);
      expect(q('[role="progressbar"] div')!.className).toContain('bg-amber-500');
    });

    it('warns when over-committed, singular and plural', () => {
      setSprintMeta('all', SPRINT, { capacity: 3 });
      show([ticket({ storyPoints: 4 })]);
      expect(q('[data-testid="plan-overcommit"]')!.textContent).toContain('Over-committed by 1 point:');
      cleanup();
      show([ticket({ storyPoints: 6 })]);
      expect(q('[data-testid="plan-overcommit"]')!.textContent).toContain('Over-committed by 3 points:');
    });

    it('warns about tickets with no story points', () => {
      show([ticket()]);
      expect(document.body.textContent).toContain('1 ticket has no story points');
      cleanup();
      show([ticket(), ticket()]);
      expect(document.body.textContent).toContain('2 tickets have no story points');
    });

    it('is read-only when the sprint is closed', () => {
      setSprintMeta('all', SPRINT, { completedAt: '2026-11-09' });
      const t = ticket();
      show([t, ticket({ sprint: '2026-10', status: 'backlog' })]);
      expect(document.body.textContent).toContain('This sprint is closed. Planning is read-only.');
      expect(qa('button[aria-label^="Add "], button[aria-label^="Move "]')).toHaveLength(0);
      expect(card('sprint', t)!.getAttribute('draggable')).toBe('false');
    });
  });
});
