import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { DashboardGrid } from './DashboardGrid';
import { DashboardsHome } from './DashboardsHome';
import { DashboardWizard } from './DashboardWizard';
import { CATALOG, SCENARIOS, widgetFromEntry } from '../../utils/dashboards/catalog';
import { buildDashboard, readDashboards } from '../../utils/dashboards/store';
import { DEFAULT_FILTERS } from '../../utils/dashboards/types';
import type { DataCtx } from '../../utils/dashboards/metrics';
import { cleanup, click, mount, q, qa, settle, typeInto, byText } from '../../test/render';
import { makeIssue, makeSpace } from '../../test/factories';
import { useEffect } from 'react';

const NOW = new Date();
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const issues = [
  makeIssue({ id: 1, spaceId: 1, status: 'inprogress', assignee: 'Ann', storyPoints: 5, dueDate: day(-2), priority: 'high' }),
  makeIssue({ id: 2, spaceId: 1, status: 'todo', blocked: true, blockedByIds: [1], dueDate: day(2) }),
  makeIssue({ id: 3, spaceId: 1, status: 'done', resolvedAt: day(-1), assignee: 'Bob' }),
  makeIssue({ id: 4, spaceId: 1, type: 'epic', title: 'Big epic', status: 'inprogress' }),
  makeIssue({ id: 5, spaceId: 1, epicId: 4, status: 'done', resolvedAt: day(-3) }),
  makeIssue({ id: 6, spaceId: 1, type: 'bug', status: 'backlog', labels: ['ui'] }),
];
const spaces = [makeSpace({ id: 1, name: 'Lira', key: 'LIRA', icon: 'L' })];
const ctx = (list = issues): DataCtx => ({ issues: list, spaces, projects: [], roadmaps: [], now: NOW, me: ['vy'] });

beforeEach(() => { localStorage.clear(); });
afterEach(cleanup);

const grid = (widgets: ReturnType<typeof widgetFromEntry>[], props: Partial<React.ComponentProps<typeof DashboardGrid>> = {}) => {
  const d = { ...buildDashboard({ name: 'T', scenario: 'custom', filters: DEFAULT_FILTERS, entryIds: [] }), widgets: widgets.filter((w): w is NonNullable<typeof w> => !!w) };
  const onChangeWidgets = vi.fn();
  mount(<MemoryRouter><DashboardGrid dashboard={d} ctx={ctx()} onDrill={() => {}} onOpenIssue={() => {}} onChangeWidgets={onChangeWidgets} {...props} /></MemoryRouter>);
  return { d, onChangeWidgets };
};

describe('Every dashboard widget draws without crashing', () => {
  it.each(CATALOG.map(c => [c.id, c.title]))('%s (%s)', async id => {
    grid([widgetFromEntry(id as string)]);
    await settle(30);
    expect(qa('[data-testid=widget]')).toHaveLength(1);
  });

  it('also when there are no tickets at all', async () => {
    const d = { ...buildDashboard({ name: 'T', scenario: 'custom', filters: DEFAULT_FILTERS, entryIds: [] }), widgets: CATALOG.map(c => widgetFromEntry(c.id)!) };
    mount(<MemoryRouter><DashboardGrid dashboard={d} ctx={ctx([])} onDrill={() => {}} onOpenIssue={() => {}} /></MemoryRouter>);
    await settle(30);
    expect(qa('[data-testid=widget]')).toHaveLength(CATALOG.length);
  });
});

describe('Dashboard grid', () => {
  it('stat cards show the right numbers', async () => {
    grid([widgetFromEntry('stat-blocked'), widgetFromEntry('stat-overdue'), widgetFromEntry('stat-open')]);
    await settle(1100);
    expect(q('[data-testid=stat-blocked]')!.textContent).toContain('1');
    expect(q('[data-testid=stat-overdue]')!.textContent).toContain('1');
    expect(q('[data-testid=stat-open]')!.textContent).toContain('3'); // in progress, to do, backlog
  });

  it('clicking a number opens the tickets behind it', async () => {
    const onDrill = vi.fn();
    grid([widgetFromEntry('stat-blocked')], { onDrill });
    await click(q('[data-testid=stat-blocked]'));
    expect(onDrill).toHaveBeenCalledTimes(1);
    expect(onDrill.mock.calls[0][1].map((i: { id: number }) => i.id)).toEqual([2]);
  });

  it('shows an empty dashboard as a hint, not a blank page', () => {
    grid([]);
    expect(q('[data-testid=empty-dashboard]')!.textContent).toContain('no widgets');
  });

  it('edit tools appear only in edit mode', () => {
    grid([widgetFromEntry('stat-open')]);
    expect(q('[data-testid=widget-tools]')).toBeNull();
    cleanup();
    grid([widgetFromEntry('stat-open')], { editing: true });
    expect(q('[data-testid=widget-tools]')).not.toBeNull();
  });

  it('moves a widget later and earlier with the arrow buttons', async () => {
    const a = widgetFromEntry('stat-open')!, b = widgetFromEntry('stat-done')!, c = widgetFromEntry('stat-blocked')!;
    const { onChangeWidgets } = grid([a, b, c], { editing: true });
    await click(qa('[aria-label="Move later"]')[0]);
    expect(onChangeWidgets.mock.calls[0][0].map((w: { id: string }) => w.id)).toEqual([b.id, a.id, c.id]);
    await click(qa('[aria-label="Move earlier"]')[2]);
    expect(onChangeWidgets.mock.calls[1][0].map((w: { id: string }) => w.id)).toEqual([a.id, c.id, b.id]);
  });

  it('the first widget cannot move earlier and the last cannot move later', () => {
    grid([widgetFromEntry('stat-open'), widgetFromEntry('stat-done')], { editing: true });
    expect((qa('[aria-label="Move earlier"]')[0] as HTMLButtonElement).disabled).toBe(true);
    expect((qa('[aria-label="Move later"]')[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it('changes the width and the height of a widget', async () => {
    const w = widgetFromEntry('stat-open')!;
    const { onChangeWidgets } = grid([w], { editing: true });
    await click(q('[aria-label="Width: Full width"]'));
    expect(onChangeWidgets.mock.calls[0][0][0].size).toBe('XL');
    await click(q('[aria-label="Change height"]'));
    expect(onChangeWidgets.mock.calls[1][0][0].height).toBe(2); // 1 -> 2
  });

  it('removes a widget', async () => {
    const a = widgetFromEntry('stat-open')!, b = widgetFromEntry('stat-done')!;
    const { onChangeWidgets } = grid([a, b], { editing: true });
    await click(qa('[data-testid=widget-remove]')[0]);
    expect(onChangeWidgets.mock.calls[0][0].map((w: { id: string }) => w.id)).toEqual([b.id]);
  });

  it('opens the settings of the widget that was pressed', async () => {
    const a = widgetFromEntry('stat-open')!;
    const onSettings = vi.fn();
    grid([a], { editing: true, onSettings });
    await click(q('[data-testid=widget-settings]'));
    expect(onSettings).toHaveBeenCalledWith(a);
  });

  it('a widget with its own filters says so, and uses them', async () => {
    const w = { ...widgetFromEntry('stat-open')!, filters: { ...DEFAULT_FILTERS, priorities: ['high'] } };
    grid([w]);
    await settle(1100);
    expect(q('[data-testid=widget]')!.textContent).toContain('own filters');
    expect(q('[data-testid=stat-open]')!.textContent).toContain('1'); // only the high priority one
  });

  it('every row in a ticket list can be opened', async () => {
    const onOpenIssue = vi.fn();
    grid([widgetFromEntry('list-overdue')], { onOpenIssue });
    await click(q('[data-testid=issue-list] button'));
    expect(onOpenIssue.mock.calls[0][0].id).toBe(1);
  });
});

const home = (initial = '/dashboards') => {
  const seen = { where: '' };
  const Spy = () => {
    const loc = useLocation();
    useEffect(() => { seen.where = loc.pathname + loc.search; });
    return null;
  };
  mount(
    <MemoryRouter initialEntries={[initial]}>
      <Spy />
      <Routes>
        <Route path="/dashboards" element={<DashboardsHome issues={issues} spaces={spaces} />} />
        <Route path="/dashboards/new" element={<DashboardWizard issues={issues} spaces={spaces} />} />
        <Route path="/dashboards/:id" element={<div data-testid="opened-dashboard" />} />
      </Routes>
    </MemoryRouter>,
  );
  return () => seen.where;
};

describe('Dashboards page', () => {
  it('starts empty and offers all the templates', () => {
    home();
    expect(q('[data-testid=no-dashboards]')).not.toBeNull();
    expect(qa('[data-testid=template-cards] > button')).toHaveLength(SCENARIOS.length);
  });

  it('a template opens the wizard at the scope step', async () => {
    const where = home();
    await click(q('[data-testid=template-sprint-health]'));
    await settle();
    expect(where()).toBe('/dashboards/new?scenario=sprint-health');
    expect(q('[data-testid=step-1]')!.getAttribute('aria-current')).toBe('step');
  });

  it('a sentence becomes a plan that says what it understood, and then a saved dashboard', async () => {
    const where = home();
    await typeInto(q<HTMLInputElement>('[data-testid=describe-input]'), 'what is blocked in the current sprint and who is overloaded');
    await click(q('[data-testid=describe-go]'));
    const plan = q('[data-testid=plan-card]')!;
    expect(plan.textContent).toContain('Blocked work');
    expect(plan.textContent).toContain('current sprint');
    expect(readDashboards()).toHaveLength(0); // nothing is created until it is confirmed
    await click(q('[data-testid=plan-create]'));
    await settle();
    const saved = readDashboards();
    expect(saved).toHaveLength(1);
    expect(saved[0].filters.sprint).toBe('current');
    expect(saved[0].widgets.map(w => w.type)).toEqual(expect.arrayContaining(['blocked', 'workload']));
    expect(where()).toBe(`/dashboards/${saved[0].id}`);
  });
});

describe('New dashboard wizard', () => {
  it('walks through four steps and creates the dashboard with the chosen widgets and filters', async () => {
    const where = home('/dashboards/new?scenario=team-workload');
    await settle();
    // step 2 (scope): pick a period
    await click(q('[data-testid=range-30d]'));
    await click(q('[data-testid=wizard-next]')); // focus
    await click(q('[data-testid=wizard-next]')); // widgets
    expect((q('[data-testid=pick-workload]') as HTMLInputElement).checked).toBe(true); // recommended for this goal
    expect((q('[data-testid=pick-cfd]') as HTMLInputElement).checked).toBe(false);
    await click(q('[data-testid=pick-cfd]'));
    await click(q('[data-testid=pick-bar-assignee]')); // untick a recommended one
    await typeInto(q<HTMLInputElement>('[data-testid=wizard-name]'), 'My team view');
    await click(q('[data-testid=wizard-create]'));
    await settle();
    const [d] = readDashboards();
    expect(d.name).toBe('My team view');
    expect(d.scenario).toBe('team-workload');
    expect(d.filters.range).toBe('30d');
    const types = d.widgets.map(w => w.type);
    expect(types).toContain('workload');
    expect(types).toContain('cfd');
    expect(d.widgets.some(w => w.entry === 'bar-assignee')).toBe(false);
    expect(where()).toBe(`/dashboards/${d.id}`);
  });

  it('shows a preview of the real widgets', async () => {
    home('/dashboards/new?scenario=my-work');
    await settle();
    expect(qa('[data-testid=wizard-preview] [data-testid=widget]').length).toBeGreaterThanOrEqual(8);
  });

  it('the Back button and the step buttons move between steps', async () => {
    home('/dashboards/new?scenario=executive');
    await settle();
    await click(q('[data-testid=step-3]'));
    expect(q('[data-testid=step-3]')!.getAttribute('aria-current')).toBe('step');
    await click(byText('button', /Back$/));
    expect(q('[data-testid=step-2]')!.getAttribute('aria-current')).toBe('step');
  });
});
