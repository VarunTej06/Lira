interface SavedMessage { id: number; text: string }

let current: SavedMessage | null = null;
let counter = 0;
let timer: number | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
export const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const snapshot = () => current;

export const SHOW_MS = 3800;

export function notifySaved(text = 'Changes saved') {
  counter += 1;
  current = { id: counter, text };
  emit();
  window.clearTimeout(timer);
  timer = window.setTimeout(() => { current = null; emit(); }, SHOW_MS);
}

/** Closes the card now. */
export function dismissSaved() {
  window.clearTimeout(timer);
  current = null;
  emit();
}

/** Stops the pending hide timer (used when the toast host unmounts). */
export const clearSavedTimer = () => window.clearTimeout(timer);
