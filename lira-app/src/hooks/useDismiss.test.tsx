import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, useRef } from 'react';
import { cleanup, mount, q } from '../test/render';
import { useDismiss } from './useDismiss';

afterEach(cleanup);

function Popup({ open, onClose }: { open: boolean; onClose: (v: boolean) => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useDismiss(open, onClose, panel, trigger);
  return (
    <div>
      <button ref={trigger} data-testid="trigger">open</button>
      <div ref={panel} data-testid="panel"><div data-testid="list" /></div>
      <div data-testid="outside" />
    </div>
  );
}
const fire = (target: EventTarget, event: Event) => act(async () => { target.dispatchEvent(event); });

describe('useDismiss', () => {
  it('does nothing while closed', async () => {
    const onClose = vi.fn();
    mount(<Popup open={false} onClose={onClose} />);
    await fire(q('[data-testid="outside"]')!, new MouseEvent('mousedown', { bubbles: true }));
    await fire(document, new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on a click outside, but not on the panel or the trigger', async () => {
    const onClose = vi.fn();
    mount(<Popup open onClose={onClose} />);
    await fire(q('[data-testid="panel"]')!, new MouseEvent('mousedown', { bubbles: true }));
    await fire(q('[data-testid="trigger"]')!, new MouseEvent('mousedown', { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
    await fire(q('[data-testid="outside"]')!, new MouseEvent('mousedown', { bubbles: true }));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('closes on Escape and gives the focus back to the trigger', async () => {
    const onClose = vi.fn();
    mount(<Popup open onClose={onClose} />);
    await fire(document, new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).toHaveBeenCalledWith(false);
    expect(document.activeElement).toBe(q('[data-testid="trigger"]'));
  });

  it('closes when the window is resized', async () => {
    const onClose = vi.fn();
    mount(<Popup open onClose={onClose} />);
    await fire(window, new Event('resize'));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('closes when the page behind scrolls, but not when the list inside scrolls', async () => {
    const onClose = vi.fn();
    mount(<Popup open onClose={onClose} />);
    await fire(q('[data-testid="list"]')!, new Event('scroll'));
    expect(onClose).not.toHaveBeenCalled();
    await fire(document, new Event('scroll'));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('stops listening once it is closed', async () => {
    const onClose = vi.fn();
    const view = mount(<Popup open onClose={onClose} />);
    view.rerender(<Popup open={false} onClose={onClose} />);
    await fire(q('[data-testid="outside"]')!, new MouseEvent('mousedown', { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
