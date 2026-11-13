import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect } from 'react';
import type { Comment, Issue } from '../../../types/issue';
import { cleanup, mount, settle } from '../../../test/render';

const mocks = vi.hoisted(() => ({
  updateIssue: vi.fn<(id: number, changes: unknown) => Promise<void>>(async () => {}),
  deleteIssue: vi.fn<(id: number) => Promise<void>>(async () => {}),
  createIssue: vi.fn<(issue: unknown) => Promise<number>>(async () => 1),
  syncBlockLinks: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
  syncLinks: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
  propagateLabels: vi.fn<(id: number) => Promise<void>>(async () => {}),
  chooseDialog: vi.fn<(o: unknown) => Promise<'confirm' | 'alt' | null>>(async () => 'confirm'),
  confirmDialog: vi.fn<(o: unknown) => Promise<boolean>>(async () => true),
  alertDialog: vi.fn<(o: unknown) => Promise<void>>(async () => {}),
  notifySaved: vi.fn<(text?: string) => void>(),
  children: [] as unknown[],
  spaceIssues: [] as unknown[],
  all: [] as unknown[],
}));

vi.mock('../../../hooks/useIssues', () => ({
  updateIssue: mocks.updateIssue, deleteIssue: mocks.deleteIssue, createIssue: mocks.createIssue,
  getNextIssueKey: async () => 'LIRA-99',
  useChildIssues: () => mocks.children, useIssue: () => undefined, useIssuesBySpace: () => mocks.spaceIssues, useAllIssues: () => mocks.all,
}));
vi.mock('../../../db/db', () => ({ db: { spaces: { get: async () => ({ id: 1, key: 'LIRA' }) } } }));
vi.mock('./blockLinks', () => ({ syncBlockLinks: mocks.syncBlockLinks, syncLinks: mocks.syncLinks }));
vi.mock('../../../services/labelPropagation', () => ({ labelsUnder: async (t: { labels?: string[] }) => ({ labels: t.labels ?? [], inheritedLabels: [] }), propagateLabels: mocks.propagateLabels }));
vi.mock('../../common/dialogStore', () => ({ confirmDialog: mocks.confirmDialog, alertDialog: mocks.alertDialog, chooseDialog: mocks.chooseDialog }));
vi.mock('../../common/savedToastStore', () => ({ notifySaved: mocks.notifySaved }));

import { useIssueDetail, type IssueDetailState } from './useIssueDetail';

const ticket = (over: Partial<Issue> = {}): Issue => ({
  id: 10, spaceId: 1, key: 'LIRA-10', title: 'Fix the board', description: 'Old text', type: 'task', status: 'todo', priority: 'medium',
  reporter: 'A', reporterInitials: 'A', labels: [], subtasks: [], comments: [], activity: [], attachments: [], linkedIssues: [],
  rank: 1, watchers: [], createdAt: new Date(2026, 10, 1), updatedAt: new Date(2026, 10, 2), ...over,
} as Issue);

beforeEach(() => {
  Object.values(mocks).forEach(m => { if (typeof m === 'function') (m as ReturnType<typeof vi.fn>).mockClear(); });
  mocks.confirmDialog.mockImplementation(async () => true);
  mocks.children = []; mocks.spaceIssues = []; mocks.all = [];
});
afterEach(cleanup);

const holder: { s: IssueDetailState | null } = { s: null };
function Probe({ issue, onClose, parentIssue }: { issue: Issue | null; onClose: () => void; parentIssue?: Issue | null }) {
  const s = useIssueDetail({ issue, onClose, parentIssue });
  useEffect(() => { holder.s = s; });
  return null;
}
const state = () => holder.s!;

async function open(issue: Issue | null = ticket(), onClose = vi.fn()) {
  holder.s = null;
  const view = mount(<Probe issue={issue} onClose={onClose} />);
  await settle();
  return { onClose, view, rerender: async (next: Issue | null) => { view.rerender(<Probe issue={next} onClose={onClose} />); await settle(); } };
}
const run = async (fn: () => unknown) => { await act(async () => { await fn(); }); await settle(0); };

describe('useIssueDetail', () => {
  describe('the draft', () => {
    it('starts as a copy of the ticket with nothing changed', async () => {
      await open();
      expect(state().local).toMatchObject({ id: 10, title: 'Fix the board' });
      expect(state().titleVal).toBe('Fix the board');
      expect(state().descVal).toBe('Old text');
      expect(state().dirty).toBe(false);
    });

    it('has nothing to show without a ticket', async () => {
      await open(null);
      expect(holder.s).toBeNull();
    });

    it('is changed, not the saved ticket, when something is edited', async () => {
      const t = ticket();
      await open(t);
      await run(() => state().patch({ priority: 'high' }));
      expect(state().local!.priority).toBe('high');
      expect(t.priority).toBe('medium');
      expect(state().dirty).toBe(true);
      expect(mocks.updateIssue).not.toHaveBeenCalled();
    });

    it('is changed by the title and the description too', async () => {
      await open();
      await run(() => state().setTitleVal('New title'));
      expect(state().dirty).toBe(true);
      await run(() => state().setTitleVal('Fix the board'));
      expect(state().dirty).toBe(false);
      await run(() => state().setDescVal('Other text'));
      expect(state().dirty).toBe(true);
    });

    it('a title with only extra spaces is not a change', async () => {
      await open();
      await run(() => state().setTitleVal('  Fix the board  '));
      expect(state().dirty).toBe(false);
    });

    it('starts again when another ticket is opened', async () => {
      const { rerender } = await open();
      await run(() => state().patch({ priority: 'high' }));
      await rerender(ticket({ id: 11, key: 'LIRA-11', title: 'Other' }));
      expect(state().local).toMatchObject({ id: 11, priority: 'medium' });
      expect(state().titleVal).toBe('Other');
      expect(state().dirty).toBe(false);
    });

    it('keeps the draft but takes the new comments when they change on the saved ticket', async () => {
      const { rerender } = await open();
      await run(() => state().patch({ priority: 'high' }));
      const c = { id: 'c1', content: 'hi', author: 'A', authorInitials: 'A', createdAt: new Date() } as Comment;
      await rerender(ticket({ comments: [c] }));
      expect(state().local!.comments).toHaveLength(1);
      expect(state().local!.priority).toBe('high');
    });
  });

  describe('saving', () => {
    it('writes the edited fields, links the blockers, shows "saved" and closes', async () => {
      const { onClose } = await open();
      await run(() => state().patch({ priority: 'high', labels: ['a'] }));
      await run(() => state().setTitleVal('  New title '));
      await run(() => state().handleSaveChanges());
      const [id, changes] = mocks.updateIssue.mock.calls[0] as [number, Record<string, unknown>];
      expect(id).toBe(10);
      expect(changes).toMatchObject({ title: 'New title', description: 'Old text', priority: 'high', labels: ['a'] });
      expect(changes.updatedAt).toBeInstanceOf(Date);
      expect(mocks.syncBlockLinks).toHaveBeenCalledWith(10, [], []);
      expect(mocks.notifySaved).toHaveBeenCalledWith('Changes saved');
      expect(onClose).toHaveBeenCalled();
    });

    it('with nothing changed just closes, and does not claim anything was saved', async () => {
      const { onClose } = await open();
      await run(() => state().handleSaveChanges());
      expect(mocks.updateIssue).not.toHaveBeenCalled();
      expect(mocks.notifySaved).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('refuses an empty title', async () => {
      const { onClose } = await open();
      await run(() => state().setTitleVal('   '));
      await run(() => state().handleSaveChanges());
      expect(mocks.alertDialog).toHaveBeenCalledWith(expect.objectContaining({ title: 'Title needed' }));
      expect(mocks.updateIssue).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('closing', () => {
    it('closes at once when nothing is changed', async () => {
      const { onClose } = await open();
      await run(() => state().onClose());
      expect(mocks.confirmDialog).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('asks first when there are unsaved changes, and stays open if the person keeps editing', async () => {
      const { onClose } = await open();
      await run(() => state().patch({ priority: 'high' }));
      mocks.confirmDialog.mockImplementation(async () => false);
      await run(() => state().onClose());
      expect(mocks.confirmDialog).toHaveBeenCalledWith(expect.objectContaining({ title: 'Discard changes?' }));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('closes when the person agrees to discard', async () => {
      const { onClose } = await open();
      await run(() => state().patch({ priority: 'high' }));
      await run(() => state().onClose());
      expect(onClose).toHaveBeenCalled();
    });

    it('Escape does the same as the close button', async () => {
      const { onClose } = await open();
      await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
      await settle(0);
      expect(onClose).toHaveBeenCalled();
    });

    it('stops the page behind from scrolling while open, and gives the scroll back', async () => {
      const { view } = await open();
      expect(document.body.style.overflow).toBe('hidden');
      view.unmount();
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('type', () => {
    it('does nothing for the type it already has', async () => {
      await open();
      await run(() => state().handleTypeChange('task'));
      expect(state().dirty).toBe(false);
    });

    it('records the change in the history', async () => {
      await open();
      await run(() => state().handleTypeChange('bug'));
      expect(state().local!.type).toBe('bug');
      expect(state().local!.activity[0]).toMatchObject({ type: 'field_change', oldValue: 'Task', newValue: 'Bug' });
    });

    it('an epic loses its parent', async () => {
      await open(ticket({ parentId: 5, epicId: 5, epicLink: 'Parent' }));
      await run(() => state().handleTypeChange('epic'));
      expect(state().local).toMatchObject({ type: 'epic', parentId: undefined, epicId: undefined, epicLink: undefined });
    });

    it('a subtask with children asks first, and detaches them when saved', async () => {
      mocks.children = [{ id: 20, key: 'LIRA-20' }, { id: 21, key: 'LIRA-21' }];
      await open();
      await run(() => state().handleTypeChange('subtask'));
      expect(mocks.confirmDialog).toHaveBeenCalledWith(expect.objectContaining({ title: 'Convert to subtask' }));
      expect(state().local!.type).toBe('subtask');
      await run(() => state().handleSaveChanges());
      expect(mocks.updateIssue).toHaveBeenCalledWith(20, expect.objectContaining({ parentId: undefined }));
      expect(mocks.updateIssue).toHaveBeenCalledWith(21, expect.objectContaining({ parentId: undefined }));
      expect(mocks.updateIssue).toHaveBeenCalledWith(10, expect.objectContaining({ type: 'subtask' }));
    });

    it('keeps the type when the person declines to detach the children', async () => {
      mocks.children = [{ id: 20, key: 'LIRA-20' }];
      mocks.confirmDialog.mockImplementation(async () => false);
      await open();
      await run(() => state().handleTypeChange('subtask'));
      expect(state().local!.type).toBe('task');
    });
  });

  describe('parent', () => {
    it('sets the parent, its epic and the epic name', async () => {
      mocks.spaceIssues = [{ id: 5, key: 'LIRA-5', title: 'Big epic', type: 'epic' }, { id: 6, key: 'LIRA-6', title: 'A task', type: 'task', epicId: 5 }];
      await open();
      await run(() => state().handleParentChange(5));
      expect(state().local).toMatchObject({ parentId: 5, epicId: 5, epicLink: 'Big epic' });
      await run(() => state().handleParentChange(6));
      expect(state().local).toMatchObject({ parentId: 6, epicId: 5, epicLink: 'A task' });
    });

    it('clears the parent', async () => {
      await open(ticket({ parentId: 5, epicId: 5, epicLink: 'x' }));
      await run(() => state().handleParentChange(undefined));
      expect(state().local).toMatchObject({ parentId: undefined, epicId: undefined, epicLink: undefined });
    });

    it('ignores a parent that is not in the space', async () => {
      await open();
      await run(() => state().handleParentChange(999));
      expect(state().local!.parentId).toBeUndefined();
    });
  });

  describe('blocked', () => {
    it('switches on with the tickets it waits for, linking each one', async () => {
      await open();
      await run(() => state().handleBlockedChange([3, 4, 3]));
      expect(state().local).toMatchObject({ blocked: true, blockedByIds: [3, 4] });
      expect(state().local!.blockedAt).toBeTruthy();
      expect(state().local!.linkedIssues.filter(l => l.linkType === 'blocked_by').map(l => l.issueId)).toEqual([3, 4]);
    });

    it('keeps the original time when more blockers are added', async () => {
      await open();
      await run(() => state().handleBlockedChange([3]));
      const first = state().local!.blockedAt;
      await run(() => state().handleBlockedChange([3, 4]));
      expect(state().local!.blockedAt).toBe(first);
    });

    it('switches off when there are no blockers, and keeps other links', async () => {
      await open(ticket({ linkedIssues: [{ id: 'l1', issueId: 9, linkType: 'relates_to' }] }));
      await run(() => state().handleBlockedChange([3]));
      await run(() => state().handleBlockedChange([]));
      expect(state().local).toMatchObject({ blocked: false, blockedByIds: [], blockedAt: undefined });
      expect(state().local!.linkedIssues).toEqual([{ id: 'l1', issueId: 9, linkType: 'relates_to' }]);
    });

    it('passes the old and new blockers to the link sync on save', async () => {
      await open(ticket({ blocked: true, blockedByIds: [3] }));
      await run(() => state().handleBlockedChange([4]));
      await run(() => state().handleSaveChanges());
      expect(mocks.syncBlockLinks).toHaveBeenCalledWith(10, [3], [4]);
    });

    it('lists what blocks the ticket and what it blocks', async () => {
      mocks.all = [{ id: 3, key: 'LIRA-3' }, { id: 4, key: 'LIRA-4', blocked: true, blockedByIds: [10] }];
      await open(ticket({ blocked: true, blockedByIds: [3] }));
      expect(state().blockers.map(i => i.key)).toEqual(['LIRA-3']);
      expect(state().blocking.map(i => i.key)).toEqual(['LIRA-4']);
    });
  });

  describe('comments (saved at once, not part of the draft)', () => {
    const comment = { id: 'c1', content: 'first', author: 'A', authorInitials: 'A', createdAt: new Date() } as Comment;

    it('adds a comment and saves it straight away', async () => {
      await open();
      await run(() => state().handleAddComment(comment));
      expect(state().local!.comments).toHaveLength(1);
      expect(mocks.updateIssue).toHaveBeenCalledWith(10, { comments: [comment] });
    });

    it('edits a comment and saves it straight away', async () => {
      await open(ticket({ comments: [comment] }));
      await run(() => state().handleEditComment('c1', 'changed', []));
      const [, changes] = mocks.updateIssue.mock.calls[0] as [number, { comments: Comment[] }];
      expect(changes.comments[0]).toMatchObject({ id: 'c1', content: 'changed' });
      expect(changes.comments[0].updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('a comment written but not saved', () => {
    const write = () => run(() => state().setCommentDraft({ html: '<p>Half a thought</p>', files: [] }));
    const savedComments = () => mocks.updateIssue.mock.calls.filter(c => 'comments' in (c[1] as object));

    it('counts as an unsaved change, so closing asks first', async () => {
      await open();
      expect(state().dirty).toBe(false);
      await write();
      expect(state().dirty).toBe(true);
    });

    it('Save changes asks about it; "Save comment" saves the comment and the ticket, and closes', async () => {
      const { onClose } = await open();
      await write();
      mocks.chooseDialog.mockResolvedValueOnce('confirm');
      await run(() => state().handleSaveChanges());
      expect(mocks.chooseDialog).toHaveBeenCalledWith(expect.objectContaining({ confirmLabel: 'Save comment', altLabel: 'Discard comment' }));
      expect(savedComments()).toHaveLength(1);
      expect((savedComments()[0][1] as { comments: Comment[] }).comments[0].content).toBe('<p>Half a thought</p>');
      expect(mocks.notifySaved).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('"Discard comment" saves the ticket without the comment, and closes', async () => {
      const { onClose } = await open();
      await run(() => state().patch({ priority: 'high' }));
      await write();
      mocks.chooseDialog.mockResolvedValueOnce('alt');
      await run(() => state().handleSaveChanges());
      expect(savedComments()).toHaveLength(0);
      expect(mocks.updateIssue).toHaveBeenCalledWith(10, expect.objectContaining({ priority: 'high' }));
      expect(onClose).toHaveBeenCalled();
    });

    it('dismissing the question saves nothing and keeps the ticket and the comment open', async () => {
      const { onClose } = await open();
      await write();
      mocks.chooseDialog.mockResolvedValueOnce(null);
      await run(() => state().handleSaveChanges());
      expect(mocks.updateIssue).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(state().commentDraft.html).toBe('<p>Half a thought</p>');
    });

    it('is not asked about when there is no comment being written, or only an empty one', async () => {
      await open();
      await run(() => state().patch({ priority: 'high' }));
      await run(() => state().setCommentDraft({ html: '<p>  </p>', files: [] }));
      await run(() => state().handleSaveChanges());
      expect(mocks.chooseDialog).not.toHaveBeenCalled();
    });

    it('starts empty again when another ticket is opened', async () => {
      const { rerender } = await open();
      await write();
      await rerender(ticket({ id: 11, key: 'LIRA-11' }));
      expect(state().commentDraft).toEqual({ html: '', files: [] });
    });
  });

  describe('links (part of the draft)', () => {
    it('adds links with their relation, once each, and never to itself', async () => {
      await open();
      await run(() => state().handleAddLinks([{ issueId: 2, linkType: 'relates_to' }, { issueId: 3, linkType: 'duplicates' }, { issueId: 2, linkType: 'relates_to' }, { issueId: 10, linkType: 'blocks' }]));
      expect(state().local!.linkedIssues.map(l => [l.issueId, l.linkType])).toEqual([[2, 'relates_to'], [3, 'duplicates']]);
      expect(state().dirty).toBe(true);
      expect(mocks.updateIssue).not.toHaveBeenCalled(); // nothing is written until Save changes
    });

    it('"is blocked by" turns the Blocked switch on, exactly as the switch does', async () => {
      await open();
      await run(() => state().handleAddLinks([{ issueId: 4, linkType: 'blocked_by' }]));
      expect(state().local).toMatchObject({ blocked: true, blockedByIds: [4] });
      expect(state().local!.linkedIssues.map(l => [l.issueId, l.linkType])).toEqual([[4, 'blocked_by']]);
    });

    it('removes one link; removing "is blocked by" unblocks the ticket', async () => {
      await open();
      await run(() => state().handleAddLinks([{ issueId: 2, linkType: 'relates_to' }, { issueId: 4, linkType: 'blocked_by' }]));
      await run(() => state().handleRemoveLink({ id: 'x', issueId: 4, linkType: 'blocked_by' }));
      expect(state().local).toMatchObject({ blocked: false, blockedByIds: [] });
      await run(() => state().handleRemoveLink({ id: 'y', issueId: 2, linkType: 'relates_to' }));
      expect(state().local!.linkedIssues).toEqual([]);
    });

    it('Save changes passes the links before and after to the link sync', async () => {
      await open();
      await run(() => state().handleAddLinks([{ issueId: 2, linkType: 'blocks' }]));
      await run(() => state().handleSaveChanges());
      const [id, before, after] = mocks.syncLinks.mock.calls[0] as [number, unknown[], { issueId: number; linkType: string }[]];
      expect([id, before]).toEqual([10, []]);
      expect(after.map(l => [l.issueId, l.linkType])).toEqual([[2, 'blocks']]);
    });
  });

  describe('children and deleting', () => {
    it('puts existing tickets under this one at once, with its labels', async () => {
      await open(ticket({ type: 'epic' }));
      await run(() => state().handleAdoptChildren([ticket({ id: 20 }), ticket({ id: 21 })]));
      expect(mocks.updateIssue).toHaveBeenCalledWith(20, expect.objectContaining({ parentId: 10, epicId: 10 }));
      expect(mocks.updateIssue).toHaveBeenCalledWith(21, expect.objectContaining({ parentId: 10 }));
      expect(mocks.propagateLabels).toHaveBeenCalledWith(10);
    });

    it('counts the children and how many are done', async () => {
      mocks.children = [{ id: 20, status: 'done' }, { id: 21, status: 'todo' }, { id: 22, status: 'done' }, { id: 23, status: 'todo' }];
      await open();
      expect(state()).toMatchObject({ childCount: 4, doneChildCount: 2, childProgress: 50 });
    });

    it('has no progress without children', async () => {
      await open();
      expect(state()).toMatchObject({ childCount: 0, doneChildCount: 0, childProgress: 0 });
    });

    it('creates a child ticket under this one, with the same assignee', async () => {
      await open(ticket({ assignee: 'Ann', assigneeInitials: 'AN' }));
      await run(() => state().handleCreateChildIssue('Sub work', 'subtask'));
      expect(mocks.createIssue).toHaveBeenCalledTimes(1);
      expect(mocks.createIssue.mock.calls[0][0]).toMatchObject({ title: 'Sub work', type: 'subtask', parentId: 10, key: 'LIRA-99', assignee: 'Ann' });
    });

    it('deletes the ticket and closes', async () => {
      const { onClose } = await open();
      await run(() => state().handleConfirmDelete());
      expect(mocks.deleteIssue).toHaveBeenCalledWith(10);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('works out the banner colour, status style and type from the draft', async () => {
    await open(ticket({ status: 'done', type: 'bug' }));
    expect(state().bannerColor).toBeTruthy();
    expect(state().statusStyle).toBeTruthy();
    expect(state().typeConfig.label).toBe('Bug');
  });
});
