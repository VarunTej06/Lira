import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { byText, cleanup, click, mount, q, qa, typeInto } from '../../test/render';
import { makeIssue } from '../../test/factories';
import { AgendaTab } from './AgendaTab';
import { TicketRow } from './parts';

const db = vi.hoisted(() => ({ updateIssue: vi.fn(async () => undefined) }));
vi.mock('../../hooks/useIssues', () => db);

const issue = makeIssue({ id: 7, key: 'AI-4', title: 'Identify Super Agents', comments: [] });
beforeEach(() => db.updateIssue.mockClear());
afterEach(cleanup);

const icon = () => q<HTMLButtonElement>('button[aria-label="Add a comment"]')!;

describe('the comment icon of a ticket row', () => {
  it('is there for every row but hidden until the row is hovered or focused', () => {
    const onOpen = vi.fn();
    mount(<><TicketRow issue={issue} note="Overdue by 11d" onOpen={onOpen} /><TicketRow issue={makeIssue({ id: 8, key: 'AI-5' })} onOpen={onOpen} /></>);
    expect(qa('button[aria-label="Add a comment"]')).toHaveLength(2);
    expect(icon().className).toContain('opacity-0');
    expect(icon().className).toContain('group-hover:opacity-100');
    expect(icon().className).toContain('focus-visible:opacity-100');
    expect(q('.group')!.contains(icon())).toBe(true);
  });

  it('comes before the note badge, and does not open the ticket when pressed', async () => {
    const onOpen = vi.fn();
    mount(<TicketRow issue={issue} note="Overdue by 11d" onOpen={onOpen} />);
    const badge = byText('span', 'Overdue by 11d')!;
    expect(icon().compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await click(icon());
    expect(onOpen).not.toHaveBeenCalled();
    expect(q('textarea')).not.toBeNull();
    await click(byText('span', 'AI-4'));
    expect(onOpen).toHaveBeenCalledWith(issue);
  });

  it('posts what was typed as a comment on that ticket, and closes', async () => {
    mount(<TicketRow issue={issue} onOpen={() => undefined} />);
    await click(icon());
    expect(byText<HTMLButtonElement>('button', 'Post')!.disabled).toBe(true);
    await typeInto(q<HTMLTextAreaElement>('textarea'), 'Blocked on <b>review</b>');
    await click(byText('button', 'Post'));
    expect(db.updateIssue).toHaveBeenCalledTimes(1);
    const [id, changes] = db.updateIssue.mock.calls[0] as unknown as [number, { comments: { content: string }[] }];
    expect(id).toBe(7);
    expect(changes.comments).toHaveLength(1);
    expect(changes.comments[0].content).toBe('<p>Blocked on &lt;b&gt;review&lt;/b&gt;</p>');
    expect(q('textarea')).toBeNull();
  });

  it('keeps the comments the ticket already has', async () => {
    const old = { id: 'c0', author: 'VY', authorInitials: 'VY', content: '<p>old</p>', attachments: [], createdAt: new Date() };
    mount(<TicketRow issue={{ ...issue, comments: [old] }} onOpen={() => undefined} />);
    await click(icon());
    await typeInto(q<HTMLTextAreaElement>('textarea'), 'new');
    await click(byText('button', 'Post'));
    expect((db.updateIssue.mock.calls[0] as unknown as [number, { comments: unknown[] }])[1].comments).toHaveLength(2);
  });

  it('posts nothing for blank text, and Cancel and Escape close it without saving', async () => {
    mount(<TicketRow issue={issue} onOpen={() => undefined} />);
    await click(icon());
    await typeInto(q<HTMLTextAreaElement>('textarea'), '   ');
    await click(byText('button', 'Post'));
    expect(db.updateIssue).not.toHaveBeenCalled();
    await click(byText('button', 'Cancel'));
    expect(q('textarea')).toBeNull();
    await click(icon());
    await act(async () => { q('textarea')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(q('textarea')).toBeNull();
    expect(db.updateIssue).not.toHaveBeenCalled();
  });

  it('Ctrl+Enter posts', async () => {
    mount(<TicketRow issue={issue} onOpen={() => undefined} />);
    await click(icon());
    await typeInto(q<HTMLTextAreaElement>('textarea'), 'quick');
    await act(async () => { q('textarea')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })); });
    expect(db.updateIssue).toHaveBeenCalledTimes(1);
  });
});

describe('the agenda of a call', () => {
  const agenda = (over: object) => ({ needsUpdate: [], blocked: [], inProgress: [], doneRecently: [], upNext: [], backlog: [], unassigned: [], ...over });
  const state = (over: object) => ({
    agenda: agenda({}), people: [], view: 'status', setView: () => undefined, copied: false, copyAgenda: () => undefined, notes: '', changeNotes: () => undefined, openIssue: () => undefined, ...over,
  }) as unknown as Parameters<typeof AgendaTab>[0];

  it('has the icon on the rows of every group in the status view', () => {
    mount(<AgendaTab {...state({ agenda: agenda({ needsUpdate: [{ issue, reason: 'Overdue by 11d', severity: 'high' }], inProgress: [makeIssue({ id: 9, key: 'AI-9' })] }) })} />);
    expect(qa('button[aria-label="Add a comment"]')).toHaveLength(2);
  });

  it('has the icon on the tickets in a person\'s card in the person view', () => {
    const person = { key: 'VY', name: 'Varun', done: [], blocked: [], stale: [], doing: [issue], next: [makeIssue({ id: 10, key: 'AI-10' })], backlog: [] };
    mount(<AgendaTab {...state({ view: 'person', people: [person] })} />);
    expect(qa('button[aria-label="Add a comment"]')).toHaveLength(2);
  });
});
