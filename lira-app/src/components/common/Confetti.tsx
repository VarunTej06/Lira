import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CELEBRATE_EVENT, type CelebrateKind } from '../../utils/celebrate';

interface Piece { id: number; dx: number; rise: number; fall: number; spin: number; size: number; color: string; round: boolean; delay: number }
interface Burst { id: number; x: number; y: number; pieces: Piece[] }

const COLORS = ['#4C9AFF', '#36B37E', '#FFAB00', '#FF5630', '#6554C0', '#00B8D9'];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

function makeBurst(id: number, x: number, y: number, kind: CelebrateKind): Burst {
  const n = kind === 'sprint' ? 70 : 26;
  const spread = kind === 'sprint' ? 340 : 190;
  const pieces = Array.from({ length: n }, (_, i) => ({
    id: i,
    dx: rand(-spread, spread),
    rise: rand(80, kind === 'sprint' ? 300 : 190),
    fall: rand(60, 260),
    spin: rand(-540, 540),
    size: rand(5, 10),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    round: Math.random() < 0.4,
    delay: rand(0, 0.08),
  }));
  return { id, x, y, pieces };
}

/**
 * Confetti for good news (see utils/celebrate.ts). It starts where the mouse last was, so it feels like it came from
 * what you just did, and it never blocks clicks. Skipped when the user prefers reduced motion.
 */
export const Confetti: React.FC = () => {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const pointer = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const counter = useRef(0);

  useEffect(() => {
    const track = (e: PointerEvent) => { pointer.current = { x: e.clientX, y: e.clientY }; };
    const onCelebrate = (e: Event) => {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      const kind = ((e as CustomEvent).detail?.kind as CelebrateKind) || 'done';
      // a closed sprint is celebrated from the middle of the screen, a ticket from where you clicked
      const origin = kind === 'sprint' ? { x: window.innerWidth / 2, y: window.innerHeight * 0.4 } : pointer.current;
      const id = ++counter.current;
      setBursts(b => [...b.slice(-2), makeBurst(id, origin.x, origin.y, kind)]);
      window.setTimeout(() => setBursts(b => b.filter(x => x.id !== id)), 2200);
    };
    window.addEventListener('pointermove', track, { passive: true });
    window.addEventListener('pointerdown', track, { passive: true, capture: true });
    window.addEventListener(CELEBRATE_EVENT, onCelebrate);
    return () => {
      window.removeEventListener('pointermove', track);
      window.removeEventListener('pointerdown', track, { capture: true });
      window.removeEventListener(CELEBRATE_EVENT, onCelebrate);
    };
  }, []);

  if (!bursts.length) return null;
  return (
    <div aria-hidden className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden" data-testid="confetti">
      {bursts.map(b => b.pieces.map(p => (
        <motion.span
          key={`${b.id}-${p.id}`}
          className="absolute"
          style={{ left: b.x, top: b.y, width: p.size, height: p.round ? p.size : p.size * 0.5, background: p.color, borderRadius: p.round ? '50%' : 2 }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{
            x: [0, p.dx * 0.6, p.dx],
            y: [0, -p.rise, p.fall],
            rotate: p.spin,
            opacity: [1, 1, 0],
            scale: [1, 1, 0.8],
          }}
          transition={{ duration: 1.6, delay: p.delay, times: [0, 0.4, 1], ease: 'easeOut' }}
        />
      )))}
    </div>
  );
};
