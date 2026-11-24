import { useLayoutEffect, useState, type RefObject } from 'react';

export interface Size { w: number; h: number }

/**
 * The inner width and height of an element, kept up to date as it is resized. Both are 0 until the element has been measured,
 * and stay 0 where the browser cannot observe sizes.
 */
export function useElementSize(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const box = entries[0].contentRect;
      setSize(prev => (prev.w === Math.floor(box.width) && prev.h === Math.floor(box.height) ? prev : { w: Math.floor(box.width), h: Math.floor(box.height) }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
