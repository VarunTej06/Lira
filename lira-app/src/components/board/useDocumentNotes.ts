import { useEffect, useState } from 'react';
import { useResetWhen } from '../../hooks/useResetWhen';
import { appStorage } from '../../utils/appStorage';
import { templateFor } from './docsText';

/**
 * The notes of a space: loaded when the window opens (the starting template the first time, which is also stored once), edited
 * freely, and saved to the browser when asked. `saved` says whether the text on screen is what is stored.
 */
export function useDocumentNotes(isOpen: boolean, storageKey: string, spaceName: string | undefined) {
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useResetWhen([isOpen, storageKey, spaceName], () => {
    if (!isOpen) return;
    try {
      setContent(appStorage.get(storageKey) ?? templateFor(spaceName));
      setSaved(true);
    } catch {
      setContent('');
    }
  });
  // The starting template is written once, the first time the window opens
  useEffect(() => {
    if (!isOpen) return;
    try {
      if (appStorage.get(storageKey) === null) appStorage.set(storageKey, templateFor(spaceName));
    } catch { /* storage unavailable */ }
  }, [isOpen, storageKey, spaceName]);

  const edit = (text: string) => { setContent(text); setSaved(false); };
  const save = (text = content) => {
    try {
      appStorage.set(storageKey, text);
      setSaved(true);
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      console.error('Failed to save document to localStorage', e);
    }
  };
  /** Back to the starting template, saved at once. */
  const reset = () => { const text = templateFor(spaceName); setContent(text); save(text); };

  return { content, saved, lastSavedAt, edit, save, reset };
}
