/** Undo and redo for any value: the states before the present one, and the ones that were undone. */
export interface History<T> { past: T[]; present: T; future: T[] }

export const start = <T>(present: T): History<T> => ({ past: [], present, future: [] });

/** A new present. A change that leaves the value as it was (the same JSON) adds nothing. The past keeps at most `limit` states. */
export function push<T>(h: History<T>, next: T, limit = 100): History<T> {
  if (JSON.stringify(next) === JSON.stringify(h.present)) return h;
  return { past: [...h.past, h.present].slice(-limit), present: next, future: [] };
}

export const undo = <T>(h: History<T>): History<T> => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h);
export const redo = <T>(h: History<T>): History<T> => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h);
