import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { act } from 'react';
import { cleanup, mount, q, qa, typeInto } from '../../test/render';
import type { Command } from '../../utils/commandPalette';
import { CommandPalette } from './CommandPalette';
import { useCommandPalette } from './useCommandPalette';

afterEach(cleanup);

const mk = (id: string, group: Command['group'], label: string, run: () => void = () => undefined, detail?: string): Command => ({ id, group, label, detail, run });
type Runs = Record<'p1' | 'p2' | 's1' | 'a1', Mock<() => void>>;
const all = (run: Runs): Command[] => [
  mk('p1', 'Go to', 'Projects', () => run.p1()), mk('p2', 'Go to', 'Roadmaps', () => run.p2()), mk('s1', 'Spaces', 'Lira', () => run.s1(), 'LIRA'), mk('a1', 'Actions', 'Create a ticket', () => run.a1()),
];
const names = () => qa('[role="option"]').map(o => o.textContent);
const press = async (key: string) => { await act(async () => { q('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); }); };
const open = (onClose = vi.fn(), run: Runs = { p1: vi.fn(), p2: vi.fn(), s1: vi.fn(), a1: vi.fn() }) => {
  mount(<CommandPalette commands={() => all(run)} onClose={onClose} />);
  return { onClose, run };
};

describe('the command palette', () => {
  it('is a dialog with a search box that has the focus, and lists everything in groups when nothing is typed', () => {
    open();
    expect(q('[role="dialog"]')!.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(q('input[role="combobox"]'));
    expect(names()).toEqual(['Projects', 'Roadmaps', 'LiraLIRA', 'Create a ticket']);
    expect(qa('[role="group"]').map(g => g.getAttribute('aria-label'))).toEqual(['Go to', 'Spaces', 'Actions']);
  });

  it('narrows the list as you type, and says so when nothing matches', async () => {
    open();
    await typeInto(q<HTMLInputElement>('input[role="combobox"]'), 'road');
    expect(names()).toEqual(['Roadmaps']);
    await typeInto(q<HTMLInputElement>('input[role="combobox"]'), 'qqqq');
    expect(q('[role="status"]')!.textContent).toContain('Nothing matches “qqqq”');
    expect(qa('[role="option"]')).toHaveLength(0);
  });

  it('moves with the arrows, wraps round, and tells a screen reader which result is chosen', async () => {
    open();
    const selected = () => qa('[role="option"]').findIndex(o => o.getAttribute('aria-selected') === 'true');
    expect(selected()).toBe(0);
    await press('ArrowDown'); expect(selected()).toBe(1);
    await press('ArrowUp'); await press('ArrowUp'); expect(selected()).toBe(3); // wrapped to the last
    await press('Home'); expect(selected()).toBe(0);
    await press('End'); expect(selected()).toBe(3);
    expect(q('input[role="combobox"]')!.getAttribute('aria-activedescendant')).toBe('palette-a1');
  });

  it('runs the chosen result with Enter, and closes first', async () => {
    const { onClose, run } = open();
    await press('ArrowDown');
    await press('Enter');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(run.p2).toHaveBeenCalledTimes(1);
    expect(run.p1).not.toHaveBeenCalled();
  });

  it('runs a result that is clicked, and does nothing on Enter when there are no results', async () => {
    const { onClose, run } = open();
    await act(async () => { qa('[role="option"]')[2].click(); });
    expect(run.s1).toHaveBeenCalledTimes(1);
    cleanup();
    const second = open();
    await typeInto(q<HTMLInputElement>('input[role="combobox"]'), 'qqqq');
    await press('Enter');
    expect(second.onClose).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes with Escape or a click outside, and keeps the focus in the box when Tab is pressed', async () => {
    const { onClose } = open();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    await act(async () => { q('[role="dialog"]')!.dispatchEvent(tab); });
    expect(tab.defaultPrevented).toBe(true);
    await press('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => { q('[role="dialog"]')!.parentElement!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    expect(onClose).toHaveBeenCalledTimes(2);
    await act(async () => { q('[role="dialog"]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    expect(onClose).toHaveBeenCalledTimes(2); // a click inside does not close it
  });

  it('takes the focus back if something else grabs it just after it opens', async () => {
    vi.useFakeTimers();
    const other = document.createElement('button');
    document.body.appendChild(other);
    mount(<CommandPalette commands={() => []} onClose={() => undefined} />);
    other.focus();
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(document.activeElement).toBe(q('input[role="combobox"]'));
    vi.useRealTimers();
  });

  it('leaves the focus alone when a command opened something that took it', () => {
    const behind = document.createElement('button');
    document.body.appendChild(behind); behind.focus();
    const handle = mount(<CommandPalette commands={() => []} onClose={() => undefined} />);
    const popup = document.createElement('input');
    document.body.appendChild(popup); popup.focus(); // what a command opened, now holding the focus
    handle.unmount();
    expect(document.activeElement).toBe(popup);
    behind.remove(); popup.remove();
  });

  it('gives the focus back to where it was when it closes', () => {
    const button = document.createElement('button');
    document.body.appendChild(button); button.focus();
    const handle = mount(<CommandPalette commands={() => []} onClose={() => undefined} />);
    expect(document.activeElement).not.toBe(button);
    handle.unmount();
    expect(document.activeElement).toBe(button);
    button.remove();
  });
});

describe('the shortcut', () => {
  function Probe() { const { open: o, setOpen } = useCommandPalette(); return <div><p id="state">{o ? 'open' : 'closed'}</p><button type="button" onClick={() => setOpen(false)}>close</button><input aria-label="field" /></div>; }
  const key = async (init: KeyboardEventInit, target: EventTarget = window) => { await act(async () => { target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })); }); };

  it('opens and closes with Ctrl+K or Cmd+K, even from inside a field, and ignores other combinations', async () => {
    mount(<Probe />);
    expect(q('#state')!.textContent).toBe('closed');
    await key({ key: 'k', ctrlKey: true });
    expect(q('#state')!.textContent).toBe('open');
    await key({ key: 'K', metaKey: true });
    expect(q('#state')!.textContent).toBe('closed');
    await key({ key: 'k', ctrlKey: true }, q('input[aria-label="field"]')!);
    expect(q('#state')!.textContent).toBe('open');
    await key({ key: 'k' }); await key({ key: 'k', ctrlKey: true, shiftKey: true }); await key({ key: 'j', ctrlKey: true });
    expect(q('#state')!.textContent).toBe('open');
  });

  it('stops the browser from using Ctrl+K for itself', async () => {
    mount(<Probe />);
    const e = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true });
    await act(async () => { window.dispatchEvent(e); });
    expect(e.defaultPrevented).toBe(true);
  });
});
