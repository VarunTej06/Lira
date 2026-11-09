import { afterEach, describe, expect, it, vi } from 'vitest';
import { isKeepingPlace, keepPlace } from './keepPlace';

afterEach(() => { document.body.innerHTML = ''; });

/**
 * jsdom has no layout, so the page is faked: the scroller reports its sizes, and the trigger's position is a number that
 * the "change" moves. This checks the logic: put the trigger back where it was, and add blank space only when needed.
 */
function page(opts: { scrollHeight: number; clientHeight: number; scrollTop: number; triggerTop: number }) {
  const scroller = document.createElement('div');
  scroller.style.overflowY = 'auto';
  const trigger = document.createElement('button');
  scroller.appendChild(trigger);
  document.body.appendChild(scroller);
  const state = { ...opts };
  Object.defineProperty(scroller, 'scrollHeight', { get: () => state.scrollHeight, configurable: true });
  Object.defineProperty(scroller, 'clientHeight', { get: () => state.clientHeight, configurable: true });
  // like a real browser: the scroll position can never be more than the page allows (blank padding at the bottom adds room)
  let top = opts.scrollTop;
  const max = () => Math.max(0, state.scrollHeight - state.clientHeight + (parseFloat(scroller.style.paddingBottom) || 0));
  Object.defineProperty(scroller, 'scrollTop', { get: () => Math.min(top, max()), set: v => { top = Math.max(0, Math.min(v, max())); }, configurable: true });
  const realTop = () => Math.min(top, max());
  // the trigger sits at (its position in the page) minus the scroll position
  const inPage = { y: opts.triggerTop + opts.scrollTop };
  trigger.getBoundingClientRect = () => ({ top: inPage.y - realTop() } as DOMRect);
  return { scroller, trigger, state, inPage };
}

describe('keepPlace', () => {
  it('runs the change and leaves an element with no scrolling parent alone', () => {
    const el = document.createElement('button');
    document.body.appendChild(el);
    const change = vi.fn();
    keepPlace(el, change);
    expect(change).toHaveBeenCalledTimes(1);
  });

  it('keeps the pressed element where it was when content above it grows', () => {
    const p = page({ scrollHeight: 3000, clientHeight: 800, scrollTop: 500, triggerTop: 300 });
    keepPlace(p.trigger, () => { p.inPage.y += 200; p.state.scrollHeight += 200; }); // 200px of content opens above it
    expect(p.trigger.getBoundingClientRect().top).toBe(300);
  });

  it('keeps it in place when content above it shrinks', () => {
    const p = page({ scrollHeight: 3000, clientHeight: 800, scrollTop: 900, triggerTop: 300 });
    keepPlace(p.trigger, () => { p.inPage.y -= 250; p.state.scrollHeight -= 250; });
    expect(p.trigger.getBoundingClientRect().top).toBe(300);
  });

  it('adds blank space at the bottom when the page became too short to scroll back, and removes it again later', () => {
    const p = page({ scrollHeight: 2000, clientHeight: 800, scrollTop: 1100, triggerTop: 450 });
    // the list below the trigger vanishes: the page is now only 1000 tall, so scrollTop would be clamped to 200
    keepPlace(p.trigger, () => { p.state.scrollHeight = 1000; });
    expect(p.trigger.getBoundingClientRect().top).toBe(450); // still where it was
    expect(p.scroller.dataset.slack).toBe('1');
    expect(parseFloat(p.scroller.style.paddingBottom)).toBeGreaterThan(0);
    // the list comes back: the blank space is no longer needed
    keepPlace(p.trigger, () => { p.state.scrollHeight = 2000; });
    expect(p.scroller.dataset.slack).toBeUndefined();
    expect(p.trigger.getBoundingClientRect().top).toBe(450);
  });

  it('tells dropdowns to ignore the scroll it causes, for a moment', () => {
    const p = page({ scrollHeight: 3000, clientHeight: 800, scrollTop: 500, triggerTop: 300 });
    keepPlace(p.trigger, () => {});
    expect(isKeepingPlace()).toBe(true);
  });
});
