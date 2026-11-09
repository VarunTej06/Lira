import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { byText, cleanup, click, mount, q, typeInto, wait } from '../../../test/render';

const dialog = vi.hoisted(() => vi.fn());
vi.mock('../../common/dialogStore', () => ({ promptDialog: dialog }));
vi.mock('../../common/CopyButton', () => ({ CopyButton: ({ getText }: { getText: () => string }) => <button data-testid="copy" onClick={() => document.body.setAttribute('data-copied', getText())}>copy</button> }));
vi.mock('../../common/richtext/RichTextEditor', () => ({ RichTextEditor: ({ value }: { value: string }) => <div data-testid="editor">{value}</div> }));
vi.mock('../IssueSubtasks', () => ({ IssueSubtasks: () => <div data-testid="subtasks" /> }));
vi.mock('../IssueAttachments', () => ({ IssueAttachments: ({ fromComments }: { fromComments: unknown[] }) => <div data-testid="attachments">{fromComments.length}</div> }));
vi.mock('../IssueActivityFeed', () => ({ IssueActivityFeed: () => <div data-testid="feed" /> }));
vi.mock('../ChildIssues', () => ({ ChildIssues: ({ onCreateChild }: { onCreateChild: (t: string, ty: string) => void }) => <button data-testid="children" onClick={() => onCreateChild('x', 'task')}>children</button> }));

import { IssueMain } from './IssueMain';
import type { IssueDetailState } from './useIssueDetail';

afterEach(cleanup);

function show(over: Record<string, unknown> = {}, local: Record<string, unknown> = {}) {
  const h = {
    setEditingTitle: vi.fn(), setTitleVal: vi.fn(), setDescVal: vi.fn(), setDescCollapsed: vi.fn(), setAttCollapsed: vi.fn(), setChildCollapsed: vi.fn(),
    patch: vi.fn(), handleTitleSave: vi.fn(), handleAddComment: vi.fn(), handleEditComment: vi.fn(), handleCreateChildIssue: vi.fn(), onNavigateToIssue: vi.fn(),
  };
  const state = {
    local: { type: 'task', title: 'Fix login', comments: [], attachments: [], subtasks: [], activity: [], ...local }, issue: { title: 'Fix login' },
    editingTitle: false, titleVal: 'Fix login', descVal: 'hello', descCollapsed: false, attCollapsed: false, childCollapsed: false,
    childIssues: [], resolvedParent: null, childCount: 0, doneChildCount: 0, childProgress: 0, ...h, ...over,
  } as unknown as IssueDetailState;
  mount(<IssueMain {...state} />);
  return h;
}
const btn = (t: string | RegExp) => byText('button', t)!;

describe('IssueMain', () => {
  describe('title', () => {
    it('shows the title; clicking it starts editing', async () => {
      const h = show();
      expect(q('h1')!.textContent).toBe('Fix login');
      await click(q('h1'));
      expect(h.setEditingTitle).toHaveBeenCalledWith(true);
    });
    it('edits in a box: typing, Enter and leaving save, Escape cancels and restores', async () => {
      const h = show({ editingTitle: true });
      const input = q<HTMLInputElement>('input')!;
      await typeInto(input, 'New');
      expect(h.setTitleVal).toHaveBeenCalledWith('New');
      await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await wait(0); });
      expect(h.handleTitleSave).toHaveBeenCalledTimes(1);
      await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(0); });
      expect(h.setEditingTitle).toHaveBeenCalledWith(false);
      expect(h.setTitleVal).toHaveBeenLastCalledWith('Fix login');
    });
  });

  describe('quick actions', () => {
    it('adds a child task to an epic and a subtask to a task, after asking for a title', async () => {
      dialog.mockResolvedValueOnce('Do it');
      const h = show({}, { type: 'epic' });
      await click(btn(/Child issue/));
      expect(dialog).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'New task' }));
      expect(h.handleCreateChildIssue).toHaveBeenCalledWith('Do it', 'task');
      cleanup();
      dialog.mockResolvedValueOnce('Step');
      const h2 = show({}, { type: 'task' });
      await click(btn(/Child issue/));
      expect(dialog).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'New subtask' }));
      expect(h2.handleCreateChildIssue).toHaveBeenCalledWith('Step', 'subtask');
    });
    it('creates nothing when the title is cancelled', async () => {
      dialog.mockResolvedValueOnce(null);
      const h = show();
      await click(btn(/Child issue/));
      expect(h.handleCreateChildIssue).not.toHaveBeenCalled();
    });
    it('has no child button on a subtask, but still has Link issue', () => {
      show({}, { type: 'subtask' });
      expect(byText('button', /Child issue/)).toBeUndefined();
      expect(btn(/Link issue/)).toBeDefined();
    });
  });

  describe('parent', () => {
    it('shows nothing without a parent', () => {
      show();
      expect(q('button[title^="Parent:"]')).toBeNull();
    });
    it('shows the parent and opens it', async () => {
      const parent = { id: 9, key: 'AAA-9', title: 'Big thing', type: 'epic' };
      const h = show({ resolvedParent: parent });
      const b = q('button[title^="Parent:"]')!;
      expect(b.textContent).toContain('AAA-9');
      expect(b.textContent).toContain('Big thing');
      await click(b);
      expect(h.onNavigateToIssue).toHaveBeenCalledWith(parent);
    });
  });

  describe('description', () => {
    it('shows the editor, and hides it when collapsed', () => {
      show();
      expect(q('[data-testid="editor"]')!.textContent).toBe('hello');
      cleanup();
      show({ descCollapsed: true });
      expect(q('[data-testid="editor"]')).toBeNull();
    });
    it('collapses and expands from its heading', async () => {
      const h = show();
      await click(btn('Description'));
      expect(h.setDescCollapsed).toHaveBeenCalled();
    });
    it('copies the text of the description', async () => {
      show({ descVal: '<p>Hi</p>' });
      await click(q('[data-testid="copy"]'));
      expect(document.body.getAttribute('data-copied')).toContain('Hi');
    });
  });

  describe('attachments', () => {
    it('counts the ticket\'s files and the ones from comments', () => {
      show({}, { attachments: [{ id: 'a' }], comments: [{ author: 'VY', createdAt: 1, attachments: [{ id: 'b' }, { id: 'c' }] }, { attachments: undefined }] });
      expect(btn(/Attachments/).textContent).toContain('(3)');
      expect(q('[data-testid="attachments"]')!.textContent).toBe('2');
    });
    it('shows no count with no files, and collapses', async () => {
      const h = show();
      expect(btn(/Attachments/).textContent).not.toContain('(');
      await click(btn(/Attachments/));
      expect(h.setAttCollapsed).toHaveBeenCalled();
      cleanup();
      show({ attCollapsed: true });
      expect(q('[data-testid="attachments"]')).toBeNull();
    });
  });

  describe('child work items', () => {
    it('shows for epics and tasks only', () => {
      show({}, { type: 'epic' });
      expect(btn(/Child work items/)).toBeDefined();
      cleanup();
      show({}, { type: 'task' });
      expect(btn(/Child work items/)).toBeDefined();
      cleanup();
      show({}, { type: 'bug' });
      expect(byText('button', /Child work items/)).toBeUndefined();
    });
    it('shows done of total and a progress bar when there are children', () => {
      show({ childCount: 4, doneChildCount: 1, childProgress: 25 });
      expect(btn(/Child work items/).textContent).toContain('(1/4 done)');
      expect(document.body.textContent).toContain('25% Done');
      expect(q('.bg-lira-green')!.getAttribute('style')).toContain('width: 25%');
    });
    it('shows no progress without children, collapses, and passes child creation on', async () => {
      const h = show();
      expect(document.body.textContent).not.toContain('% Done');
      await click(q('[data-testid="children"]'));
      expect(h.handleCreateChildIssue).toHaveBeenCalledWith('x', 'task');
      await click(btn(/Child work items/));
      expect(h.setChildCollapsed).toHaveBeenCalled();
      cleanup();
      show({ childCollapsed: true });
      expect(q('[data-testid="children"]')).toBeNull();
    });
  });

  it('shows the checklist for tasks only, and always the activity feed', () => {
    show({}, { type: 'task' });
    expect(q('[data-testid="subtasks"]')).not.toBeNull();
    expect(q('[data-testid="feed"]')).not.toBeNull();
    cleanup();
    show({}, { type: 'epic' });
    expect(q('[data-testid="subtasks"]')).toBeNull();
    expect(q('[data-testid="feed"]')).not.toBeNull();
  });
});
