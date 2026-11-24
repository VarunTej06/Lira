import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, useRef } from 'react';
import { cleanup, mount, q } from '../test/render';
import { useElementSize } from './useElementSize';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const { w, h } = useElementSize(ref);
  return <div ref={ref}><p id="size">{w}x{h}</p></div>;
}

describe('the size of an element', () => {
  it('is 0 by 0 where sizes cannot be observed', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    mount(<Probe />);
    expect(q('#size')!.textContent).toBe('0x0');
  });

  it('follows the element as it is resized, whole pixels only, and does not change for the same size', async () => {
    let notify: (w: number, h: number) => void = () => undefined;
    vi.stubGlobal('ResizeObserver', class { constructor(cb: ResizeObserverCallback) { notify = (w, h) => cb([{ contentRect: { width: w, height: h } } as ResizeObserverEntry], this as unknown as ResizeObserver); } observe() {} disconnect() {} });
    mount(<Probe />);
    await act(async () => { notify(640.7, 480.2); });
    expect(q('#size')!.textContent).toBe('640x480');
    await act(async () => { notify(640.9, 480.9); });
    expect(q('#size')!.textContent).toBe('640x480');
    await act(async () => { notify(300, 200); });
    expect(q('#size')!.textContent).toBe('300x200');
  });

  it('stops watching when the element goes away', () => {
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = disconnect; });
    mount(<Probe />);
    cleanup();
    expect(disconnect).toHaveBeenCalled();
  });
});
