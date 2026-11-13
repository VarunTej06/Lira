import type { Transition } from 'framer-motion';

/** A quick, slightly bouncy spring for things that pop: menus, dialogs. */
export const pop: Transition = { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 };
export { AnimatePresence, motion } from 'framer-motion';

/** A calmer spring for things that slide: panels, tab underlines. */
export const slide: Transition = { type: 'spring', stiffness: 280, damping: 32, mass: 0.9 };

/** Dialog: the backdrop fades, the panel rises and settles. Both animate out when closed. */
export const dialogBackdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.18 },
};

export const dialogPanel = {
  initial: { opacity: 0, y: 28, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.14, ease: 'easeIn' as const } }, // closing is quick
  transition: pop,
};

/** A small menu or dropdown: grows out of its corner. */
export const menuPop = {
  initial: { opacity: 0, scale: 0.92, y: -6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.1, ease: 'easeIn' as const } },
  transition: { type: 'spring' as const, stiffness: 600, damping: 32 },
};
