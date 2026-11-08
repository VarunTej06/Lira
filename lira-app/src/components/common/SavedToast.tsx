import React, { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from './motion';

/**
 * The "saved" confirmation: a small card slides down from the top, a tick draws itself inside a green circle, and it leaves again.
 *
 *   notifySaved();                              // "Changes saved"
 *   notifySaved('Profile saved');
 *
 * <SavedToastHost /> must be rendered once, near the top of the app.
 */

interface SavedMessage { id: number; text: string }

let current: SavedMessage | null = null;
let counter = 0;
let timer: number | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => current;

const SHOW_MS = 2400;

export function notifySaved(text = 'Changes saved') {
  counter += 1;
  current = { id: counter, text };
  emit();
  window.clearTimeout(timer);
  timer = window.setTimeout(() => { current = null; emit(); }, SHOW_MS);
}

export const SavedToastHost: React.FC = () => {
  const msg = useSyncExternalStore(subscribe, snapshot, snapshot);

  useEffect(() => () => window.clearTimeout(timer), []);

  return createPortal(
    <div className="fixed top-5 inset-x-0 z-[400] flex justify-center pointer-events-none" aria-live="polite">
      <AnimatePresence>
        {msg && (
          <motion.div
            key={msg.id}
            role="status"
            data-testid="saved-toast"
            initial={{ opacity: 0, y: -28, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96, transition: { duration: 0.16, ease: 'easeIn' as const } }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="relative flex items-center gap-3 pl-3 pr-5 py-2.5 rounded-2xl bg-white text-lira-text border border-lira-border shadow-2xl overflow-hidden"
          >
            <span className="relative flex w-9 h-9 items-center justify-center flex-shrink-0">
              <motion.span
                className="absolute inset-0 rounded-full bg-emerald-500/25"
                initial={{ scale: 0.6, opacity: 0.9 }}
                animate={{ scale: 1.7, opacity: 0 }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.12 }}
              />
              <motion.span
                className="absolute inset-0 rounded-full bg-emerald-500"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              />
              <svg viewBox="0 0 24 24" className="relative w-5 h-5" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <motion.path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.32, ease: 'easeOut', delay: 0.14 }}
                />
              </svg>
            </span>
            <span className="text-sm font-semibold">{msg.text}</span>
            <motion.span
              aria-hidden
              className="absolute left-0 bottom-0 h-0.5 bg-emerald-500 origin-left w-full"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: SHOW_MS / 1000, ease: 'linear' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
};
