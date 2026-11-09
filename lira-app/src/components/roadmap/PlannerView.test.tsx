import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import type { Issue } from '../../types/issue';
import type { Roadmap, RoadmapItem } from '../../utils/roadmapUtils';
import { cleanup, mount, q, qa, settle } from '../../test/render';
import { PlannerView } from './PlannerView';

afterEach(cleanup);

const item = (over: Partial<RoadmapItem> = {}): RoadmapItem => ({
  id: 'i1', title: 'Board v2', lane: 'Core', status: 'inprogress', start: '2026-11-02', end: '2026-11-20', progress: 30,
  deps: [], children: [], epicKey: 'LIRA-1', ...over,
});
const epic = { id: 1, key: 'LIRA-1', title: 'Board v2', type: 'epic', status: 'inprogress', spaceId: 1, createdAt: new Date(2026, 10, 1) } as Issue;
const task = (id: number, key: string, over: Partial<Issue> = {}) => ({
  id, key, title: `Task ${id}`, type: 'task', status: 'todo', spaceId: 1, parentId: 1, createdAt: new Date(2026, 10, 1), ...over,
} as Issue);
const roadmap = (items: RoadmapItem[]): Roadmap => ({ id: 'r', name: 'Plan', lanes: ['Core'], items, milestones: [{ id: 'm1', title: 'Beta', date: '2026-11-15', kind: 'release' }] } as unknown as Roadmap);

function show(over: { items?: RoadmapItem[]; issues?: Issue[] } = {}) {
  const items = over.items ?? [item()];
  const issues = over.issues ?? [epic, task(2, 'LIRA-2', { dueDate: new Date(2026, 10, 10) }), task(3, 'LIRA-3')];
  const h = { onToggleLane: vi.fn(), onChangeItem: vi.fn(), onMoveTicket: vi.fn(), onOpenItem: vi.fn(), onOpenIssue: vi.fn(), onAddTicket: vi.fn() };
  mount(<PlannerView roadmap={roadmap(items)} items={items} issues={issues} collapsedLanes={[]} scrollToTodayKey={0} {...h} />);
  return { ...h, items, issues };
}

const epicBar = () => qa('[title^="Board v2"]').find(el => el.getAttribute('title')!.includes('→'))!;
const ticketChip = (key: string) => qa('[title]').find(el => el.getAttribute('title')!.startsWith(key))!;

const pointer = (type: string, x: number, target: EventTarget, button = 0) =>
  act(async () => { target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: 10, button })); });

describe('PlannerView', () => {
  it('shows the epic as a bar and its tickets as chips', async () => {
    show();
    await settle();
    expect(epicBar()).toBeTruthy();
    expect(ticketChip('LIRA-2')).toBeTruthy();
    expect(ticketChip('LIRA-3')).toBeTruthy();
  });

  it('counts the tickets shown and those without a due date', async () => {
    show();
    await settle();
    expect(document.body.textContent).toContain('2 tickets shown');
    expect(document.body.textContent).toContain('1 without a due date');
  });

  it('draws a ticket without a due date with a dashed edge, and one with a due date solid', async () => {
    show();
    await settle();
    expect(ticketChip('LIRA-3').getAttribute('style')).toContain('dashed');
    expect(ticketChip('LIRA-2').getAttribute('style')).toContain('solid');
    expect(ticketChip('LIRA-3').getAttribute('title')).toContain('No due date');
    expect(ticketChip('LIRA-2').getAttribute('title')).toContain('Due ');
  });

  it('marks the milestone on the calendar', async () => {
    show();
    await settle();
    expect(q('[style*="left"][class*="border-dashed"]')).not.toBeNull();
  });

  describe('clicking', () => {
    it('opens the item when its bar is clicked (pressed and released without moving)', async () => {
      const h = show();
      await settle();
      await pointer('pointerdown', 200, epicBar());
      await pointer('pointerup', 200, window);
      expect(h.onOpenItem).toHaveBeenCalledWith('i1');
      expect(h.onChangeItem).not.toHaveBeenCalled();
    });

    it('opens the ticket when its chip is clicked', async () => {
      const h = show();
      await settle();
      await pointer('pointerdown', 200, ticketChip('LIRA-2'));
      await pointer('pointerup', 200, window);
      expect(h.onOpenIssue).toHaveBeenCalledWith(expect.objectContaining({ key: 'LIRA-2' }));
    });

    it('ignores any button but the main one', async () => {
      const h = show();
      await settle();
      await pointer('pointerdown', 200, epicBar(), 2);
      await pointer('pointerup', 200, window);
      expect(h.onOpenItem).not.toHaveBeenCalled();
    });
  });

  describe('dragging', () => {
    it('moving an epic bar saves the item with new dates and keeps its length', async () => {
      const h = show();
      await settle();
      await pointer('pointerdown', 100, epicBar());
      await pointer('pointermove', 100 + 9 * 5, window);
      await pointer('pointerup', 100 + 9 * 5, window);
      expect(h.onOpenItem).not.toHaveBeenCalled();
      expect(h.onChangeItem).toHaveBeenCalledTimes(1);
      const saved = h.onChangeItem.mock.calls[0][0] as RoadmapItem;
      expect(saved.start > '2026-11-02').toBe(true);
      const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86400000;
      expect(days(saved.start, saved.end)).toBe(days('2026-11-02', '2026-11-20'));
    });

    it('moving a ticket chip gives it a new date', async () => {
      const h = show();
      await settle();
      await pointer('pointerdown', 100, ticketChip('LIRA-2'));
      await pointer('pointermove', 100 + 9 * 4, window);
      await pointer('pointerup', 100 + 9 * 4, window);
      expect(h.onMoveTicket).toHaveBeenCalledTimes(1);
      const [issue, date] = h.onMoveTicket.mock.calls[0] as [Issue, Date];
      expect(issue.key).toBe('LIRA-2');
      expect(date.getTime()).toBeGreaterThan(new Date(2026, 10, 10).getTime());
    });

    it('shows the new dates next to the pointer while dragging', async () => {
      show();
      await settle();
      await pointer('pointerdown', 100, epicBar());
      await pointer('pointermove', 100 + 9 * 5, window);
      expect(document.body.textContent).toContain('→');
      await pointer('pointerup', 100 + 9 * 5, window);
    });

    it('dragging the left edge changes only the start', async () => {
      const h = show();
      await settle();
      const leftEdge = qa('.cursor-ew-resize', epicBar())[0];
      await pointer('pointerdown', 100, leftEdge);
      await pointer('pointermove', 100 + 9 * 3, window);
      await pointer('pointerup', 100 + 9 * 3, window);
      const saved = h.onChangeItem.mock.calls[0][0] as RoadmapItem;
      expect(saved.end).toBe('2026-11-20');
      expect(saved.start).not.toBe('2026-11-02');
    });
  });
});
