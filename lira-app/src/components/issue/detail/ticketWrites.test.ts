import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '../../../types/issue';

const m = vi.hoisted(() => ({
  updateIssue: vi.fn(async (..._a: unknown[]) => {}), createIssue: vi.fn(async (..._a: unknown[]) => 1), getNextIssueKey: vi.fn(async (..._a: unknown[]) => 'AAA-9'),
  syncBlockLinks: vi.fn(async (..._a: unknown[]) => {}), space: undefined as unknown,
}));
vi.mock('../../../hooks/useIssues', () => ({ updateIssue: m.updateIssue, createIssue: m.createIssue, getNextIssueKey: m.getNextIssueKey }));
vi.mock('./blockLinks', () => ({ syncBlockLinks: m.syncBlockLinks }));
vi.mock('../../../db/db', () => ({ db: { spaces: { get: async () => m.space } } }));

import { commitTicket, createChildOf } from './ticketWrites';

beforeEach(() => { vi.clearAllMocks(); m.space = { id: 1, key: 'AAA' }; });

const t = (over: Partial<Issue> = {}) => ({ id: 5, key: 'AAA-5', title: 'Old', description: '', spaceId: 1, labels: [], status: 'todo', priority: 'medium', type: 'task', ...over }) as unknown as Issue;

describe('commitTicket', () => {
  it('saves the fields, then syncs block links from the old blockers to the new ones', async () => {
    await commitTicket({ local: t({ blocked: true, blockedByIds: [2] } as never), original: t({ blocked: true, blockedByIds: [1] } as never), title: 'New', description: 'd', detachChildren: false, children: [] });
    expect(m.updateIssue).toHaveBeenCalledTimes(1);
    expect(m.updateIssue).toHaveBeenCalledWith(5, expect.objectContaining({ title: 'New' }));
    expect(m.syncBlockLinks).toHaveBeenCalledWith(5, [1], [2]);
  });
  it('treats an unblocked ticket as having no blockers on either side', async () => {
    await commitTicket({ local: t({ blocked: false, blockedByIds: [2] } as never), original: t({ blocked: false, blockedByIds: [1] } as never), title: 'x', description: '', detachChildren: false, children: [] });
    expect(m.syncBlockLinks).toHaveBeenCalledWith(5, [], []);
  });
  it('copes with no original', async () => {
    await commitTicket({ local: t(), original: null, title: 'x', description: '', detachChildren: false, children: [] });
    expect(m.syncBlockLinks).toHaveBeenCalledWith(5, [], []);
  });
  it('detaches children before saving when asked, skipping ones without an id', async () => {
    await commitTicket({ local: t(), original: t(), title: 'x', description: '', detachChildren: true, children: [t({ id: 6 }), t({ id: undefined })] });
    expect(m.updateIssue).toHaveBeenNthCalledWith(1, 6, { parentId: undefined, epicId: undefined, epicLink: undefined });
    expect(m.updateIssue).toHaveBeenCalledTimes(2);
    expect(m.updateIssue.mock.calls[1][0]).toBe(5);
  });
  it('leaves children alone otherwise', async () => {
    await commitTicket({ local: t(), original: t(), title: 'x', description: '', detachChildren: false, children: [t({ id: 6 })] });
    expect(m.updateIssue).toHaveBeenCalledTimes(1);
  });
});

describe('createChildOf', () => {
  it('creates a To Do child under the parent with the next key and the parent\'s assignee', async () => {
    await createChildOf(t({ assignee: 'Varun', assigneeInitials: 'VY' } as never), 'Do it', 'subtask');
    expect(m.getNextIssueKey).toHaveBeenCalledWith('AAA');
    const made = (m.createIssue.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(made).toMatchObject({ title: 'Do it', type: 'subtask', status: 'todo', key: 'AAA-9', parentId: 5, spaceId: 1 });
  });
  it('does nothing without an id, a space id, or when the space is gone', async () => {
    await createChildOf(t({ id: undefined }), 'x', 'task');
    await createChildOf(t({ spaceId: undefined as never }), 'x', 'task');
    m.space = undefined;
    await createChildOf(t(), 'x', 'task');
    expect(m.createIssue).not.toHaveBeenCalled();
  });
});
