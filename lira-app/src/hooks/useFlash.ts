import { useCallback, useEffect, useRef, useState } from 'react';

/** A short message for the toast: `flash` shows it and it goes away by itself. */
export function useFlash(ms = 3500) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const flash = useCallback((msg: string) => {
    setMessage(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), ms);
  }, [ms]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { message, flash };
}
