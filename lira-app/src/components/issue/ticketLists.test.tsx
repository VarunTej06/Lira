import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { choose, cleanup, click, mount, q, qa, typeInto, wait } from '../../test/render';
import { makeIssue } from '../../test/factories';

const updateIssue = vi.hoisted(() => vi.fn(async (..._a: unknown[]) => {}));
vi.mock('../../hooks/useIssues', () => ({ updateIssue }));

import { ChildIssues } from './ChildIssues';
import { LinkedIssues } from './LinkedIssues';
import { LabelAdder } from './detail/detailParts';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('ChildIssues', () => {
  it('says so when there are none', () => {
    mount(<ChildIssues childIssues={[]} onIssueClick={vi.fn()} />);
    expect(q('[data-testid="no-children"]')!.textContent).toBe('No tickets linked.');
    expect(q('[data-testid="child-issues"]')).toBeNull();
  });

  it('lists each child with its key and title, and opens it on a click', async () => {
    const child = makeIssue({ id: 7, key: 'AAA-7', title: 'Build it', type: 'task' });
    const onIssueClick = vi.fn();
    mount(<ChildIssues childIssues={[child, makeIssue({ id: 8, key: 'AAA-8' })]} onIssueClick={onIssueClick} />);
    expect(qa('[data-testid="child-issues"] select')).toHaveLength(2);
    expect(document.body.textContent).toContain('AAA-7');
    await click(qa('[data-testid="child-issues"] button')[0]);
    expect(onIssueClick).toHaveBeenCalledWith(child);
  });

  it('changes the status of a child in place', async () => {
    mount(<ChildIssues childIssues={[makeIssue({ id: 7, key: 'AAA-7', status: 'todo' })]} onIssueClick={vi.fn()} />);
    await choose(q<HTMLSelectElement>('select[aria-label="Status of AAA-7"]'), 'done');
    expect(updateIssue).toHaveBeenCalledWith(7, { status: 'done' });
  });
});

describe('LinkedIssues', () => {
  const tickets = [makeIssue({ id: 2, key: 'AAA-2', title: 'Second', status: 'done' }), makeIssue({ id: 3, key: 'AAA-3', title: 'Third' })];
  const links = [
    { id: 'a', issueId: 2, linkType: 'blocks' as const },
    { id: 'b', issueId: 3, linkType: 'duplicated_by' as const },
    { id: 'c', issueId: 404, linkType: 'relates_to' as const }, // points at a deleted ticket
  ];

  it('says so when there are none', () => {
    mount(<LinkedIssues links={[]} tickets={tickets} onOpen={vi.fn()} onRemove={vi.fn()} />);
    expect(q('[data-testid="no-links"]')!.textContent).toBe('No tickets linked.');
  });

  it('shows each linked ticket with how it is linked and its status; a link to a deleted ticket is left out', () => {
    mount(<LinkedIssues links={links} tickets={tickets} onOpen={vi.fn()} onRemove={vi.fn()} />);
    const rows = qa('[data-testid="linked-issues"] li').map(li => li.textContent);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('blocks');
    expect(rows[0]).toContain('AAA-2');
    expect(rows[0]).toContain('Done');
    expect(rows[1]).toContain('is duplicated by');
  });

  it('opens a linked ticket and removes a link', async () => {
    const h = { onOpen: vi.fn(), onRemove: vi.fn() };
    mount(<LinkedIssues links={links} tickets={tickets} {...h} />);
    await click(q('button[title="Open AAA-2"]'));
    expect(h.onOpen).toHaveBeenCalledWith(tickets[0]);
    await click(q('button[aria-label="Remove link to AAA-3"]'));
    expect(h.onRemove).toHaveBeenCalledWith(links[1]);
  });
});

describe('LabelAdder', () => {
  const key = async (el: Element, k: string) => { await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); await wait(0); }); };
  const box = () => q<HTMLInputElement>('input[aria-label="Add a label"]');
  async function open() {
    const onAdd = vi.fn();
    mount(<LabelAdder onAdd={onAdd} />);
    await click(q('button'));
    return onAdd;
  }

  it('Enter adds the label and the box stays open and empty for the next one', async () => {
    const onAdd = await open();
    await typeInto(box(), 'aws');
    await key(box()!, 'Enter');
    expect(onAdd).toHaveBeenCalledWith('aws');
    expect(box()).not.toBeNull();
    expect(box()!.value).toBe('');
    await typeInto(box(), 'cloud');
    await key(box()!, 'Enter');
    expect(onAdd).toHaveBeenLastCalledWith('cloud');
    expect(box()).not.toBeNull();
  });

  it('a comma does the same as Enter, and is not typed into the box', async () => {
    const onAdd = await open();
    await typeInto(box(), 'k8s');
    await key(box()!, ',');
    expect(onAdd).toHaveBeenCalledWith('k8s');
    expect(box()!.value).toBe('');
  });

  it('adds nothing for an empty box', async () => {
    const onAdd = await open();
    await key(box()!, 'Enter');
    await typeInto(box(), '   ');
    await key(box()!, ',');
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('Escape closes the box without adding what was typed', async () => {
    const onAdd = await open();
    await typeInto(box(), 'half');
    await key(box()!, 'Escape');
    expect(box()).toBeNull();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('clicking away keeps what was typed as a label, then closes', async () => {
    const onAdd = await open();
    await typeInto(box(), 'kept');
    await act(async () => { box()!.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); await wait(0); });
    expect(onAdd).toHaveBeenCalledWith('kept');
    expect(box()).toBeNull();
  });
});
