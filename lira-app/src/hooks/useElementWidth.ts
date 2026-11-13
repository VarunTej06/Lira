import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * The inner width of an element, kept up to date as it is resized (window, sidebar, zoom).
 * It is 0 until the element has been measured, and stays 0 where the browser cannot observe sizes.
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => setWidth(Math.floor(entries[0].contentRect.width))); // also reports the first size
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
