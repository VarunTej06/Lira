import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { cleanup, mount, q } from '../test/render';
import { useInView } from './useInView';

type Callback = (entries: { isIntersecting: boolean }[]) => void;
let callback: Callback | null = null;
const disconnect = vi.fn();

function Probe() {
  const [ref, seen] = useInView<HTMLDivElement>();
  return <div ref={ref} data-seen={String(seen)} />;
}

beforeEach(() => {
  callback = null;
  disconnect.mockReset();
  class FakeObserver { constructor(cb: Callback) { callback = cb; } observe() {} disconnect = disconnect; }
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('useInView', () => {
  it('is true while the element is on screen and false again once it has scrolled out, every time', () => {
    mount(<Probe />);
    const seen = () => q('[data-seen]')!.dataset.seen;
    expect(seen()).toBe('false');
    act(() => callback!([{ isIntersecting: true }]));
    expect(seen()).toBe('true');
    act(() => callback!([{ isIntersecting: false }]));
    expect(seen()).toBe('false');
    act(() => callback!([{ isIntersecting: true }]));
    expect(seen()).toBe('true');
  });

  it('stops watching when the page is left', () => {
    mount(<Probe />);
    cleanup();
    expect(disconnect).toHaveBeenCalled();
  });

  it('is true at once when the person asked for less motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }));
    mount(<Probe />);
    expect(q('[data-seen]')!.dataset.seen).toBe('true');
  });

  it('is true at once where nothing can watch the page', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    mount(<Probe />);
    expect(q('[data-seen]')!.dataset.seen).toBe('true');
  });
});
