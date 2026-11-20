import { useEffect, useRef, useState, type RefObject } from 'react';

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * True while the element is on screen, false once it has scrolled out, so an animation can play again on every visit to
 * the section. It stays true where nothing could watch (no IntersectionObserver) or where the person asked for less
 * motion, so content is never left hidden waiting for it.
 */
export function useInView<T extends Element>(): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined' || reducedMotion());
  const alwaysOn = typeof IntersectionObserver === 'undefined' || reducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (alwaysOn || !el) return;
    const watcher = new IntersectionObserver(entries => {
      const last = entries[entries.length - 1];
      if (last) setInView(last.isIntersecting);
    }, { threshold: 0.15 });
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [alwaysOn]);
  return [ref, inView];
}
