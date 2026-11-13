import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { byText, cleanup, click, mount, q, typeInto, wait } from '../../../test/render';
import type { TicketPickerProps } from '../../common/TicketPicker';

vi.mock('../../common/CopyButton', () => ({ CopyButton: ({ getText }: { getText: () => string }) => <button data-testid="copy" onClick={() => document.body.setAttribute('data-copied', getText())}>copy</button> }));
vi.mock('../../common/richtext/RichTextEditor', () => ({ RichTextEditor: ({ value }: { value: string }) => <div data-testid="editor">{value}</div> }));
vi.mock('../IssueSubtasks', () => ({ IssueSubtasks: () => <div data-testid="subtasks" /> }));
vi.mock('../IssueAttachments', () => ({ IssueAttachments: ({ fromComments }: { fromComments: unknown[] }) => <div data-testid="attachments">{fromComments.length}</div> }));
vi.mock('../IssueActivityFeed', () => ({ IssueActivityFeed: ({ draft }: { draft: { html: string } }) => <div data-testid="feed">{draft.html}</div> }));
vi.mock('../ChildIssues', () => ({ ChildIssues: ({ childIssues }: { childIssues: unknown[] }) => <div data-testid="children">{childIssues.length}</div> }));
vi.mock('../LinkedIssues', () => ({ LinkedIssues: ({ links, onRemove }: { links: unknown[]; onRemove: (l: unknown) => void }) => <button data-testid="links" onClick={() => onRemove(links[0])}>{links.length}</button> }));
// The picker itself is tested in TicketPicker.test.tsx; here it only shows what it was given and passes choices back
vi.mock('../../common/TicketPicker', () => ({
  TicketPicker: (p: TicketPickerProps) => (p.open ? (
    <div data-testid={`${p.testId}-picker`} data-candidates={p.candidates.map(c => c.key).join(',')} data-relations={(p.relations ?? []).map(r => r.value).join(',')}>
      <span data-testid="picker-title">{p.title}</span>
      {p.create && <button data-testid="create" onClick={() => p.create!.onCreate('New one')}>{p.create.label}</button>}
      <button data-testid="pick" onClick={() => p.onPick(p.candidates.slice(0, 2).map(issue => ({ issue, relation: p.relations?.[1]?.value })))}>pick</button>
      <button data-testid="close" onClick={p.onClose}>close</button>
    </div>
  ) : null),
}));

import { IssueMain } from './IssueMain';
import type { IssueDetailState } from './useIssueDetail';

afterEach(cleanup);

const ticket = (id: number, type: string, over: Record<string, unknown> = {}) => ({ id, key: `AAA-${id}`, title: `T${id}`, type, status: 'todo', spaceId: 1, ...over });
const SPACE = [ticket(1, 'epic'), ticket(2, 'task'), ticket(3, 'task', { parentId: 1 }), ticket(4, 'subtask'), ticket(5, 'bug'), ticket(6, 'task', { status: 'done' })];
const EVERY = [...SPACE, ticket(20, 'task', { spaceId: 2 })];

function show(over: Record<string, unknown> = {}, local: Record<string, unknown> = {}) {
  const h = {
    setEditingTitle: vi.fn(), setTitleVal: vi.fn(), setDescVal: vi.fn(), setDescCollapsed: vi.fn(), setAttCollapsed: vi.fn(), setChildCollapsed: vi.fn(),
    patch: vi.fn(), handleTitleSave: vi.fn(), handleAddComment: vi.fn(), handleEditComment: vi.fn(), handleCreateChildIssue: vi.fn(), onNavigateToIssue: vi.fn(),
    handleAdoptChildren: vi.fn(), handleAddLinks: vi.fn(), handleRemoveLink: vi.fn(), setCommentDraft: vi.fn(),
  };
  const state = {
    local: { id: 1, key: 'AAA-1', spaceId: 1, type: 'task', title: 'Fix login', comments: [], attachments: [], subtasks: [], activity: [], linkedIssues: [], ...local }, issue: { title: 'Fix login' },
    editingTitle: false, titleVal: 'Fix login', descVal: 'hello', descCollapsed: false, attCollapsed: false, childCollapsed: false,
    childIssues: [], resolvedParent: null, childCount: 0, doneChildCount: 0, childProgress: 0, spaceIssues: SPACE, everyIssue: EVERY,
    commentDraft: { html: '', files: [] }, ...h, ...over,
  } as unknown as IssueDetailState;
  mount(<IssueMain {...state} />);
  return h;
}
const btn = (t: string | RegExp) => byText('button', t)!;
const candidates = (id: string) => q(`[data-testid="${id}-picker"]`)!.getAttribute('data-candidates');

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

  describe('Child issue', () => {
    it('opens a picker; on an epic it offers the other tasks of the space, not ones already under it, itself or other types', async () => {
      show({}, { type: 'epic' });
      expect(q('[data-testid="child-picker"]')).toBeNull();
      await click(btn('Child issue'));
      expect(candidates('child')).toBe('AAA-2,AAA-6'); // AAA-3 is already its child; tickets of any status are offered
    });
    it('on a task or a bug it offers subtasks', async () => {
      show({}, { id: 2, type: 'task' });
      await click(btn('Child issue'));
      expect(candidates('child')).toBe('AAA-4');
      cleanup();
      show({}, { id: 5, type: 'bug' });
      await click(btn('Child issue'));
      expect(candidates('child')).toBe('AAA-4');
    });
    it('creates a new child one level down from only a name: a task under an epic, a subtask under a task', async () => {
      const h = show({}, { type: 'epic' });
      await click(btn('Child issue'));
      expect(q('[data-testid="create"]')!.textContent).toBe('Create task');
      await click(q('[data-testid="create"]'));
      expect(h.handleCreateChildIssue).toHaveBeenCalledWith('New one', 'task');
      expect(q('[data-testid="child-picker"]')).toBeNull(); // it closes
      cleanup();
      const h2 = show({}, { id: 2, type: 'task' });
      await click(btn('Child issue'));
      await click(q('[data-testid="create"]'));
      expect(h2.handleCreateChildIssue).toHaveBeenCalledWith('New one', 'subtask');
    });
    it('puts the chosen existing tickets under this one and closes', async () => {
      const h = show({}, { type: 'epic' });
      await click(btn('Child issue'));
      await click(q('[data-testid="pick"]'));
      expect(h.handleAdoptChildren).toHaveBeenCalledWith([SPACE[1], SPACE[5]]);
      expect(q('[data-testid="child-picker"]')).toBeNull();
    });
    it('has no child button on a subtask, but still has Link issue', () => {
      show({}, { type: 'subtask' });
      expect(byText('button', 'Child issue')).toBeUndefined();
      expect(btn('Link issue')).toBeDefined();
    });
  });

  describe('Link issue', () => {
    it('opens a picker with every other ticket (any type, status or space) and the four relations', async () => {
      show();
      await click(btn('Link issue'));
      expect(candidates('link')).toBe('AAA-2,AAA-3,AAA-4,AAA-5,AAA-6,AAA-20');
      expect(q('[data-testid="link-picker"]')!.getAttribute('data-relations')).toBe('relates_to,blocks,blocked_by,duplicates');
    });
    it('adds each chosen ticket with its relation to the draft and closes', async () => {
      const h = show();
      await click(btn('Link issue'));
      await click(q('[data-testid="pick"]'));
      expect(h.handleAddLinks).toHaveBeenCalledWith([{ issueId: 2, linkType: 'blocks' }, { issueId: 3, linkType: 'blocks' }]);
      expect(q('[data-testid="link-picker"]')).toBeNull();
    });
    it('closes without linking anything', async () => {
      const h = show();
      await click(btn('Link issue'));
      await click(q('[data-testid="close"]'));
      expect(q('[data-testid="link-picker"]')).toBeNull();
      expect(h.handleAddLinks).not.toHaveBeenCalled();
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

  describe('child issues section', () => {
    it('sits right below the attachments, for every type that can have children, also with no children yet', () => {
      for (const type of ['epic', 'task', 'bug']) {
        show({}, { type });
        const section = q('[data-testid="child-section"]')!;
        expect(section, type).not.toBeNull();
        expect(section.previousElementSibling!.textContent).toContain('Attachments');
        expect(q('[data-testid="children"]')!.textContent).toBe('0');
        cleanup();
      }
      show({}, { type: 'subtask' });
      expect(q('[data-testid="child-section"]')).toBeNull();
    });
    it('shows done of total and a progress bar when there are children', () => {
      show({ childCount: 4, doneChildCount: 1, childProgress: 25, childIssues: [{}, {}, {}, {}] });
      expect(btn(/Child issues/).textContent).toContain('(1/4 done)');
      expect(document.body.textContent).toContain('25% Done');
      expect(q('.bg-lira-green')!.getAttribute('style')).toContain('width: 25%');
      expect(q('[data-testid="children"]')!.textContent).toBe('4');
    });
    it('shows no progress without children, collapses, and its Add button opens the child picker', async () => {
      const h = show();
      expect(document.body.textContent).not.toContain('% Done');
      await click(btn('Add child issue'));
      expect(q('[data-testid="child-picker"]')).not.toBeNull();
      await click(btn(/^Child issues/));
      expect(h.setChildCollapsed).toHaveBeenCalled();
      cleanup();
      show({ childCollapsed: true });
      expect(q('[data-testid="children"]')).toBeNull();
    });
  });

  describe('linked issues section', () => {
    it('is always shown, with the number of links', () => {
      show({}, { type: 'subtask' });
      expect(q('[data-testid="linked-section"]')!.textContent).toContain('Linked issues');
      expect(q('[data-testid="links"]')!.textContent).toBe('0');
      cleanup();
      show({}, { linkedIssues: [{ id: 'a', issueId: 2, linkType: 'blocks' }, { id: 'b', issueId: 3, linkType: 'relates_to' }] });
      expect(q('[data-testid="linked-section"] h3')!.textContent).toContain('(2)');
    });
    it('removes a link from the draft, and its button opens the link picker', async () => {
      const link = { id: 'a', issueId: 2, linkType: 'blocks' };
      const h = show({}, { linkedIssues: [link] });
      await click(q('[data-testid="links"]'));
      expect(h.handleRemoveLink).toHaveBeenCalledWith(link);
      await click(q('[data-testid="linked-section"] button:last-of-type'));
      expect(q('[data-testid="link-picker"]')).not.toBeNull();
    });
  });

  it('shows the checklist for tasks only, and always the activity feed with the comment being written', () => {
    show({ commentDraft: { html: 'half a thought', files: [] } }, { type: 'task' });
    expect(q('[data-testid="subtasks"]')).not.toBeNull();
    expect(q('[data-testid="feed"]')!.textContent).toBe('half a thought');
    cleanup();
    show({}, { type: 'epic' });
    expect(q('[data-testid="subtasks"]')).toBeNull();
    expect(q('[data-testid="feed"]')).not.toBeNull();
  });
});
