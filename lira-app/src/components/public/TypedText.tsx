import { useEffect, useState } from 'react';

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Types its text one letter at a time, holds the whole text for a moment, then clears it and types it again. It starts from nothing
 * each time it is mounted, so the caller shows it only while its section is on screen. With reduced motion the whole text is there
 * at once and stays.
 */
export function TypedText({ text, letterMs = 110, holdMs = 2000 }: { text: string; letterMs?: number; holdMs?: number }) {
  const [typed, setTyped] = useState(() => (reducedMotion() ? text.length : 0));
  useEffect(() => {
    if (typed >= text.length && reducedMotion()) return;
    const timer = setTimeout(() => setTyped(typed >= text.length ? 0 : typed + 1), typed >= text.length ? holdMs : letterMs);
    return () => clearTimeout(timer);
  }, [typed, text, letterMs, holdMs]);
  return <>{text.slice(0, typed)}</>;
}
