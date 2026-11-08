import React, { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
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

const SHOW_MS = 3800;
const RING_R = 12;
const RING_LEN = 2 * Math.PI * RING_R;

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
            className="relative pointer-events-auto flex items-center gap-3 pl-3 pr-2.5 py-2.5 rounded-2xl bg-white text-lira-text border border-lira-border shadow-2xl overflow-hidden"
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
            <span className="text-sm font-semibold pr-1">{msg.text}</span>
            <button
              type="button"
              onClick={dismissSaved}
              aria-label="Close notification"
              data-testid="saved-toast-close"
              className="group -m-1 p-1 rounded-full cursor-pointer focus:outline-none"
            >
              <span className="relative flex w-7 h-7 items-center justify-center rounded-full text-gray-500 transition-colors group-hover:bg-red-50 group-hover:text-red-600 group-focus-visible:ring-2 group-focus-visible:ring-red-300">
                {/* a full circle around the cross that empties over the time the card stays */}
                <svg viewBox="0 0 28 28" className="absolute inset-0 w-full h-full -rotate-90" aria-hidden data-testid="saved-toast-ring">
                  <circle cx="14" cy="14" r={RING_R} fill="none" strokeWidth="2" className="stroke-gray-200 transition-colors group-hover:stroke-red-200" />
                  <motion.circle
                    cx="14" cy="14" r={RING_R} fill="none" strokeWidth="2" strokeLinecap="round"
                    className="stroke-emerald-500 transition-colors group-hover:stroke-red-500"
                    strokeDasharray={RING_LEN}
                    initial={{ strokeDashoffset: 0 }}
                    animate={{ strokeDashoffset: RING_LEN }}
                    transition={{ duration: SHOW_MS / 1000, ease: 'linear' }}
                  />
                </svg>
                <X className="relative w-3.5 h-3.5" strokeWidth={2.5} />
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
};
