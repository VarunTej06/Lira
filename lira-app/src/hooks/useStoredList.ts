import { useCallback, useEffect, useState } from 'react';
import { appStorage } from '../utils/appStorage';

/** The list saved under `key` (nothing, or something that is not a list, reads as empty). Items without a text id are left out. */
export function readList<T extends { id: string }>(key: string): T[] {
  try {
    const parsed: unknown = JSON.parse(appStorage.get(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is T => typeof x === 'object' && x !== null && typeof (x as { id?: unknown }).id === 'string') : [];
  } catch { return []; }
}

const eventOf = (key: string) => `lira-list-changed:${key}`;

export function writeList<T extends { id: string }>(key: string, list: T[]): void {
  try { appStorage.set(key, JSON.stringify(list)); } catch { return; } // a full or blocked store keeps the old list, and nothing says it changed
  window.dispatchEvent(new Event(eventOf(key)));
}

/**
 * A list of items kept in the browser's saved settings (and so in the data files, or on the server in the hosted edition), live in every
 * place that shows it. Used by the lists that are not tickets: mind maps and story boxes.
 */
export function useStoredList<T extends { id: string }>(key: string): [T[], (next: T[]) => void] {
  const [list, setList] = useState<T[]>(() => readList<T>(key));
  useEffect(() => {
    const refresh = () => setList(readList<T>(key));
    window.addEventListener(eventOf(key), refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(eventOf(key), refresh); window.removeEventListener('storage', refresh); };
  }, [key]);
  const save = useCallback((next: T[]) => writeList(key, next), [key]);
  return [list, save];
}
