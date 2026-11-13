import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { byText, cleanup, click, mount, q, qa, settle } from '../../test/render';
import { SprintsPage } from './SprintsPage';

/** The fake browser has no IntersectionObserver; this one says everything is already on screen. */
class AlwaysVisible {
  private cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) { this.cb = cb; }
  observe() { this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
beforeAll(() => { (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = AlwaysVisible; });

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 9, 10, 0, 0)); // Monday 9 Nov 2026: the current sprint is 2026-11
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const space = (id: number, key: string, name = key): Space => ({ id, key, name, icon: 'x', color: '#000000', createdAt: new Date(0), updatedAt: new Date(0) });
const SPACES = [space(1, 'AAA', 'Alpha'), space(2, 'BBB', 'Beta')];

let n = 0;
const ticket = (over: Partial<Issue> = {}): Issue => ({
  id: ++n, spaceId: 1, key: `AAA-${n}`, title: `Ticket ${n}`, description: '', type: 'task', status: 'todo', priority: 'medium',
  reporter: 'A', reporterInitials: 'A', labels: [], subtasks: [], comments: [], activity: [], attachments: [], linkedIssues: [],
  rank: n, watchers: [], sprint: '2026-11', createdAt: new Date(2026, 10, 1), updatedAt: new Date(2026, 10, 2), ...over,
} as Issue);

function show(issues: Issue[], over: Partial<Parameters<typeof SprintsPage>[0]> = {}) {
  const h = { onIssueClick: vi.fn(), onOpenSpace: vi.fn(), onAddIssue: vi.fn() };
  mount(<SprintsPage spaces={SPACES} issues={issues} {...h} {...over} />);
  return h;
}
const tabs = () => qa('[role="tab"]');
const tab = (label: string) => tabs().find(t => t.textContent === label)!;

describe('SprintsPage', () => {
  describe('views', () => {
    it('has four views and starts on the sprint view', async () => {
      show([ticket()]);
      await settle();
      expect(tabs().map(t => t.textContent)).toEqual(['Sprint', 'Planning', 'Reports', 'Epics']);
      expect(tab('Sprint').getAttribute('aria-selected')).toBe('true');
      expect(document.body.textContent).toContain('Burndown');
    });

    it('moves between the views', async () => {
      show([ticket()]);
      await settle();
      await click(tab('Planning'));
      await settle();
      expect(tab('Planning').getAttribute('aria-selected')).toBe('true');
      expect(tab('Sprint').getAttribute('aria-selected')).toBe('false');
      expect(document.body.textContent).not.toContain('Burndown');
      await click(tab('Sprint'));
      await settle();
      expect(document.body.textContent).toContain('Burndown');
    });
  });

  describe('a sprint that ended with work left', () => {
    const past = '2026-09';
    const stuck = () => [ticket({ sprint: past, status: 'inprogress' }), ticket({ sprint: past, status: 'done' })];

    it('offers to carry the unfinished tickets over', async () => {
      show(stuck(), { focusSprint: past });
      await settle();
      const prompt = q('[data-testid="rollover-prompt"]')!;
      expect(prompt.textContent).toContain('ended with 1 unfinished ticket');
      await click(byText('button', 'Carry over and close'));
      await settle();
      expect(document.body.textContent).toMatch(/close|retro|carry/i);
    });

    it('shows no rollover prompt for the current sprint', async () => {
      show([ticket()]);
      await settle();
      expect(q('[data-testid="rollover-prompt"]')).toBeNull();
    });

    it('warns about unfinished tickets left in sprints that already ended, and offers to move them to the current one', async () => {
      show(stuck());
      await settle();
      expect(document.body.textContent).toContain('still sitting in sprints that have already ended');
      expect(byText('button', /^Move to /)).toBeTruthy();
    });

    it('says nothing about stranded tickets when there are none', async () => {
      show([ticket(), ticket({ sprint: past, status: 'done' })]);
      await settle();
      expect(document.body.textContent).not.toContain('still sitting in sprints');
    });
  });

  describe('jumping to a space', () => {
    it('lists the spaces that have tickets in the sprint, with counts', async () => {
      const h = show([ticket({ spaceId: 1 }), ticket({ spaceId: 1 }), ticket({ spaceId: 2 })]);
      await settle();
      expect(document.body.textContent).toContain('Jump to a space:');
      await click(byText('button', /Alpha \(2\)/));
      expect(h.onOpenSpace).toHaveBeenCalledWith(1);
      expect(byText('button', /Beta \(1\)/)).toBeTruthy();
    });

    it('is hidden when the page is locked to one space', async () => {
      show([ticket()], { lockedSpaceId: 1 });
      await settle();
      expect(document.body.textContent).not.toContain('Jump to a space:');
    });

    it('is hidden when there is nowhere to go', async () => {
      show([ticket()], { onOpenSpace: undefined });
      await settle();
      expect(document.body.textContent).not.toContain('Jump to a space:');
    });
  });

  it('is limited to one space when locked to it', async () => {
    show([ticket({ spaceId: 1 }), ticket({ spaceId: 2 })], { lockedSpaceId: 1 });
    await settle();
    expect(document.body.textContent).toContain('Ticket');
    expect(document.body.textContent).not.toContain('BBB-');
  });

  it('follows the sprint it is told to show', async () => {
    show([ticket({ sprint: '2026-12' })], { focusSprint: '2026-12' });
    await settle();
    expect(document.body.textContent).toContain('Dec');
  });
});
