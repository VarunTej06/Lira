import React, { useEffect, useRef } from 'react';

/** Small helpers shared by the top bar menus. */

export function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

export function relativeTime(date: Date | string | undefined): string {
  if (!date) return 'recently';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

/** True on devices with a real hover pointer (mouse / trackpad) — hover menus are skipped on touch. */
export const canHoverDevice = () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover)').matches;

/** Opens a dropdown shortly after the pointer enters it and closes it after the pointer leaves. */
export function useHoverMenu(setOpen: (v: boolean) => void) {
  const timer = useRef<number | undefined>(undefined);
  const clear = () => { if (timer.current) window.clearTimeout(timer.current); };
  useEffect(() => clear, []);
  return {
    onMouseEnter: () => {
      if (!canHoverDevice()) return;
      clear();
      timer.current = window.setTimeout(() => setOpen(true), 90);
    },
    onMouseLeave: () => {
      if (!canHoverDevice()) return;
      clear();
      timer.current = window.setTimeout(() => setOpen(false), 240);
    },
  };
}
