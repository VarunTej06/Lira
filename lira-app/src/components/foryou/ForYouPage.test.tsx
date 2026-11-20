import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, mount } from '../../test/render';
import { ForYouPage } from './ForYouPage';

afterEach(cleanup);

const noop = vi.fn();
const space = { id: 1, key: 'LIRA', name: 'Lira', icon: 'L', color: '#336699' };
const issue = {
  id: 1, key: 'LIRA-1', spaceId: 1, title: 'A ticket', status: 'todo', priority: 'medium', type: 'task', assignee: 'VY',
  activity: [{ id: 'a1', type: 'update', description: 'changed the status', createdAt: '2026-11-01T10:00:00Z' }],
} as never;

describe('For you page', () => {
  it('has no "Recent activity" panel, even when tickets have activity', () => {
    mount(<ForYouPage spaces={[space] as never} issues={[issue]} projects={[]} onIssueClick={noop} onOpenSpace={noop} onOpenProject={noop} onOpenSprint={noop} onCreateIssue={noop} />);
    expect(document.body.textContent).not.toContain('Recent activity');
    expect(document.body.textContent).not.toContain('changed the status');
  });

  it('still shows the cards it keeps: projects and the stat tiles', () => {
    mount(<ForYouPage spaces={[space] as never} issues={[issue]} projects={[]} onIssueClick={noop} onOpenSpace={noop} onOpenProject={noop} onOpenSprint={noop} onCreateIssue={noop} />);
    expect(document.body.textContent).toContain('Projects');
    expect(document.body.textContent).toContain('Assigned to me');
  });
});
