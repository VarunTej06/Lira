import React, { useEffect } from 'react';
import {
  AnimatePresence, MotionConfig, animate, motion, useMotionValue, useReducedMotion, useTransform,
  type Transition, type Variants,
} from 'framer-motion';

/**
 * Motion for the whole app, in one place so it feels the same everywhere.
 * People who ask their system for reduced motion get no movement (MotionConfig below turns transforms off,
 * and the count-up, line drawing and confetti are skipped).
 */

/** A quick, slightly bouncy spring for things that pop: menus, dialogs. */
export const pop: Transition = { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 };
/** A calmer spring for things that slide: panels, tab underlines. */
export const slide: Transition = { type: 'spring', stiffness: 280, damping: 32, mass: 0.9 };

/** Wrap the app once. */
export const MotionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MotionConfig reducedMotion="user">{children}</MotionConfig>
);

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

/** A group of items that arrive one after the other. Use `staggerParent` on the container and `staggerChild` on each item. */
export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};
export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: slide },
};

/** A message that slides up from the bottom of the screen and leaves the same way. */
export const Toast: React.FC<{ message: string | null; className?: string }> = ({ message, className = '' }) => (
  <AnimatePresence>
    {message && (
      <motion.div
        key={message}
        role="status"
        initial={{ opacity: 0, y: 28, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={pop}
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50 ${className}`}
      >
        {message}
      </motion.div>
    )}
  </AnimatePresence>
);

/**
 * A number that counts up to its value (and from the old value to a new one when it changes).
 * With reduced motion it simply shows the number.
 */
export const CountUp: React.FC<{ value: number; suffix?: string; duration?: number; className?: string }> = ({ value, suffix = '', duration = 0.9, className }) => {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, v => `${Math.round(v)}${suffix}`);
  useEffect(() => {
    if (reduce) { mv.set(value); return; }
    const controls = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, reduce, duration, mv]);
  return <motion.span className={className}>{text}</motion.span>;
};

/** Shows a count-up for values like 20 or "45%"; anything else (a dash, "3/9") is shown as it is. */
export const AnimatedValue: React.FC<{ value: React.ReactNode; className?: string }> = ({ value, className }) => {
  if (typeof value === 'number') return <CountUp value={value} className={className} />;
  if (typeof value === 'string') {
    const m = /^(\d+)(%?)$/.exec(value);
    if (m) return <CountUp value={Number(m[1])} suffix={m[2]} className={className} />;
  }
  return <span className={className}>{value}</span>;
};

/** A bar that grows to its width. `percent` is 0 to 100. */
export const GrowBar: React.FC<{ percent: number; className?: string }> = ({ percent, className = '' }) => (
  <motion.div
    className={className}
    initial={{ width: 0 }}
    animate={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
  />
);

export { AnimatePresence, motion };
