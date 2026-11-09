import { flushSync } from 'react-dom';

/** The nearest parent that scrolls. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === 'auto' || o === 'scroll') return p;
  }
  return null;
}

let keepingUntil = 0;
/** True for a moment after keepPlace moved the page, so a dropdown does not take that movement for the person scrolling. */
export const isKeepingPlace = () => Date.now() < keepingUntil;

/**
 * Runs a change that opens or closes a section, or filters a list, and keeps the page where it was: the element that was
 * pressed (or the heading of the list) stays at the same place on the screen, instead of the page jumping when the
 * content above or below it changes height. When the page has become too short to scroll back, blank space is added at
 * the bottom just long enough for that, and it is taken away again the next time the page grows.
 *
 *   <button onClick={e => keepPlace(e.currentTarget, () => setCollapsed(c => !c))}>
 */
export function keepPlace(trigger: HTMLElement, change: () => void): void {
  const scroller = scrollParent(trigger);
  if (!scroller) { change(); return; }
  const before = trigger.getBoundingClientRect().top;
  const anchor = scroller.style.overflowAnchor;
  scroller.style.overflowAnchor = 'none'; // the browser's own correction would add to ours
  keepingUntil = Date.now() + 250;
  flushSync(change);
  if (trigger.isConnected) {
    // start clean: remove blank space added earlier, then add only what this change needs
    const base = scroller.dataset.basePad ?? scroller.style.paddingBottom;
    if (scroller.dataset.slack) { scroller.style.paddingBottom = base; delete scroller.dataset.slack; }
    const delta = trigger.getBoundingClientRect().top - before;
    if (delta > 0) {
      const room = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
      if (delta > room) {
        if (scroller.dataset.basePad === undefined) scroller.dataset.basePad = scroller.style.paddingBottom;
        const pad = parseFloat(getComputedStyle(scroller).paddingBottom) || 0;
        scroller.style.paddingBottom = `${pad + (delta - room)}px`;
        scroller.dataset.slack = '1';
      }
    }
    scroller.scrollTop += trigger.getBoundingClientRect().top - before;
  }
  scroller.style.overflowAnchor = anchor;
  keepingUntil = Date.now() + 250;
}
