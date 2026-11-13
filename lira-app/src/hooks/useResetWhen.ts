import { useState } from 'react';

/**
 * Runs `reset` while rendering: on the first render, and again whenever one of `deps` changes.
 * Use it to restart a draft or form when what it edits changes (a dialog opens, another item is picked). It replaces an
 * effect that only calls setState: React applies the new state before the screen is drawn, so no frame shows stale values.
 * `reset` may only set this component's own state.
 */
export function useResetWhen(deps: readonly unknown[], reset: () => void): void {
  const [last, setLast] = useState<readonly unknown[] | null>(null);
  if (last === null || deps.length !== last.length || deps.some((d, i) => !Object.is(d, last[i]))) {
    setLast(deps);
    reset();
  }
}
