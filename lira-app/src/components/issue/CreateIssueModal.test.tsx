import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { byText, choose, cleanup, click, mount, q, qa, typeInto } from '../../test/render';

const mocks = vi.hoisted(() => ({
  createIssue: vi.fn<(issue: unknown) => Promise<number>>(async () => 1),
  getNextIssueKey: vi.fn(async () => 'LIRA-99'),
  issues: [] as unknown[],
}));

vi.mock('../../hooks/useIssues', () => ({
  createIssue: mocks.createIssue,
  getNextIssueKey: mocks.getNextIssueKey,
  useIssuesBySpace: () => mocks.issues,
}));
vi.mock('../common/richtext/RichTextEditor', () => ({
  RichTextEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="description" value={value} onChange={e => onChange(e.target.value)} />
  ),
}));
vi.mock('./TicketSuggestions', () => ({ TicketSuggestions: () => <div data-testid="suggestions" /> }));

import { CreateIssueModal } from './CreateIssueModal';

const space = (id: number, key: string, name = key): Space => ({ id, key, name, icon: 'x', color: '#000000', createdAt: new Date(0), updatedAt: new Date(0) });
const LIRA = space(1, 'LIRA', 'Lira');
const AI = space(2, 'AI', 'AI Projects');
const ticket = (id: number, key: string, type: Issue['type']) => ({ id, key, title: `${key} title`, type, spaceId: 1 } as Issue);

beforeEach(() => { mocks.createIssue.mockClear(); mocks.createIssue.mockImplementation(async () => 1); mocks.issues = []; });
afterEach(cleanup);

function open(over: Partial<Parameters<typeof CreateIssueModal>[0]> = {}) {
  const onClose = vi.fn();
  const view = mount(<CreateIssueModal isOpen onClose={onClose} space={LIRA} {...over} />);
  return { onClose, view };
}
const title = () => q<HTMLInputElement>('input[placeholder="What needs to be done?"]')!;
const submit = () => byText('button', 'Create Issue') as HTMLButtonElement;
const typeButton = (label: string) => byText('button', label)!;
const selects = () => qa<HTMLSelectElement>('select');
const parentSelect = () => selects().find(s => s.querySelector('option')?.textContent?.match(/epic|task|space first/i))!;
const created = () => mocks.createIssue.mock.calls[0][0] as Record<string, unknown>;

describe('CreateIssueModal', () => {
  it('names the space in its title', () => {
    open();
    expect(document.body.textContent).toContain('Create Issue in Lira');
    cleanup();
    open({ space: undefined });
    expect(document.body.textContent).toContain('Create Issue');
    expect(document.body.textContent).not.toContain('in Lira');
  });

  describe('choosing the space', () => {
    it('has no space picker when the space is given', () => {
      open();
      expect(document.body.textContent).not.toContain('Select a space…');
    });

    it('asks for the space when a list is given, and needs one', async () => {
      open({ spaces: [LIRA, AI], chooseSpace: true, space: undefined });
      expect(document.body.textContent).toContain('Select a space…');
      await typeInto(title(), 'A ticket');
      await click(submit());
      expect(document.body.textContent).toContain('Please choose a space for this ticket');
      expect(mocks.createIssue).not.toHaveBeenCalled();
    });

    it('starts on the space in context, and the parent list waits for a space', async () => {
      open({ spaces: [LIRA, AI], chooseSpace: true, space: undefined });
      expect(parentSelect().disabled).toBe(true);
      expect(parentSelect().textContent).toContain('Select a space first…');
      await choose(selects()[0], '1');
      expect(parentSelect().disabled).toBe(false);
    });
  });

  describe('issue type', () => {
    it('offers four types and starts on Task', () => {
      open();
      for (const t of ['Task', 'Bug', 'Epic', 'Subtask']) expect(typeButton(t)).toBeTruthy();
      expect(typeButton('Task').className).toContain('text-lira-blue');
    });

    it('an epic has no parent and no sprint', async () => {
      open();
      await click(typeButton('Epic'));
      expect(document.body.textContent).toContain('Epics are top-level');
      expect(document.body.textContent).not.toContain('(optional)');
      expect(selects().map(s => s.textContent).join('|')).not.toContain('(current)');
    });

    it('a task may sit under an epic (optional), a subtask must sit under a task', async () => {
      mocks.issues = [ticket(10, 'LIRA-10', 'epic'), ticket(11, 'LIRA-11', 'task'), ticket(12, 'LIRA-12', 'bug')];
      open();
      expect(document.body.textContent).toContain('(optional)');
      expect(parentSelect().textContent).toContain('LIRA-10');
      expect(parentSelect().textContent).not.toContain('LIRA-11');
      await click(typeButton('Subtask'));
      expect(document.body.textContent).toContain('Parent task');
      expect(parentSelect().textContent).toContain('LIRA-11');
      expect(parentSelect().textContent).toContain('LIRA-12');
      expect(parentSelect().textContent).not.toContain('LIRA-10');
    });

    it('says when there is nothing to pick', async () => {
      open();
      expect(parentSelect().textContent).toContain('No epics in Lira yet');
      await click(typeButton('Subtask'));
      expect(parentSelect().textContent).toContain('No tasks in Lira yet');
    });
  });

  describe('checks before saving', () => {
    it('needs a title', async () => {
      open();
      await click(submit());
      expect(document.body.textContent).toContain('Title is required');
      expect(mocks.createIssue).not.toHaveBeenCalled();
    });

    it('needs a parent task for a subtask', async () => {
      open();
      await click(typeButton('Subtask'));
      await typeInto(title(), 'Sub');
      await click(submit());
      expect(document.body.textContent).toContain('Choose the task this subtask belongs to');
      expect(mocks.createIssue).not.toHaveBeenCalled();
    });
  });

  describe('saving', () => {
    it('creates the ticket with what was entered, closes, and starts again empty', async () => {
      mocks.issues = [ticket(10, 'LIRA-10', 'epic')];
      const { onClose } = open({ defaultStatus: 'backlog' });
      await typeInto(title(), 'Build the thing');
      await choose(selects().find(s => s.textContent?.includes('Highest'))!, 'high');
      await choose(parentSelect(), '10');
      await typeInto(q<HTMLInputElement>('input[placeholder="e.g. certification, aws"]'), 'a, b');
      await click(submit());
      expect(created()).toMatchObject({ spaceId: 1, key: 'LIRA-99', title: 'Build the thing', status: 'backlog', priority: 'high', type: 'task', parentId: 10 });
      expect(onClose).toHaveBeenCalled();
      expect(title().value).toBe('');
    });

    it('shows a message when saving fails, and stays open', async () => {
      mocks.createIssue.mockImplementation(async () => { throw new Error('disk'); });
      const { onClose } = open();
      await typeInto(title(), 'x');
      await click(submit());
      expect(document.body.textContent).toContain('Failed to create issue. Please try again.');
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  it('shows the current sprint, marked, for a task', () => {
    open();
    expect(selects().map(s => s.textContent).join('|')).toContain('(current)');
  });

  it('starts on the status it was opened with', () => {
    open({ defaultStatus: 'inprogress' });
    const status = selects().find(s => s.textContent?.includes('Backlog'))!;
    expect(status.value).toBe('inprogress');
  });

  it('cancelling closes and clears what was typed', async () => {
    const { onClose } = open();
    await typeInto(title(), 'half done');
    await click(byText('button', 'Cancel'));
    expect(onClose).toHaveBeenCalled();
    expect(title().value).toBe('');
  });
});
