import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { byText, cleanup, click, mount, qa } from '../../test/render';
import { ReportsModal } from './ReportsModal';

afterEach(cleanup);

let n = 0;
const t = (status: string, priority = 'medium', over: Partial<Issue> = {}) => ({ id: ++n, key: `A-${n}`, status, priority, ...over }) as unknown as Issue;
const space = { id: 1, name: 'Alpha' } as Space;

function show(issues: Issue[], over: Record<string, unknown> = {}) {
  const onClose = vi.fn();
  mount(<ReportsModal isOpen onClose={onClose} space={space} issues={issues} {...over} />);
  return onClose;
}
const kpis = () => qa('.shadow-xs').map(e => e.textContent);

describe('ReportsModal', () => {
  it('is empty while closed', () => {
    mount(<ReportsModal isOpen={false} onClose={() => {}} space={space} issues={[]} />);
    expect(document.body.textContent).not.toContain('Reports & Analytics');
  });
  it('is titled with the space, or Workspace', () => {
    show([]);
    expect(document.body.textContent).toContain('Reports & Analytics · Alpha');
    cleanup();
    show([], { space: undefined });
    expect(document.body.textContent).toContain('Reports & Analytics · Workspace');
    expect(document.body.textContent).toContain('in current space');
  });
  it('says there is nothing to chart with no issues, and has zero rates', () => {
    show([]);
    expect(document.body.textContent).toContain('No issues on board');
    expect(document.body.textContent).toContain('0% completed');
    expect(document.body.textContent).toContain('0% points delivered');
    expect(qa('svg[viewBox="0 0 100 100"] circle')).toHaveLength(0);
  });
  it('shows totals, done, in progress and points with their rates', () => {
    show([t('done', 'high', { storyPoints: 3 }), t('inprogress', 'highest', { storyPoints: 2 }), t('todo'), t('backlog')]);
    const text = kpis().join('|');
    expect(text).toContain('Total Work4');
    expect(text).toContain('Done1');
    expect(text).toContain('25% completed');
    expect(text).toContain('25% active in flight');
    expect(text).toContain('3 / 5');
    expect(text).toContain('60% points delivered');
    expect(document.body.textContent).toContain('Aggregated from 4 issues in Alpha');
  });
  it('counts high and highest as high priority and shows the flag only when there are some', () => {
    show([t('todo', 'high'), t('todo', 'highest'), t('todo', 'low')]);
    expect(document.body.textContent).toContain('2 high priority');
    cleanup();
    show([t('todo', 'low')]);
    expect(document.body.textContent).not.toContain('high priority');
  });
  it('draws one donut slice per status that has issues, plus the track', () => {
    show([t('done'), t('done'), t('todo')]);
    expect(qa('svg[viewBox="0 0 100 100"] circle')).toHaveLength(3);
    expect(document.body.textContent).toContain('Status Ratio Donut');
    expect(document.body.textContent).toContain('67%');
  });
  it('lists the five bars with counts and shares, including the blocked flag', () => {
    show([t('done'), t('todo', 'medium', { blocked: true } as never), t('todo')]);
    const text = document.body.textContent!;
    expect(text).toContain('Blocked (flagged)');
    expect(text).toMatch(/Blocked \(flagged\)1 \(33%\)/);
    expect(text).toMatch(/To Do2 \(67%\)/);
  });
  it('switches to the priority view', async () => {
    show([t('todo', 'high'), t('todo', 'low')]);
    await click(byText('button', /Priority Distribution/));
    expect(document.body.textContent).toContain('Total Items');
    expect(document.body.textContent).toMatch(/Highest0 \(0%\)/);
    expect(document.body.textContent).toMatch(/High1 \(50%\)/);
    expect(qa('svg[viewBox="0 0 100 100"] circle')).toHaveLength(3);
    await click(byText('button', /Status Breakdown/));
    expect(document.body.textContent).toContain('Complete');
  });
  it('writes a progress note by completion rate: 75 and over, 40 and over, below', () => {
    show([t('done'), t('done'), t('done'), t('todo')]);
    expect(document.body.textContent).toContain('Excellent velocity!');
    cleanup();
    show([t('done'), t('todo')]);
    expect(document.body.textContent).toContain('Steady progression.');
    cleanup();
    show([t('todo'), t('todo')]);
    expect(document.body.textContent).toContain('Early sprint phase.');
  });
  it('closes with Done', async () => {
    const onClose = show([]);
    await click(byText('button', 'Done'));
    expect(onClose).toHaveBeenCalled();
  });
});
