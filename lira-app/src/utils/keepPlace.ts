import { flushSync } from 'react-dom';

/** The nearest parent that scrolls. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === 'auto' || o === 'scroll') return p;
  }
  return null;
}

/**
 * Runs a change that opens or closes a section and keeps the page where it was: the button that was pressed stays at
 * the same place on the screen, instead of the page jumping when the content above or below it changes height.
 *
 *   <button onClick={e => keepPlace(e.currentTarget, () => setCollapsed(c => !c))}>
 */
export function keepPlace(trigger: HTMLElement, change: () => void): void {
  const scroller = scrollParent(trigger);
  if (!scroller) { change(); return; }
  const before = trigger.getBoundingClientRect().top;
  const anchor = scroller.style.overflowAnchor;
  scroller.style.overflowAnchor = 'none'; // the browser's own correction would add to ours
  flushSync(change);
  if (trigger.isConnected) scroller.scrollTop += trigger.getBoundingClientRect().top - before;
  scroller.style.overflowAnchor = anchor;
}
