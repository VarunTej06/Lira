import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppRoute } from '../routes';
import type { Space } from '../types/space';
import { cleanup, click, mount, q } from '../test/render';
import { pathForTab, useAppNavigation } from './useAppNavigation';

afterEach(cleanup);

const SPACES = [{ id: 1, key: 'AAA', name: 'A' }, { id: 2, key: 'BBB', name: 'B' }] as Space[];

function Probe({ route, spaces = SPACES, activeSpace = SPACES[0], h }: { route: AppRoute; spaces?: Space[]; activeSpace?: Space; h: { navigate: (to: string) => void; setSidebarCollapsed: (c: boolean) => void } }) {
  const nav = useAppNavigation({ route, spaces, activeSpace, ...h });
  return (
    <div>
      <button data-testid="select2" onClick={() => nav.handleSelectSpace(2)} />
      <button data-testid="select99" onClick={() => nav.handleSelectSpace(99)} />
      <button data-testid="board2" onClick={() => nav.openSpaceBoard(2)} />
      <button data-testid="board99" onClick={() => nav.openSpaceBoard(99)} />
      <button data-testid="tab" onClick={() => nav.goTab('List')} />
    </div>
  );
}
const handlers = () => ({ navigate: vi.fn(), setSidebarCollapsed: vi.fn() });
const press = (id: string) => click(q(`[data-testid="${id}"]`));

describe('useAppNavigation', () => {
  describe('handleSelectSpace', () => {
    it('keeps the tab when already inside a space, and leaves the sidebar alone', async () => {
      const h = handlers();
      mount(<Probe route={{ kind: 'space', spaceKey: 'AAA', tab: 'List' } as AppRoute} h={h} />);
      await press('select2');
      expect(h.navigate).toHaveBeenCalledWith('/space/BBB/list');
      expect(h.setSidebarCollapsed).not.toHaveBeenCalled();
    });
    it('opens the board and expands the sidebar when coming from a global page', async () => {
      const h = handlers();
      mount(<Probe route={{ kind: 'forYou' }} h={h} />);
      await press('select2');
      expect(h.navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/space\/BBB\/board$/i));
      expect(h.setSidebarCollapsed).toHaveBeenCalledWith(false);
    });
    it('does nothing for an unknown space', async () => {
      const h = handlers();
      mount(<Probe route={{ kind: 'forYou' }} h={h} />);
      await press('select99');
      expect(h.navigate).not.toHaveBeenCalled();
    });
  });

  describe('openSpaceBoard', () => {
    it('expands the sidebar and opens the board', async () => {
      const h = handlers();
      mount(<Probe route={{ kind: 'sprints' }} h={h} />);
      await press('board2');
      expect(h.setSidebarCollapsed).toHaveBeenCalledWith(false);
      expect(h.navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/space\/BBB\/board$/i));
    });
    it('does nothing for an unknown space', async () => {
      const h = handlers();
      mount(<Probe route={{ kind: 'sprints' }} h={h} />);
      await press('board99');
      expect(h.navigate).not.toHaveBeenCalled();
      expect(h.setSidebarCollapsed).not.toHaveBeenCalled();
    });
  });

  describe('goTab', () => {
    it('goes to the address of the page name', async () => {
      const h = handlers();
      mount(<Probe route={{ kind: 'forYou' }} h={h} />);
      await press('tab');
      expect(h.navigate).toHaveBeenCalledWith('/space/AAA/list');
    });
  });
});

describe('pathForTab', () => {
  it('keeps the sprint you are on for the sprint page, and drops it from another kind of page', () => {
    expect(pathForTab('SprintDetail', { kind: 'sprints', sprintKey: '2026-11' }, 'AAA')).toBe('/sprints/2026-11');
    expect(pathForTab('SprintDetail', { kind: 'forYou' }, 'AAA')).toBe('/sprints');
  });
  it('keeps the project and the roadmap you are on', () => {
    expect(pathForTab('Projects', { kind: 'projects', projectId: 'p1' }, 'AAA')).toBe('/projects/p1');
    expect(pathForTab('Roadmaps', { kind: 'roadmaps', roadmapId: 'r1' }, 'AAA')).toBe('/roadmaps/r1');
  });
  it('sends a board tab to the space on screen, and to home without one', () => {
    expect(pathForTab('List', { kind: 'forYou' }, 'AAA')).toBe('/space/AAA/list');
    expect(pathForTab('List', { kind: 'forYou' }, undefined)).toBe('/');
  });
});
