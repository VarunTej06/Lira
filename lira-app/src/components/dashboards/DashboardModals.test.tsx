import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '../../types/issue';
import type { DashboardGoal, DashboardWidget } from '../../utils/dashboards/types';
import { byText, choose, cleanup, click, mount, q, qa, settle, typeInto, wait } from '../../test/render';

const snap = vi.hoisted(() => ({ files: vi.fn(async () => [] as { file: string; size: number; modified: string }[]) }));
vi.mock('../../utils/dashboards/snapshot', async orig => ({ ...(await orig<typeof import('../../utils/dashboards/snapshot')>()), listSnapshotFiles: snap.files }));

import { DrillModal, GoalsModal, SnapshotModal, WidgetGallery, WidgetSettings } from './DashboardModals';
import { CATALOG } from '../../utils/dashboards/catalog';
import { METRICS, LIST_META } from '../../utils/dashboards/metrics';
import { DEFAULT_SCHEDULE } from '../../utils/dashboards/snapshot';

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 10, 9, 0, 0)); snap.files.mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const FILTERS = { spaceIds: [], sprints: [], assignees: [], priorities: [], types: [], labels: [], range: 'all' } as never;
const widget = (over: Partial<DashboardWidget> = {}): DashboardWidget => ({ id: 'w1', type: 'stat', title: METRICS.open.label, config: { metric: 'open' }, ...over }) as DashboardWidget;
const ticket = (over: Partial<Issue> = {}) => ({ id: 1, key: 'AAA-1', title: 'One', type: 'task', status: 'todo', ...over }) as Issue;
const btn = (t: string | RegExp) => byText('button', t)!;

describe('WidgetGallery', () => {
  const show = (open = true) => {
    const h = { onClose: vi.fn(), onAdd: vi.fn() };
    const el = (o: boolean) => <WidgetGallery open={o} {...h} />;
    const m = mount(el(open));
    return { ...h, rerender: (o: boolean) => m.rerender(el(o)) };
  };
  it('renders nothing while closed', () => {
    show(false);
    expect(q('[data-testid="widget-gallery"]')).toBeNull();
  });
  it('lists every widget of the catalogue under its category', () => {
    show();
    expect(qa('[data-testid^="add-"]')).toHaveLength(CATALOG.length);
    expect(qa('section h3').length).toBeGreaterThan(1);
  });
  it('narrows by title, description or category, and says when nothing matches', async () => {
    show();
    await typeInto(q<HTMLInputElement>('input[aria-label="Search widgets"]'), 'burndown');
    const shown = qa('[data-testid^="add-"]').length;
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(CATALOG.length);
    await typeInto(q<HTMLInputElement>('input[aria-label="Search widgets"]'), 'zzzzqqq');
    expect(document.body.textContent).toContain('No widget matches.');
    expect(qa('section')).toHaveLength(0);
  });
  it('adds a widget, keeps the gallery open and ticks the one added', async () => {
    const h = show();
    const first = CATALOG[0];
    const b = q(`[data-testid="add-${first.id}"]`)!;
    expect(b.querySelector('svg.text-lira-muted')).not.toBeNull();
    await click(b);
    expect(h.onAdd).toHaveBeenCalledWith(first.id);
    expect(h.onClose).not.toHaveBeenCalled();
    expect(q(`[data-testid="add-${first.id}"]`)!.querySelector('svg.text-emerald-600')).not.toBeNull();
  });
  it('starts fresh when opened again', async () => {
    const h = show();
    await click(q(`[data-testid="add-${CATALOG[0].id}"]`));
    expect(q('svg.text-emerald-600')).not.toBeNull();
    await typeInto(q<HTMLInputElement>('input[aria-label="Search widgets"]'), 'burndown');
    await act(async () => { h.rerender(false); await wait(0); });
    await act(async () => { h.rerender(true); await wait(0); });
    await settle();
    expect(q<HTMLInputElement>('input[aria-label="Search widgets"]')!.value).toBe('');
    expect(qa('[data-testid^="add-"]')).toHaveLength(CATALOG.length);
    expect(q('svg.text-emerald-600')).toBeNull();
  });
  it('closes with Done', async () => {
    const h = show();
    await click(btn('Done'));
    expect(h.onClose).toHaveBeenCalled();
  });
});

describe('WidgetSettings', () => {
  const show = (w: DashboardWidget | null = widget()) => {
    const h = { onClose: vi.fn(), onSave: vi.fn() };
    mount(<WidgetSettings widget={w} dashboardFilters={FILTERS} issues={[]} spaces={[]} {...h} />);
    return h;
  };
  const save = async (h: { onSave: ReturnType<typeof vi.fn> }) => { await click(q('[data-testid="widget-settings-save"]')); return h.onSave.mock.calls.at(-1)![0] as DashboardWidget; };

  it('renders nothing without a widget', () => {
    show(null);
    expect(q('[data-testid="widget-settings-dialog"]')).toBeNull();
  });
  it('renames and saves, and cancel closes without saving', async () => {
    const h = show();
    await typeInto(q<HTMLInputElement>('#ws-title'), 'Open now');
    expect((await save(h)).title).toBe('Open now');
    await click(btn('Cancel'));
    expect(h.onClose).toHaveBeenCalled();
  });
  it('lets a stat pick what to count, and renames it only while it still has the default name', async () => {
    const h = show();
    await choose(q<HTMLSelectElement>('#ws-metric'), 'blocked');
    const saved = await save(h);
    expect(saved.config.metric).toBe('blocked');
    expect(saved.title).toBe(METRICS.blocked.label);
    cleanup();
    const h2 = show(widget({ title: 'My own title' }));
    await choose(q<HTMLSelectElement>('#ws-metric'), 'blocked');
    expect((await save(h2)).title).toBe('My own title');
  });
  it('lets a bar or donut pick the grouping and the measure', async () => {
    const h = show(widget({ type: 'bar', title: 'B', config: {} }));
    await choose(q<HTMLSelectElement>('#ws-group'), 'priority');
    await choose(q<HTMLSelectElement>('#ws-measure'), 'points');
    const saved = await save(h);
    expect(saved.config).toMatchObject({ groupBy: 'priority', measure: 'points' });
    cleanup();
    show(widget({ type: 'donut', title: 'D', config: {} }));
    expect(q('#ws-group')).not.toBeNull();
  });
  it('lets a list pick its tickets, and renames it only while it has a list name', async () => {
    const h = show(widget({ type: 'list', title: LIST_META.attention.label, config: { list: 'attention' } }));
    const other = Object.keys(LIST_META).find(k => k !== 'attention')!;
    await choose(q<HTMLSelectElement>('#ws-list'), other);
    const saved = await save(h);
    expect(saved.config.list).toBe(other);
    expect(saved.title).toBe(LIST_META[other as keyof typeof LIST_META].label);
    cleanup();
    const h2 = show(widget({ type: 'list', title: 'Custom', config: { list: 'attention' } }));
    await choose(q<HTMLSelectElement>('#ws-list'), other);
    expect((await save(h2)).title).toBe('Custom');
  });
  it('lets progress pick epic, project or sprint', async () => {
    const h = show(widget({ type: 'progress', title: 'P', config: {} }));
    expect(q<HTMLSelectElement>('#ws-prog')!.value).toBe('epic');
    await choose(q<HTMLSelectElement>('#ws-prog'), 'sprint');
    expect((await save(h)).config.progressBy).toBe('sprint');
  });
  it('limits "show at most" to 3 to 30, and falls back to 8 for a blank', async () => {
    const h = show(widget({ type: 'list', title: 'x', config: { list: 'attention' } }));
    await typeInto(q<HTMLInputElement>('#ws-limit'), '100');
    expect((await save(h)).config.limit).toBe(30);
    await typeInto(q<HTMLInputElement>('#ws-limit'), '1');
    expect((await save(h)).config.limit).toBe(3);
    await typeInto(q<HTMLInputElement>('#ws-limit'), '');
    expect((await save(h)).config.limit).toBe(8);
  });
  it('shows the limit for list, bar, progress, blocked and roadmap only', () => {
    for (const [type, has] of [['list', true], ['bar', true], ['progress', true], ['blocked', true], ['roadmap', true], ['stat', false], ['donut', false], ['trend', false]] as const) {
      show(widget({ type, config: {} } as Partial<DashboardWidget>));
      expect(!!q('#ws-limit')).toBe(has);
      cleanup();
    }
  });
  it('limits "weeks shown" to 4 to 26 for trend and throughput', async () => {
    const h = show(widget({ type: 'trend', title: 'T', config: {} }));
    await typeInto(q<HTMLInputElement>('#ws-weeks'), '99');
    expect((await save(h)).config.weeks).toBe(26);
    await typeInto(q<HTMLInputElement>('#ws-weeks'), '2');
    expect((await save(h)).config.weeks).toBe(4);
    cleanup();
    show(widget({ type: 'throughput', title: 'T', config: {} }));
    expect(q('#ws-weeks')).not.toBeNull();
  });
  it('follows the dashboard filters unless the widget has its own', async () => {
    const h = show();
    expect(document.body.textContent).toContain('It follows the filters at the top of the dashboard.');
    await click(q('[data-testid="own-filters"]'));
    expect(document.body.textContent).not.toContain('It follows the filters');
    expect((await save(h)).filters).toBeDefined();
    await click(q('[data-testid="own-filters"]'));
    expect((await save(h)).filters).toBeUndefined();
  });
  it('shows another widget\'s settings when the widget changes', async () => {
    const h = { onClose: vi.fn(), onSave: vi.fn() };
    const el = (w: DashboardWidget) => <WidgetSettings widget={w} dashboardFilters={FILTERS} issues={[]} spaces={[]} {...h} />;
    const m = mount(el(widget({ title: 'First' })));
    m.rerender(el(widget({ id: 'w2', title: 'Second' })));
    await settle();
    expect(q<HTMLInputElement>('#ws-title')!.value).toBe('Second');
  });
});

describe('GoalsModal', () => {
  const goals = (): DashboardGoal[] => [{ id: 'g1', metric: 'blocked', op: 'above', value: 3 }];
  const show = (list = goals(), open = true) => {
    const h = { onClose: vi.fn(), onSave: vi.fn() };
    const el = (o: boolean, l: DashboardGoal[]) => <GoalsModal open={o} goals={l} {...h} />;
    const m = mount(el(open, list));
    return { ...h, rerender: (o: boolean, l = list) => m.rerender(el(o, l)) };
  };
  const saved = () => q('[data-testid="goals-save"]')!;

  it('shows each alert and an empty note', () => {
    show();
    expect(qa('[data-testid="goal-row"]')).toHaveLength(1);
    cleanup();
    show([]);
    expect(document.body.textContent).toContain('No alerts yet.');
  });
  it('edits the metric, the direction and the limit (never below 0)', async () => {
    const h = show();
    await choose(q<HTMLSelectElement>('select[aria-label="Number"]'), 'open');
    await choose(q<HTMLSelectElement>('select[aria-label="More or fewer"]'), 'below');
    await typeInto(q<HTMLInputElement>('input[aria-label="Limit"]'), '-5');
    await click(saved());
    expect(h.onSave).toHaveBeenCalledWith([{ id: 'g1', metric: 'open', op: 'below', value: 0 }]);
  });
  it('adds an alert for Blocked above 3, and removes one', async () => {
    const h = show();
    await click(q('[data-testid="add-goal"]'));
    expect(qa('[data-testid="goal-row"]')).toHaveLength(2);
    await click(qa('button[aria-label="Remove alert"]')[0]);
    await click(saved());
    expect(h.onSave.mock.calls[0][0]).toEqual([expect.objectContaining({ metric: 'blocked', op: 'above', value: 3 })]);
  });
  it('cancel closes without saving', async () => {
    const h = show();
    await click(btn('Cancel'));
    expect(h.onClose).toHaveBeenCalled();
    expect(h.onSave).not.toHaveBeenCalled();
  });
  it('drops unsaved edits when opened again', async () => {
    const h = show();
    await click(q('[data-testid="add-goal"]'));
    await act(async () => { h.rerender(false); await wait(0); });
    await act(async () => { h.rerender(true); await wait(0); });
    await settle();
    expect(qa('[data-testid="goal-row"]')).toHaveLength(1);
  });
});

describe('SnapshotModal', () => {
  const show = (over: Record<string, unknown> = {}) => {
    const h = { onClose: vi.fn(), onSchedule: vi.fn(), onTakeNow: vi.fn(async () => 'snap-1.md' as string | undefined), onDownload: vi.fn() };
    mount(<SnapshotModal open {...h} {...over} />);
    return h;
  };
  it('starts from the default schedule when there is none', () => {
    show();
    expect(q<HTMLInputElement>('[data-testid="snapshot-enabled"]')!.checked).toBe(DEFAULT_SCHEDULE.enabled);
  });
  it('turns the weekly snapshot on and off', async () => {
    const h = show({ schedule: { ...DEFAULT_SCHEDULE, enabled: false } });
    await click(q('[data-testid="snapshot-enabled"]'));
    expect(h.onSchedule).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });
  it('picks the day and the hour', async () => {
    const h = show({ schedule: { ...DEFAULT_SCHEDULE, enabled: true } });
    await choose(q<HTMLSelectElement>('select[aria-label="Day"]'), '3');
    expect(h.onSchedule).toHaveBeenLastCalledWith(expect.objectContaining({ day: 3 }));
    await choose(q<HTMLSelectElement>('select[aria-label="Hour"]'), '17');
    expect(h.onSchedule).toHaveBeenLastCalledWith(expect.objectContaining({ hour: 17 }));
    expect(q<HTMLSelectElement>('select[aria-label="Hour"]')!.options).toHaveLength(24);
  });
  it('shows the next snapshot, and the last one taken, only when it is on', () => {
    show({ schedule: { ...DEFAULT_SCHEDULE, enabled: true, lastRun: '2026-11-03T09:00:00.000Z' } });
    expect(document.body.textContent).toContain('Next snapshot:');
    expect(document.body.textContent).toContain('last taken');
    cleanup();
    show({ schedule: { ...DEFAULT_SCHEDULE, enabled: false } });
    expect(document.body.textContent).not.toContain('Next snapshot:');
    expect(q('select[aria-label="Day"]')!.parentElement!.className).toContain('opacity-50');
  });
  it('takes a snapshot now and says where it went, then refreshes the list', async () => {
    const h = show();
    await click(q('[data-testid="snapshot-now"]'));
    expect(h.onTakeNow).toHaveBeenCalled();
    expect(q('[data-testid="snapshot-msg"]')!.textContent).toBe('Saved snap-1.md');
    expect(snap.files).toHaveBeenCalledTimes(2);
  });
  it('suggests Download when the file could not be saved', async () => {
    show({ onTakeNow: vi.fn(async () => undefined) });
    await click(q('[data-testid="snapshot-now"]'));
    expect(q('[data-testid="snapshot-msg"]')!.textContent).toContain('Could not save the file. Use Download instead.');
  });
  it('downloads and closes', async () => {
    const h = show();
    await click(btn(/Download Markdown/)); await click(btn('Close'));
    expect(h.onDownload).toHaveBeenCalled(); expect(h.onClose).toHaveBeenCalled();
  });
  it('lists saved snapshots, or says there are none', async () => {
    show();
    await settle();
    expect(document.body.textContent).toContain('None yet.');
    cleanup();
    snap.files.mockResolvedValueOnce([{ file: 'a b.md', size: 3, modified: '2026-11-03T09:00:00.000Z' }]);
    show();
    await settle();
    const link = q<HTMLAnchorElement>('[data-testid="snapshot-files"] a')!;
    expect(link.getAttribute('href')).toBe('/api/snapshot?file=a%20b.md');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
});

describe('DrillModal', () => {
  it('renders nothing without a drill', () => {
    mount(<DrillModal drill={null} onClose={() => {}} onOpen={() => {}} />);
    expect(q('[data-testid="drill-dialog"]')).toBeNull();
  });
  it('shows the title with the count and says when there are no tickets', () => {
    mount(<DrillModal drill={{ title: 'Blocked', issues: [] }} onClose={() => {}} onOpen={() => {}} />);
    expect(document.body.textContent).toContain('Blocked (0)');
    expect(document.body.textContent).toContain('No tickets.');
  });
  it('lists the tickets, marks blocked ones and opens one on click', async () => {
    const onOpen = vi.fn();
    const a = ticket(); const b = ticket({ id: 2, key: 'AAA-2', title: 'Two', blocked: true });
    mount(<DrillModal drill={{ title: 'All', issues: [a, b] }} onClose={() => {}} onOpen={onOpen} />);
    expect(document.body.textContent).toContain('All (2)');
    expect(qa('[data-testid="drill-dialog"] li')).toHaveLength(2);
    expect(qa('[data-testid="drill-dialog"] li')[0].textContent).not.toContain('Blocked');
    expect(qa('[data-testid="drill-dialog"] li')[1].textContent).toContain('Blocked');
    await click(qa('[data-testid="drill-dialog"] li button')[1]);
    expect(onOpen).toHaveBeenCalledWith(b);
  });
});
