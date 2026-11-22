import { useEffect, useState } from 'react';

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Types its text one letter at a time. It starts again from nothing each time it is mounted, so the caller shows it only while its
 * section is on screen. With reduced motion the whole text is there at once.
 */
export function TypedText({ text, letterMs = 110 }: { text: string; letterMs?: number }) {
  const [typed, setTyped] = useState(() => (reducedMotion() ? text.length : 0));
  useEffect(() => {
    if (typed >= text.length) return;
    const timer = setTimeout(() => setTyped(n => n + 1), letterMs);
    return () => clearTimeout(timer);
  }, [typed, text, letterMs]);
  return <>{text.slice(0, typed)}</>;
}
