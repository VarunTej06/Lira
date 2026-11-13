import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * The highlight behind the sidebar's active row. It glides between rows (but does not slide in from the top the first time),
 * and keeps measuring while sections open or close and while fonts load, so it stays on its row.
 * `measureKey` changes whenever the layout might have moved.
 */
export function useActiveIndicator(measureKey: string, disabled: boolean) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ top: 0, height: 0, visible: false });
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (indicator.visible && !animated) {
      const t = window.setTimeout(() => setAnimated(true), 80);
      return () => window.clearTimeout(t);
    }
  }, [indicator.visible, animated]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || disabled) return;
    const measure = () => {
      const el = panel.querySelector<HTMLElement>('[data-active="true"]');
      if (!el) { setIndicator(prev => (prev.visible ? { ...prev, visible: false } : prev)); return; }
      const rect = el.getBoundingClientRect();
      const top = rect.top - panel.getBoundingClientRect().top + panel.scrollTop;
      setIndicator(prev => (prev.visible && Math.abs(prev.top - top) < 0.5 && Math.abs(prev.height - rect.height) < 0.5 ? prev : { top, height: rect.height, visible: true }));
    };
    measure();
    const start = performance.now();
    let raf = 0;
    const loop = () => { measure(); if (performance.now() - start < 450) raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : undefined;
    ro?.observe(panel);
    Array.from(panel.children).forEach(c => ro?.observe(c));
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, [measureKey, disabled]);

  return { panelRef, indicator, indicatorAnimated: animated };
}
