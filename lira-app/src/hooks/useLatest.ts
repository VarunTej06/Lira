import { useLayoutEffect, useRef, type MutableRefObject } from 'react';

/**
 * A ref that always holds the newest value, for callbacks that outlive a render (editor handlers, timers).
 * It is updated right after each commit, before the screen is drawn, never during render.
 */
export function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => { ref.current = value; });
  return ref;
}
