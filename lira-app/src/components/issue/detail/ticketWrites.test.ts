import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '../../../types/issue';

const m = vi.hoisted(() => ({
  updateIssue: vi.fn(async (..._a: unknown[]) => {}), createIssue: vi.fn(async (..._a: unknown[]) => 1), getNextIssueKey: vi.fn(async (..._a: unknown[]) => 'AAA-9'),
  syncBlockLinks: vi.fn(async (..._a: unknown[]) => {}), syncLinks: vi.fn(async (..._a: unknown[]) => {}), space: undefined as unknown,
  labelsUnder: vi.fn(async (t: { labels?: string[] }, _parentId?: number) => ({ labels: t.labels ?? [], inheritedLabels: [] as string[] })),
  propagateLabels: vi.fn(async (..._a: unknown[]) => {}),
}));
vi.mock('../../../hooks/useIssues', () => ({ updateIssue: m.updateIssue, createIssue: m.createIssue, getNextIssueKey: m.getNextIssueKey }));
vi.mock('./blockLinks', () => ({ syncBlockLinks: m.syncBlockLinks, syncLinks: m.syncLinks }));
vi.mock('../../../services/labelPropagation', () => ({ labelsUnder: m.labelsUnder, propagateLabels: m.propagateLabels }));
vi.mock('../../../db/db', () => ({ db: { spaces: { get: async () => m.space } } }));

import { adoptChildren, commitTicket, createChildOf } from './ticketWrites';

beforeEach(() => { vi.clearAllMocks(); m.space = { id: 1, key: 'AAA' }; });

const t = (over: Partial<Issue> = {}) => ({ id: 5, key: 'AAA-5', title: 'Old', description: '', spaceId: 1, labels: [], status: 'todo', priority: 'medium', type: 'task', ...over }) as unknown as Issue;

describe('commitTicket', () => {
  it('saves the fields, then syncs block links from the old blockers to the new ones', async () => {
    await commitTicket({ local: t({ blocked: true, blockedByIds: [2] } as never), original: t({ blocked: true, blockedByIds: [1] } as never), title: 'New', description: 'd', detachChildren: false, children: [] });
    expect(m.updateIssue).toHaveBeenCalledTimes(1);
    expect(m.updateIssue).toHaveBeenCalledWith(5, expect.objectContaining({ title: 'New' }));
    expect(m.syncBlockLinks).toHaveBeenCalledWith(5, [1], [2]);
  });
  it('keeps the other end of every link in step, from the links before to the links after', async () => {
    const before = [{ id: 'a', issueId: 2, linkType: 'relates_to' }];
    const after = [{ id: 'b', issueId: 3, linkType: 'blocks' }];
    await commitTicket({ local: t({ linkedIssues: after } as never), original: t({ linkedIssues: before } as never), title: 'x', description: '', detachChildren: false, children: [] });
    expect(m.syncLinks).toHaveBeenCalledWith(5, before, after);
  });
  it('saves the labels the ticket has under its parent, then passes its labels down', async () => {
    m.labelsUnder.mockResolvedValueOnce({ labels: ['mine', 'aws'], inheritedLabels: ['aws'] });
    await commitTicket({ local: t({ parentId: 3, labels: ['mine'] }), original: t(), title: 'x', description: '', detachChildren: false, children: [] });
    expect(m.labelsUnder).toHaveBeenCalledWith(expect.objectContaining({ labels: ['mine'] }), 3);
    expect(m.updateIssue).toHaveBeenCalledWith(5, expect.objectContaining({ labels: ['mine', 'aws'], inheritedLabels: ['aws'] }));
    expect(m.propagateLabels).toHaveBeenCalledWith(5);
    expect(m.propagateLabels.mock.invocationCallOrder[0]).toBeGreaterThan(m.updateIssue.mock.invocationCallOrder[0]); // after the ticket itself is saved
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
    expect(m.propagateLabels).toHaveBeenCalledWith(5); // the new child takes the labels of its parent
  });
  it('does nothing without an id, a space id, or when the space is gone', async () => {
    await createChildOf(t({ id: undefined }), 'x', 'task');
    await createChildOf(t({ spaceId: undefined as never }), 'x', 'task');
    m.space = undefined;
    await createChildOf(t(), 'x', 'task');
    expect(m.createIssue).not.toHaveBeenCalled();
  });
});

describe('adoptChildren', () => {
  it('puts each ticket under the parent, with its epic and name, then passes the labels down', async () => {
    const epic = t({ id: 5, type: 'epic', title: 'Platform' });
    await adoptChildren(epic, [t({ id: 6 }), t({ id: 7 })]);
    expect(m.updateIssue).toHaveBeenCalledWith(6, { parentId: 5, epicId: 5, epicLink: 'Platform' });
    expect(m.updateIssue).toHaveBeenCalledWith(7, { parentId: 5, epicId: 5, epicLink: 'Platform' });
    expect(m.propagateLabels).toHaveBeenCalledWith(5);
  });
  it('under a task the children keep the epic of that task', async () => {
    await adoptChildren(t({ id: 5, type: 'task', title: 'Build', epicId: 2 } as never), [t({ id: 6, type: 'subtask' })]);
    expect(m.updateIssue).toHaveBeenCalledWith(6, { parentId: 5, epicId: 2, epicLink: 'Build' });
  });
  it('never makes a ticket its own child, skips tickets without an id, and does nothing for an unsaved parent', async () => {
    await adoptChildren(t({ id: 5 }), [t({ id: 5 }), t({ id: undefined })]);
    expect(m.updateIssue).not.toHaveBeenCalled();
    await adoptChildren(t({ id: undefined }), [t({ id: 6 })]);
    expect(m.updateIssue).not.toHaveBeenCalled();
    expect(m.propagateLabels).toHaveBeenCalledTimes(1);
  });
});
