import { act, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, mount, q } from '../test/render';
import { useElementWidth } from './useElementWidth';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const width = useElementWidth(ref);
  return <div ref={ref} data-testid="box">{width}</div>;
}

/** A stand-in for the browser's ResizeObserver that the test can fire by hand. */
function fakeObserver() {
  const state = { report: (_w: number) => {}, observed: 0, disconnected: 0 };
  class Fake {
    constructor(cb: (entries: { contentRect: { width: number } }[]) => void) { state.report = w => cb([{ contentRect: { width: w } }]); }
    observe() { state.observed++; }
    disconnect() { state.disconnected++; }
  }
  vi.stubGlobal('ResizeObserver', Fake);
  return state;
}

describe('useElementWidth', () => {
  it('is 0 where sizes cannot be observed', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    mount(<Probe />);
    expect(q('[data-testid="box"]')!.textContent).toBe('0');
  });

  it('reports the width it is told, in whole pixels, and follows later changes', () => {
    const ro = fakeObserver();
    mount(<Probe />);
    expect(ro.observed).toBe(1);
    act(() => ro.report(812.7));
    expect(q('[data-testid="box"]')!.textContent).toBe('812');
    act(() => ro.report(400));
    expect(q('[data-testid="box"]')!.textContent).toBe('400');
  });

  it('stops observing when the element goes away', () => {
    const ro = fakeObserver();
    const view = mount(<Probe />);
    view.unmount();
    expect(ro.disconnected).toBe(1);
  });
});
