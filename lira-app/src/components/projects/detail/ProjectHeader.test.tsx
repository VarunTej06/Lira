import { afterEach, describe, expect, it, vi } from 'vitest';
import { byText, cleanup, click, mount, q, qa } from '../../../test/render';
import type { DetailCtx } from './detailContext';

vi.mock('../../standup/StandupButton', () => ({ StandupButton: () => <button data-testid="standup">Standup</button> }));

import { ProjectHeader } from './ProjectHeader';

afterEach(cleanup);

const project = { id: 'p1', name: 'Lira Core', key: 'LCORE', description: 'The core platform', lead: 'Varun Tej', spaceId: 1, createdAt: '2026-11-02T10:00:00Z' };
const space = { id: 1, key: 'LIRA', name: 'Lira', icon: 'L', color: '#336699' };

function show(over: Record<string, unknown> = {}) {
  const h = { onBack: vi.fn(), onAddIssue: vi.fn(), onSwitchToSpace: vi.fn(), setActiveTab: vi.fn() };
  const ctx = { project, space, stats: { total: 7 }, projectInitials: 'LC', activeTab: 'overview', ...h, ...over } as unknown as DetailCtx;
  mount(<ProjectHeader {...ctx} />);
  return h;
}
const tabs = () => qa('button').filter(b => /^(Overview|Board|Tickets|Sprints|Technical Details|Settings)/.test(b.textContent?.trim() ?? '') && b.className.includes('border-b-2'));
const tab = (label: string) => tabs().find(b => b.textContent?.trim().startsWith(label))!;

describe('ProjectHeader', () => {
  describe('top bar', () => {
    it('goes back to all projects', async () => {
      const h = show();
      await click(byText('button', /All Projects/));
      expect(h.onBack).toHaveBeenCalled();
    });

    it('shows the project in the breadcrumb and as the title', () => {
      show();
      expect(qa('span').filter(s => s.textContent === 'Lira Core')).toHaveLength(1);
      expect(q('h1')!.textContent).toBe('Lira Core');
    });

    it('offers Create Issue (as To Do) only when it can', async () => {
      const h = show();
      await click(byText('button', /Create Issue/));
      expect(h.onAddIssue).toHaveBeenCalledWith('todo');
      cleanup();
      show({ onAddIssue: undefined });
      expect(byText('button', /Create Issue/)).toBeUndefined();
    });
  });

  describe('banner', () => {
    it('shows the initials, key and description', () => {
      show();
      expect(document.body.textContent).toContain('LC');
      expect(document.body.textContent).toContain('LCORE');
      expect(document.body.textContent).toContain('The core platform');
    });

    it('draws the project icon in the button colour of the theme, not in a colour of its own', () => {
      show();
      const icon = qa('div').find(d => d.textContent === 'LC')!;
      expect(icon.className).toContain('bg-lira-blue text-lira-on-blue');
      expect(icon.getAttribute('style')).toBeNull();
    });

    it('shows the category only when there is one', () => {
      show({ project: { ...project, category: 'Platform' } });
      expect(document.body.textContent).toContain('Platform');
      cleanup();
      show();
      expect(document.body.textContent).not.toContain('Platform');
    });

    it('has a fallback description', () => {
      show({ project: { ...project, description: '' } });
      expect(document.body.textContent).toContain('Enterprise-grade technical project workspace.');
    });

    it('shows the lead, with a fallback name', () => {
      show();
      expect(document.body.textContent).toContain('Lead: Varun Tej');
      cleanup();
      show({ project: { ...project, lead: '' } });
      expect(document.body.textContent).toContain('Lead: Varun Tej');
    });

    it('says when it was created, or "recently" without a date', () => {
      show();
      expect(document.body.textContent).toMatch(/Created .*2026/);
      cleanup();
      show({ project: { ...project, createdAt: '' } });
      expect(document.body.textContent).toContain('Created recently');
    });

    it('links to the space, and says so when there is none', async () => {
      const h = show();
      await click(byText('button', /Space:/));
      expect(h.onSwitchToSpace).toHaveBeenCalledWith(1);
      cleanup();
      show({ space: undefined });
      expect(document.body.textContent).toContain('No linked space');
    });

    it('has the standup button', () => {
      show();
      expect(q('[data-testid="standup"]')).not.toBeNull();
    });
  });

  describe('tabs', () => {
    it('has six, in order', () => {
      show();
      expect(tabs().map(b => b.textContent?.trim().replace(/\d+$/, ''))).toEqual(['Overview', 'Board', 'Tickets', 'Sprints', 'Technical Details', 'Settings']);
    });

    it('highlights only the active one', () => {
      show({ activeTab: 'tickets' });
      expect(tab('Tickets').className).toContain('text-lira-blue');
      expect(tab('Board').className).not.toContain('border-lira-blue');
      expect(tab('Overview').className).toContain('text-lira-muted');
    });

    it.each([['Overview', 'overview'], ['Board', 'board'], ['Tickets', 'tickets'], ['Sprints', 'sprints'], ['Technical Details', 'technical'], ['Settings', 'settings']])('%s opens %s', async (label, id) => {
      const h = show();
      await click(tab(label));
      expect(h.setActiveTab).toHaveBeenCalledWith(id);
    });

    it('shows the number of tickets on Board and Tickets only', () => {
      show();
      expect(tab('Board').textContent).toContain('7');
      expect(tab('Tickets').textContent).toContain('7');
      expect(tab('Overview').textContent).not.toMatch(/\d/);
      expect(tab('Sprints').textContent).not.toMatch(/\d/);
    });
  });
});
