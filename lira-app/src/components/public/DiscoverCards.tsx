import { useEffect, useRef, useState } from 'react';
import { useInView } from '../../hooks/useInView';
import { scrollEdge, type ScrollEdge } from '../../utils/scrollEdge';
import { DISCOVER_CARDS, TONE_CLASS } from './discoverContent';
import { PAGE_WIDTH } from './styles';

const ARROW = 'w-12 h-12 rounded-full flex items-center justify-center bg-lira-text text-lira-bg disabled:bg-gray-200 disabled:text-lira-muted disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lira-blue';
const HIDE_SCROLLBAR = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

function Arrow({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === 'left' ? 'M16 10H4M9 5l-5 5 5 5' : 'M4 10h12M11 5l5 5-5 5'} />
    </svg>
  );
}

/** How long one card takes to fly in, and how long after it the next one starts (it is already well on its way, like the carriages of a train). */
export const SLIDE_MS = 600;
export const STAGGER_MS = 220;

/**
 * "Discover the latest": a row of cards. Each time the row scrolls into view the cards fly in from the far right edge of the screen, fast,
 * one after another with a small overshoot, and when it scrolls out they go back to wait. Once they have all arrived the row scrolls sideways with the
 * arrows, the mouse or a swipe.
 */
export function DiscoverCards() {
  const [rowRef, seen] = useInView<HTMLDivElement>();
  const scroller = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState<ScrollEdge>('start');
  // While the cards are still travelling the row cannot be scrolled: a card waiting off screen would otherwise stretch it
  const [arrived, setArrived] = useState(seen);
  useEffect(() => {
    if (!seen) return;
    const done = setTimeout(() => setArrived(true), (DISCOVER_CARDS.length - 1) * STAGGER_MS + SLIDE_MS + 100);
    return () => { clearTimeout(done); setArrived(false); };
  }, [seen]);

  const sync = () => { const el = scroller.current; if (el) setEdge(scrollEdge(el.scrollLeft, el.clientWidth, el.scrollWidth)); };
  const step = (dir: 1 | -1) => {
    const el = scroller.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * (card.offsetWidth + 16), behavior: smooth ? 'smooth' : 'auto' });
  };

  return (
    <section className="border-t border-lira-border overflow-hidden" aria-labelledby="discover-title">
      <div className={`${PAGE_WIDTH} py-14 flex flex-col gap-8`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h2 id="discover-title" className="text-3xl sm:text-5xl font-bold tracking-tight mb-3">Discover the latest</h2>
            <p className="text-lira-muted text-lg">We are building in the open. Here is what changed, and what is next.</p>
          </div>
          <div className="flex gap-3">
            <button type="button" aria-label="Previous cards" disabled={edge === 'start'} onClick={() => step(-1)} className={ARROW}><Arrow dir="left" /></button>
            <button type="button" aria-label="Next cards" disabled={edge === 'end'} onClick={() => step(1)} className={ARROW}><Arrow dir="right" /></button>
          </div>
        </div>
        <div ref={rowRef}>
          <ul ref={scroller} onScroll={sync} className={`flex gap-4 snap-x snap-mandatory pb-2 ${arrived ? 'overflow-x-auto' : 'overflow-x-hidden'} ${HIDE_SCROLLBAR}`}>
            {DISCOVER_CARDS.map((card, i) => (
              <li
                key={card.title}
                style={{ animationDelay: seen ? `${i * STAGGER_MS}ms` : '0ms' }}
                className={`snap-start shrink-0 w-72 sm:w-80 min-h-80 rounded-xl p-6 flex flex-col gap-4 motion-reduce:animate-none ${seen ? 'animate-card-in' : 'opacity-0'} ${TONE_CLASS[card.tone]}`}
              >
                <span className="self-start text-3xs font-bold tracking-widest rounded bg-lira-bg text-lira-text px-2 py-1">{card.tag}</span>
                <h3 className="text-2xl font-bold tracking-tight">{card.title}</h3>
                <p className="opacity-90">{card.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
