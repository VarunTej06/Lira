import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '../../types/issue';
import { byText, cleanup, click, mount, q, qa, typeInto, press } from '../../test/render';
import { getSprintMeta, setSprintMeta } from '../../utils/sprintUtils';

const saved = vi.hoisted(() => vi.fn());
vi.mock('../common/savedToastStore', () => ({ notifySaved: saved }));

import { SprintSummary } from './SprintSummary';

beforeEach(() => {
  localStorage.clear();
  saved.mockClear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 9, 10, 0, 0)); // sprint 2026-11 is active
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

let n = 0;
const t = (status: string, over: Partial<Issue> = {}) => ({ id: ++n, key: `A-${n}`, status, sprint: '2026-11', type: 'task', spaceId: 1, storyPoints: 2, createdAt: new Date(2026, 10, 1), ...over }) as unknown as Issue;

function show(over: Record<string, unknown> = {}) {
  const h = { onEditSpaces: vi.fn(), onAddIssue: vi.fn(), onComplete: vi.fn(), onGoalSaved: vi.fn() };
  mount(<SprintSummary sprint="2026-11" scope="all" keys={['2026-10', '2026-11', '2026-12']} list={[t('done'), t('inprogress'), t('todo')]} involvedNames={null} {...h} {...over} />);
  return h;
}
const goal = () => q<HTMLInputElement>('input[aria-label="Sprint goal"]')!;

describe('SprintSummary', () => {
  describe('heading', () => {
    it('shows the name, kind, dates, length and days left of an active sprint', () => {
      show();
      expect(q('h2')!.textContent).toBeTruthy();
      expect(document.body.textContent).toContain('Nov 1 – Nov 30 · 30 days');
      expect(document.body.textContent).toContain('· 21 days left');
    });
    it('says "1 day left" in the singular and "0 days left" on the last day', () => {
      vi.setSystemTime(new Date(2026, 10, 29, 10, 0, 0));
      show();
      expect(document.body.textContent).toContain('· 1 day left');
      cleanup();
      vi.setSystemTime(new Date(2026, 10, 30, 10, 0, 0));
      show();
      expect(document.body.textContent).toContain('· 0 days left');
    });
    it('shows no days left for a sprint that is not active', () => {
      show({ sprint: '2026-12' });
      expect(document.body.textContent).not.toContain('left');
    });
    it('says Closed and when, for a closed sprint', () => {
      setSprintMeta('all', '2026-11', { completedAt: '2026-11-09T10:00:00.000Z' });
      show();
      expect(document.body.textContent).toContain('Closed');
      expect(document.body.textContent).toContain('· closed');
    });
    it('lists the spaces that take part, a count when names are empty, or all spaces', () => {
      show({ involvedNames: ['Alpha', 'Beta'] });
      expect(q('[data-testid="sprint-spaces"]')!.textContent).toContain('Spaces: Alpha, Beta');
      cleanup();
      show({ involvedNames: [], involvedCount: 3 });
      expect(q('[data-testid="sprint-spaces"]')!.textContent).toContain('Spaces: 3 spaces');
      cleanup();
      show();
      expect(q('[data-testid="sprint-spaces"]')!.textContent).toContain('Spaces: all spaces');
    });
    it('edits the spaces', async () => {
      const h = show();
      await click(byText('button', 'Edit'));
      expect(h.onEditSpaces).toHaveBeenCalled();
    });
  });

  describe('buttons', () => {
    it('creates a ticket in the sprint, for the space when the scope is one', async () => {
      const h = show();
      await click(byText('button', /Create ticket/));
      expect(h.onAddIssue).toHaveBeenCalledWith('todo', { sprint: '2026-11', spaceId: undefined });
      cleanup();
      const h2 = show({ scope: 4 });
      await click(byText('button', /Create ticket/));
      expect(h2.onAddIssue).toHaveBeenCalledWith('todo', { sprint: '2026-11', spaceId: 4 });
    });
    it('hides Create ticket for a past sprint or when it cannot add', () => {
      show({ sprint: '2026-09' });
      expect(byText('button', /Create ticket/)).toBeUndefined();
      cleanup();
      show({ onAddIssue: undefined });
      expect(byText('button', /Create ticket/)).toBeUndefined();
    });
    it('completes the sprint, or opens the retrospective once closed', async () => {
      const h = show();
      await click(byText('button', /Complete sprint/));
      expect(h.onComplete).toHaveBeenCalled();
      cleanup();
      setSprintMeta('all', '2026-11', { completedAt: '2026-11-09T10:00:00.000Z' });
      show();
      expect(byText('button', /Retrospective/)!.title).toBe('Edit the retrospective');
    });
    it('cannot complete an empty sprint, but can open an empty closed one', () => {
      show({ list: [] });
      expect((byText('button', /Complete sprint/) as HTMLButtonElement).disabled).toBe(true);
      cleanup();
      setSprintMeta('all', '2026-11', { completedAt: '2026-11-09T10:00:00.000Z' });
      show({ list: [] });
      expect((byText('button', /Retrospective/) as HTMLButtonElement).disabled).toBe(false);
    });
    it('says where unfinished tickets go in the tooltip', () => {
      show();
      expect(byText('button', /Complete sprint/)!.title).toContain('unfinished tickets move to');
    });
  });

  describe('goal', () => {
    it('starts with the saved goal and shows no buttons', () => {
      setSprintMeta('all', '2026-11', { goal: 'Ship it' });
      show();
      expect(goal().value).toBe('Ship it');
      expect(byText('button', 'Save goal')).toBeUndefined();
    });
    it('offers Save and Cancel after a change; Cancel restores', async () => {
      setSprintMeta('all', '2026-11', { goal: 'Ship it' });
      show();
      await typeInto(goal(), 'Ship it faster');
      expect(byText('button', 'Save goal')).toBeDefined();
      await click(byText('button', 'Cancel'));
      expect(goal().value).toBe('Ship it');
    });
    it('saves trimmed, tells the page and shows a saved card; Enter saves too', async () => {
      const h = show();
      await typeInto(goal(), '  New goal  ');
      await click(byText('button', 'Save goal'));
      expect(getSprintMeta('all', '2026-11').goal).toBe('New goal');
      expect(h.onGoalSaved).toHaveBeenCalled();
      expect(saved).toHaveBeenCalledWith('Sprint goal saved');
      expect(goal().value).toBe('New goal');
      await typeInto(goal(), 'Another');
      await press('Enter', goal());
      expect(getSprintMeta('all', '2026-11').goal).toBe('Another');
    });
  });

  describe('progress', () => {
    it('shows done of total, percent and points', () => {
      show();
      expect(document.body.textContent).toContain('of 3 done');
      expect(document.body.textContent).toContain('/6 points');
    });
    it('shows the today mark only while active', () => {
      show();
      expect(q('[title="Today"]')).not.toBeNull();
      cleanup();
      show({ sprint: '2026-12' });
      expect(q('[title="Today"]')).toBeNull();
    });
    it('has a tile for each status count', () => {
      show();
      expect(qa('.grid > div').map(d => d.querySelector('.truncate')!.textContent)).toEqual(['Backlog', 'To Do', 'In Progress', 'Blocked', 'Done', 'Carried over in']);
    });
    it('copes with an empty sprint', () => {
      show({ list: [] });
      expect(document.body.textContent).toContain('of 0 done');
    });
  });
});
