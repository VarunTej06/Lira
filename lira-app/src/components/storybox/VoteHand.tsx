/** The cards in a person's hand: pick one to vote, pick it again to take it back. Changing is allowed until the time is up. */
export function VoteHand({ scale, mine, disabled, onPick }: { scale: readonly number[]; mine: number | undefined; disabled: boolean; onPick: (points: number | null) => void }) {
  return (
    <div role="group" aria-label="Your points" className="flex flex-wrap gap-2">
      {scale.map(p => {
        const chosen = mine === p;
        return (
          <button key={p} type="button" disabled={disabled} aria-pressed={chosen} aria-label={`Vote ${p}`} onClick={() => onPick(chosen ? null : p)}
            className={`w-12 h-20 rounded-lg border-2 text-lg font-bold transition-transform duration-200 disabled:opacity-50 motion-reduce:transition-none ${chosen ? '-translate-y-2 border-lira-blue bg-lira-blue-light text-lira-text' : 'border-lira-border bg-lira-surface text-lira-text enabled:hover:-translate-y-1'}`}>
            {p}
          </button>
        );
      })}
    </div>
  );
}
