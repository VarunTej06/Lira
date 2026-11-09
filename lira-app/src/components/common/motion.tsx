import React, { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence, MotionConfig, animate, motion, useMotionValue, useReducedMotion, useTransform,
  type MotionValue,
} from 'framer-motion';
import { pop } from './motionPresets';

/**
 * Motion for the whole app, in one place so it feels the same everywhere.
 * People who ask their system for reduced motion get no movement (MotionConfig below turns transforms off,
 * and the count-up, line drawing and confetti are skipped).
 */


/** Wrap the app once. */
export const MotionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MotionConfig reducedMotion="user">{children}</MotionConfig>
);




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
 * True once the element has come into view (and stays true). Animations that start from this wait until you can
 * actually see them, so a figure or bar further down the page is not finished by the time you scroll to it.
 * `watchParent` watches the element's parent instead: a bar that starts at zero width has nothing of its own to see.
 * Where the browser cannot tell (old browsers, tests) it counts as seen at once.
 */
function useSeen<T extends HTMLElement>(watchParent = false): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (seen) return;
    const el = watchParent ? ref.current?.parentElement ?? ref.current : ref.current;
    if (!el) return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setSeen(true); io.disconnect(); }
    }, { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, watchParent]);
  return [ref, seen];
}

/**
 * A number that counts up to its value (and from the old value to a new one when it changes).
 * With reduced motion it simply shows the number.
 */
export const CountUp: React.FC<{ value: number; suffix?: string; duration?: number; className?: string }> = ({ value, suffix = '', duration = 0.9, className }) => {
  const reduce = useReducedMotion();
  const [ref, seen] = useSeen<HTMLSpanElement>();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, v => `${Math.round(v)}${suffix}`);
  useEffect(() => {
    if (reduce) { mv.set(value); return; }
    if (!seen) return; // starts from 0 when it comes into view
    const controls = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, reduce, duration, mv, seen]);
  return <motion.span ref={ref} className={className}>{text}</motion.span>;
};

/** Shows a count-up for values like 20 or "45%"; anything else (a dash, "3/9") is shown as it is. */
export const AnimatedValue: React.FC<{ value: React.ReactNode; className?: string }> = ({ value, className }) => {
  if (typeof value === 'number') return <CountUp value={value} className={className} />;
  if (typeof value === 'string') {
    const m = /^(\d+)(%|d|h|m|s)?$/.exec(value);
    if (m) return <CountUp value={Number(m[1])} suffix={m[2] ?? ''} className={className} />;
  }
  return <span className={className}>{value}</span>;
};

/** A bar that grows to its width. `percent` is 0 to 100. */
export const GrowBar: React.FC<{ percent: number; className?: string; /** seconds to wait before it starts */ delay?: number; style?: React.CSSProperties }> = ({ percent, className = '', delay = 0, style }) => {
  const [ref, seen] = useSeen<HTMLDivElement>(true);
  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial={{ width: 0 }}
      animate={{ width: seen ? `${Math.max(0, Math.min(100, percent))}%` : 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: seen ? delay : 0 }}
    />
  );
};

/**
 * Several coloured segments in one bar that fill from left to right as ONE smooth movement: the first segment grows,
 * and the moment it is full the next one carries on from its end, with no pause between them.
 */
export const SequenceBar: React.FC<{ segments: { percent: number; className: string }[]; className?: string; duration?: number }> = ({ segments, className = '', duration = 1.1 }) => {
  const reduce = useReducedMotion();
  const [ref, seen] = useSeen<HTMLDivElement>();
  const total = segments.reduce((a, s) => a + Math.max(0, s.percent), 0);
  const progress = useMotionValue(reduce ? total : 0);
  useEffect(() => {
    if (reduce) { progress.set(total); return; }
    if (!seen) return;
    progress.set(0);
    const controls = animate(progress, total, { duration, ease: [0.33, 1, 0.68, 1] });
    return () => controls.stop();
  }, [total, reduce, duration, progress, seen]);
  const sizes = segments.map(s => Math.max(0, s.percent));
  return (
    <div ref={ref} className={`flex ${className}`} data-testid="sequence-bar">
      {segments.map((s, i) => (
        <SequenceSegment key={i} progress={progress} from={sizes.slice(0, i).reduce((a, b) => a + b, 0)} size={sizes[i]} className={s.className} />
      ))}
    </div>
  );
};

const SequenceSegment: React.FC<{ progress: MotionValue<number>; from: number; size: number; className: string }> = ({ progress, from, size, className }) => {
  const width = useTransform(progress, p => `${Math.max(0, Math.min(size, p - from))}%`);
  return <motion.div className={`${className} flex-shrink-0`} style={{ width }} />;
};


/** A bar that grows upward from its base (for column charts). `heightPercent` is 0 to 100 of the box it sits in. */
export const GrowColumn: React.FC<{ heightPercent: number; className?: string; style?: React.CSSProperties; delay?: number; title?: string }> = ({ heightPercent, className = '', style, delay = 0, title }) => {
  const [ref, seen] = useSeen<HTMLDivElement>(true);
  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ ...style, transformOrigin: 'bottom' }}
      title={title}
      initial={{ height: 0 }}
      // grows when it comes into view (a chart lower down the page must not finish growing before you scroll to it)
      animate={{ height: seen ? `${Math.max(0, Math.min(100, heightPercent))}%` : 0 }}
      transition={{ duration: 1, ease: [0.33, 1, 0.68, 1], delay: seen ? delay : 0 }}
    />
  );
};

