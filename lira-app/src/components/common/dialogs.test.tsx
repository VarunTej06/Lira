import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DialogHost } from './dialogs';
import { alertDialog, chooseDialog, confirmDialog, promptDialog } from './dialogStore';
import { toKey, fromKey, monthGrid, formatPretty } from './dateKeys';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); act(() => root.render(<DialogHost />)); });
afterEach(async () => { act(() => root.unmount()); host.remove(); await wait(0); });

const button = (label: string) => [...document.body.querySelectorAll('button')].find(b => b.textContent?.trim() === label) as HTMLButtonElement | undefined;
const click = async (label: string) => { await act(async () => { button(label)!.click(); await wait(0); }); };

describe('confirm', () => {
  it('shows a styled dialog (not the browser pop-up) and resolves true on the confirm button', async () => {
    let result: boolean | undefined;
    await act(async () => { void confirmDialog({ title: 'Delete project', message: 'Delete "Lira"?', confirmLabel: 'Delete project', tone: 'danger' }).then(v => { result = v; }); await wait(0); });
    expect(document.body.querySelector('[role=dialog]')).not.toBeNull();
    expect(document.body.textContent).toContain('Delete "Lira"?');
    await click('Delete project');
    expect(result).toBe(true);
  });

  it('resolves false on Cancel and on Escape', async () => {
    let a: boolean | undefined, b: boolean | undefined;
    await act(async () => { void confirmDialog({ title: 'x', message: 'y' }).then(v => { a = v; }); await wait(0); });
    await click('Cancel');
    expect(a).toBe(false);
    await act(async () => { void confirmDialog({ title: 'x', message: 'y' }).then(v => { b = v; }); await wait(0); });
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(0); });
    expect(b).toBe(false);
  });

  it('queues dialogs and shows them one at a time', async () => {
    const seen: boolean[] = [];
    await act(async () => { void confirmDialog({ title: 'first', message: '1' }).then(v => seen.push(v)); void confirmDialog({ title: 'second', message: '2' }).then(v => seen.push(v)); await wait(0); });
    expect(document.body.textContent).toContain('first');
    expect(document.body.textContent).not.toContain('second');
    await click('Cancel');
    expect(document.body.textContent).toContain('second');
    await click('Confirm');
    expect(seen).toEqual([false, true]);
  });
});

describe('prompt', () => {
  it('returns what was typed, trimmed, and null when cancelled', async () => {
    let value: string | null | undefined;
    await act(async () => { void promptDialog({ title: 'Rename', label: 'Name', defaultValue: 'Old', confirmLabel: 'Rename' }).then(v => { value = v; }); await wait(0); });
    const input = document.body.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('Old');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '  New name ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(0);
    });
    await click('Rename');
    expect(value).toBe('New name');

    let cancelled: string | null | undefined;
    await act(async () => { void promptDialog({ title: 'Rename', label: 'Name' }).then(v => { cancelled = v; }); await wait(0); });
    await click('Cancel');
    expect(cancelled).toBeNull();
  });

  it('will not accept an empty answer when one is required', async () => {
    await act(async () => { void promptDialog({ title: 'Rename', label: 'Name', confirmLabel: 'Rename' }); await wait(0); });
    expect(button('Rename')!.disabled).toBe(true);
    await click('Cancel');
  });
});

describe('alert', () => {
  it('has a single OK button', async () => {
    let done = false;
    await act(async () => { void alertDialog({ title: 'Title needed', message: 'Cannot be empty' }).then(() => { done = true; }); await wait(0); });
    expect(button('Cancel')).toBeUndefined();
    await click('OK');
    expect(done).toBe(true);
  });
});

describe('date picker helpers', () => {
  it('turn dates into keys and back, in the local day', () => {
    expect(toKey(new Date(2026, 10, 9))).toBe('2026-11-09');
    expect(fromKey('2026-11-09')?.getDate()).toBe(9);
    expect(fromKey('nope')).toBeNull();
    expect(fromKey('')).toBeNull();
    expect(formatPretty('2026-11-09')).toBe('Mon, Nov 9, 2026');
    expect(formatPretty('')).toBe('');
  });
  it('lay a month out as six Monday-first weeks', () => {
    const g = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(g).toHaveLength(42);
    expect(g[0].date.getDay()).toBe(1);               // Monday
    expect(toKey(g[0].date)).toBe('2026-10-26');
    expect(g.filter(d => d.inMonth)).toHaveLength(30);
  });
});

describe('choose (two answers and a way back)', () => {
  const ask = () => chooseDialog({ title: 'Save your comment?', message: 'm', confirmLabel: 'Save comment', altLabel: 'Discard comment', cancelLabel: 'Keep editing' });

  it('answers "confirm" for the main button and "alt" for the other one', async () => {
    let a: unknown = 'pending';
    await act(async () => { void ask().then(v => { a = v; }); await wait(0); });
    expect(button('Discard comment')).toBeDefined();
    await click('Save comment');
    expect(a).toBe('confirm');
    let b: unknown = 'pending';
    await act(async () => { void ask().then(v => { b = v; }); await wait(0); });
    await click('Discard comment');
    expect(b).toBe('alt');
  });

  it('answers null when it is dismissed: the cancel button or Escape choose neither', async () => {
    let a: unknown = 'pending';
    await act(async () => { void ask().then(v => { a = v; }); await wait(0); });
    await click('Keep editing');
    expect(a).toBeNull();
    let b: unknown = 'pending';
    await act(async () => { void ask().then(v => { b = v; }); await wait(0); });
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(0); });
    expect(b).toBeNull();
  });
});
