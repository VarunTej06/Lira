import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { LinkMenuHost } from './LinkMenu';
import { cleanup, mount, q, settle, wait, click } from '../../test/render';

let open: ReturnType<typeof vi.fn>;
beforeEach(() => {
  open = vi.fn();
  vi.stubGlobal('open', open);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const page = (onClick = vi.fn()) => {
  mount(
    <div>
      <LinkMenuHost />
      <div data-testid="item" data-href="/space/LIRA/board?issue=LIRA-1" onClick={onClick}>
        <span data-testid="inner">LIRA-1</span>
        <input data-testid="field" defaultValue="text" />
      </div>
      <div data-testid="plain">nothing here</div>
    </div>,
  );
  return onClick;
};

const fire = async (el: Element, event: Event) => { await act(async () => { el.dispatchEvent(event); await wait(0); }); await settle(); };

describe('Open in new tab (right-click, middle-click, Ctrl+click)', () => {
  it('right-click on an item shows Open in new tab and Copy link', async () => {
    page();
    await fire(q('[data-testid=inner]')!, new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 60 }));
    expect(q('[role=menu]')).not.toBeNull();
    expect(q('[data-testid=open-new-tab]')!.textContent).toContain('Open in new tab');
    expect(q('[data-testid=copy-link]')!.textContent).toContain('Copy link');
  });

  it('Open in new tab opens the item\'s own address, in a new tab', async () => {
    page();
    await fire(q('[data-testid=item]')!, new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
    await click(q('[data-testid=open-new-tab]'));
    expect(open).toHaveBeenCalledWith(`${window.location.origin}/space/LIRA/board?issue=LIRA-1`, '_blank', 'noopener');
  });

  it('Copy link puts the full address on the clipboard', async () => {
    page();
    await fire(q('[data-testid=item]')!, new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
    await click(q('[data-testid=copy-link]'));
    expect((navigator.clipboard.writeText as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(`${window.location.origin}/space/LIRA/board?issue=LIRA-1`);
  });

  it('middle-click opens it at once', async () => {
    page();
    await fire(q('[data-testid=inner]')!, new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+click opens a new tab instead of running the item\'s own click', async () => {
    const onClick = page();
    await fire(q('[data-testid=inner]')!, new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
    await fire(q('[data-testid=inner]')!, new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onClick).toHaveBeenCalledTimes(1); // a normal click still works
  });

  it('things without an address keep the browser\'s own menu', async () => {
    page();
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    await fire(q('[data-testid=plain]')!, ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(q('[role=menu]')).toBeNull();
  });

  it('text fields keep the browser\'s own menu (cut, copy, paste)', async () => {
    page();
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    await fire(q('[data-testid=field]')!, ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(q('[role=menu]')).toBeNull();
  });

  it('Escape closes the menu', async () => {
    page();
    await fire(q('[data-testid=item]')!, new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(0); });
    await settle(250);
    expect(q('[role=menu]')).toBeNull();
  });
});
