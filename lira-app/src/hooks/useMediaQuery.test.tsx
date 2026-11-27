import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { cleanup, mount, q } from '../test/render';
import { useMediaQuery } from './useMediaQuery';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Probe({ query }: { query: string }) { return <p id="out">{String(useMediaQuery(query))}</p>; }

/** A screen whose match can be changed, which tells whoever listens. */
function fakeScreen(initial: boolean) {
  const listeners = new Set<() => void>();
  const mq = { matches: initial, addEventListener: (_: string, l: () => void) => listeners.add(l), removeEventListener: (_: string, l: () => void) => listeners.delete(l) };
  const matchMedia = vi.fn(() => mq);
  vi.stubGlobal('matchMedia', matchMedia);
  return { matchMedia, listeners, set: (v: boolean) => { mq.matches = v; listeners.forEach(l => l()); } };
}

describe('asking whether the screen matches a query', () => {
  it('starts with the answer of the screen, for the query it was given', () => {
    const s = fakeScreen(true);
    mount(<Probe query="(max-width: 767px)" />);
    expect(q('#out')!.textContent).toBe('true');
    expect(s.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
  });

  it('changes when the screen does, for example when the phone is turned', async () => {
    const s = fakeScreen(false);
    mount(<Probe query="(max-width: 767px)" />);
    expect(q('#out')!.textContent).toBe('false');
    await act(async () => { s.set(true); });
    expect(q('#out')!.textContent).toBe('true');
    await act(async () => { s.set(false); });
    expect(q('#out')!.textContent).toBe('false');
  });

  it('stops listening when the page goes away', () => {
    const s = fakeScreen(false);
    const view = mount(<Probe query="(min-width: 1px)" />);
    expect(s.listeners.size).toBe(1);
    view.unmount();
    expect(s.listeners.size).toBe(0);
  });

  it('says no where the browser cannot answer', () => {
    vi.stubGlobal('matchMedia', undefined);
    mount(<Probe query="(max-width: 767px)" />);
    expect(q('#out')!.textContent).toBe('false');
  });
});
