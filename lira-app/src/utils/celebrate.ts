/** A small confetti burst for good news: a ticket reaching Done, a sprint being closed. The effect itself is in components/common/Confetti.tsx. */
export const CELEBRATE_EVENT = 'lira-celebrate';
export type CelebrateKind = 'done' | 'sprint';

let last = 0;

export function celebrate(kind: CelebrateKind = 'done'): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (kind === 'done' && now - last < 500) return; // moving several tickets at once gives one burst, not ten
  last = now;
  window.dispatchEvent(new CustomEvent(CELEBRATE_EVENT, { detail: { kind } }));
}
