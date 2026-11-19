import { useEffect, useRef, useState, type RefObject } from 'react';

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Turns true once, when the element first scrolls into view. It is already true where nothing could watch (no
 * IntersectionObserver) or where the person asked for less motion, so content is never left hidden waiting for it.
 */
export function useInView<T extends Element>(): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined' || reducedMotion());
  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    const watcher = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setSeen(true); watcher.disconnect(); }
    }, { threshold: 0.15 });
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [seen]);
  return [ref, seen];
}
