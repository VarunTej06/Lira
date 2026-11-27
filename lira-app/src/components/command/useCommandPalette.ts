import { useEffect, useState } from 'react';

/** Whether the command palette is open, and Ctrl+K (Cmd+K on a Mac) to open or close it from anywhere, even while typing in a field. */
export function useCommandPalette(): { open: boolean; setOpen: (open: boolean) => void } {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return { open, setOpen };
}
