import { useEffect, type RefObject } from 'react';
import { isKeepingPlace } from '../utils/keepPlace';

/** Closes a pop-up list or calendar on a click elsewhere, Escape, a resize, or when the page behind it scrolls (its own list scrolling does not count). */
export function useDismiss(open: boolean, setOpen: (open: boolean) => void, panel: RefObject<HTMLElement | null>, trigger: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); trigger.current?.focus(); } };
    const close = () => setOpen(false);
    // scrolling the page closes it (it would otherwise stay on the screen while the button moves away); scrolling its own list does not
    const onScroll = (e: Event) => { if (isKeepingPlace()) return; if (!panel.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away, true);
    document.addEventListener('keydown', esc, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', away, true);
      document.removeEventListener('keydown', esc, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, setOpen, panel, trigger]);
}
