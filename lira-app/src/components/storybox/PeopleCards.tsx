import { useEffect, useState } from 'react';
import type { Person } from '../../utils/storyRound';

const STAGGER_MS = 140;

/** One person's card: face down while voting (filled once they have voted), and flips over to show their points when revealed. */
function PersonCard({ person, points, reveal, index }: { person: Person; points: number | undefined; reveal: boolean; index: number }) {
  const [up, setUp] = useState(false);
  useEffect(() => {
    if (!reveal) return;
    const t = window.setTimeout(() => setUp(true), 60 + index * STAGGER_MS);
    return () => { window.clearTimeout(t); setUp(false); };
  }, [reveal, index]);
  return (
    <li className="flex flex-col items-center gap-1 w-16">
      <div className="poker-flip w-14 h-20" data-face={up ? 'up' : 'down'}>
        <div className="poker-inner">
          <div className={`poker-back rounded-xl border-2 ${person.voted ? 'border-lira-blue bg-lira-blue' : 'border-dashed border-lira-border bg-white'}`} />
          <div className="poker-front rounded-xl border-2 border-lira-blue bg-white text-lg font-bold text-lira-text">{points ?? '–'}</div>
        </div>
      </div>
      <span className="max-w-full truncate text-3xs text-lira-muted" title={person.name}>{person.name}</span>
    </li>
  );
}

/** A row of cards, one for each person taking part. */
export function PeopleCards({ people, points, reveal }: { people: readonly Person[]; points: ReadonlyMap<string, number>; reveal: boolean }) {
  return (
    <ul aria-label="Cards on the table" className="flex flex-wrap gap-3">
      {people.map((p, i) => <PersonCard key={p.userId} person={p} points={points.get(p.userId)} reveal={reveal} index={i} />)}
    </ul>
  );
}
