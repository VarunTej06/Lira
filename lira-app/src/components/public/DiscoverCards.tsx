import { useRef, useState } from 'react';
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

/**
 * "Discover the latest": a row of cards. They slide in from the right the first time the row scrolls into view, then stay,
 * and the row scrolls sideways with the arrows, the mouse or a swipe.
 */
export function DiscoverCards() {
  const [rowRef, seen] = useInView<HTMLDivElement>();
  const scroller = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState<ScrollEdge>('start');

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
        <div ref={rowRef} className={`transition-all duration-700 ease-out ${seen ? 'translate-x-0 opacity-100' : 'translate-x-24 opacity-0'}`}>
          <ul ref={scroller} onScroll={sync} className={`flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 ${HIDE_SCROLLBAR}`}>
            {DISCOVER_CARDS.map(card => (
              <li key={card.title} className={`snap-start shrink-0 w-72 sm:w-80 min-h-80 rounded-xl p-6 flex flex-col gap-4 ${TONE_CLASS[card.tone]}`}>
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
