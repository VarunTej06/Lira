import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { byText, choose, cleanup, click, mount, q, qa, typeInto, wait } from '../../test/render';
import { makeIssue } from '../../test/factories';
import { TicketPicker, type TicketPickerProps } from './TicketPicker';

afterEach(cleanup);

const TICKETS = [
  makeIssue({ id: 1, key: 'OTH-1', title: 'Other space', spaceId: 2, type: 'task' }),
  makeIssue({ id: 2, key: 'AAA-10', title: 'Tenth', spaceId: 1, type: 'bug', status: 'done' }),
  makeIssue({ id: 3, key: 'AAA-2', title: 'Second login fix', spaceId: 1, type: 'task', status: 'backlog' }),
  makeIssue({ id: 4, key: 'AAA-3', title: 'An epic', spaceId: 1, type: 'epic', status: 'inprogress' }),
];

function show(over: Partial<TicketPickerProps> = {}) {
  const h = { onClose: vi.fn(), onPick: vi.fn() };
  mount(<TicketPicker open title="Pick tickets" hint="Tick some" icon={<span />} candidates={TICKETS} homeSpaceId={1} confirmLabel="Use these" emptyText="Nothing here." testId="t" {...h} {...over} />);
  return h;
}
const keys = () => qa('[data-testid^="t-"][data-testid$="0"], label[data-testid^="t-"]').map(e => e.getAttribute('data-testid')).filter((v, i, a) => a.indexOf(v) === i);
const rows = () => qa('label[data-testid^="t-"]').map(e => e.getAttribute('data-testid'));
const confirm = () => q<HTMLButtonElement>('[data-testid="t-confirm"]')!;

describe('TicketPicker', () => {
  it('shows nothing when closed', () => {
    show({ open: false });
    expect(q('[data-testid="t-picker"]')).toBeNull();
  });

  it('lists the tickets of the home space first, in key order (2 before 10), each with its status', () => {
    show();
    expect(keys().length).toBeGreaterThan(0);
    expect(rows()).toEqual(['t-AAA-2', 't-AAA-3', 't-AAA-10', 't-OTH-1']);
    expect(q('[data-testid="t-AAA-10"]')!.textContent).toContain('Done');
    expect(q('[data-testid="t-AAA-2"]')!.textContent).toContain('Backlog');
  });

  it('searches by key or title', async () => {
    show();
    await typeInto(q<HTMLInputElement>('input[aria-label="Search tickets"]'), 'login');
    expect(rows()).toEqual(['t-AAA-2']);
    await typeInto(q<HTMLInputElement>('input[aria-label="Search tickets"]'), 'oth-');
    expect(rows()).toEqual(['t-OTH-1']);
    await typeInto(q<HTMLInputElement>('input[aria-label="Search tickets"]'), 'zzz');
    expect(document.body.textContent).toContain('Nothing here.');
  });

  it('filters by type only when asked to', async () => {
    show();
    expect(q('[aria-label="Ticket type"]')).toBeNull();
    cleanup();
    show({ typeFilter: true });
    await click(byText('button', 'Bugs'));
    expect(rows()).toEqual(['t-AAA-10']);
  });

  it('waits for a choice, then reports every ticked ticket; ticking again unticks', async () => {
    const h = show();
    expect(confirm().disabled).toBe(true);
    await click(q('[data-testid="t-AAA-2"] input'));
    await click(q('[data-testid="t-OTH-1"] input'));
    await click(q('[data-testid="t-AAA-3"] input'));
    await click(q('[data-testid="t-AAA-3"] input'));
    expect(document.body.textContent).toContain('2 selected');
    await click(confirm());
    expect(h.onPick).toHaveBeenCalledWith([{ issue: TICKETS[0], relation: undefined }, { issue: TICKETS[2], relation: undefined }]);
  });

  it('with relations, each ticked ticket gets its own dropdown, starting on the first', async () => {
    const h = show({ relations: [{ value: 'relates_to', label: 'relates to' }, { value: 'blocks', label: 'blocks' }] });
    expect(q('select')).toBeNull();
    await click(q('[data-testid="t-AAA-2"] input'));
    await click(q('[data-testid="t-AAA-3"] input'));
    expect(qa('select')).toHaveLength(2);
    await choose(q<HTMLSelectElement>('[data-testid="t-relation-AAA-3"]'), 'blocks');
    await click(confirm());
    expect(h.onPick).toHaveBeenCalledWith([{ issue: TICKETS[2], relation: 'relates_to' }, { issue: TICKETS[3], relation: 'blocks' }]);
  });

  it('can create a new ticket from just a name: the button, or Enter', async () => {
    const onCreate = vi.fn();
    show({ create: { label: 'Create task', placeholder: 'Name of the new task', onCreate } });
    const box = q<HTMLInputElement>('input[aria-label="Create task"]')!;
    expect(q<HTMLButtonElement>('[data-testid="picker-create"]')!.disabled).toBe(true);
    await typeInto(box, '  Write the docs ');
    await click(q('[data-testid="picker-create"]'));
    expect(onCreate).toHaveBeenCalledWith('Write the docs');
    await typeInto(box, 'Another');
    await act(async () => { box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await wait(0); });
    expect(onCreate).toHaveBeenLastCalledWith('Another');
  });

  it('closes on Escape, on the X and on Cancel, without choosing anything', async () => {
    const h = show();
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await wait(0); });
    await click(q('button[aria-label="Close"]'));
    await click(byText('button', 'Cancel'));
    expect(h.onClose).toHaveBeenCalledTimes(3);
    expect(h.onPick).not.toHaveBeenCalled();
  });

  it('starts clean each time it opens', async () => {
    const h = { onClose: vi.fn(), onPick: vi.fn() };
    const props = { title: 'Pick', hint: 'h', icon: <span />, candidates: TICKETS, confirmLabel: 'Use', emptyText: 'None', testId: 't', ...h };
    const view = mount(<TicketPicker open {...props} />);
    await click(q('[data-testid="t-AAA-2"] input'));
    view.rerender(<TicketPicker open={false} {...props} />);
    await act(async () => { await wait(350); }); // the closing animation
    view.rerender(<TicketPicker open {...props} />);
    await act(async () => { await wait(0); });
    expect(confirm().disabled).toBe(true);
  });
});
