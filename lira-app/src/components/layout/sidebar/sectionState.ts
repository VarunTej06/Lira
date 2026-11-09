import { useState } from 'react';
import { appStorage } from '../../../utils/appStorage';

export function prevOf(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Expanded/collapsed state of a sidebar section, remembered between sessions. */
export function useSectionState(name: string, initial: boolean): [boolean, (v: boolean) => void] {
  const key = `lira_sidebar_section_${name}`;
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const v = appStorage.get(key);
      return v === null ? initial : v === 'true';
    } catch {
      return initial;
    }
  });
  const set = (v: boolean) => {
    setOpen(v);
    try { appStorage.set(key, String(v)); } catch { /* storage unavailable */ }
  };
  return [open, set];
}
