import { Check, Pencil, Timer, X } from 'lucide-react';
import { useState } from 'react';
import { MAX_MINUTES, MIN_MINUTES } from '../../utils/storyRound';
import { FIELD } from '../standup/parts';

const OPTIONS = Array.from({ length: MAX_MINUTES - MIN_MINUTES + 1 }, (_, i) => MIN_MINUTES + i);

/** The time each ticket is open for voting, with a small pencil to change it. A new time applies to the tickets put up from then on. */
export function VotingTimeTile({ minutes, canChange, onChange }: { minutes: number; canChange: boolean; onChange: (minutes: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(minutes));
  return (
    <div className="bg-white border border-lira-border rounded-2xl px-4 py-3 flex items-center gap-3">
      <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-amber-600 bg-amber-50"><Timer className="w-4 h-4" /></span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <form onSubmit={e => { e.preventDefault(); onChange(Number(value)); setEditing(false); }} className="flex items-center gap-1.5">
            <select aria-label="Time to vote on each ticket" value={value} onChange={e => setValue(e.target.value)} className={`${FIELD} !w-auto`}>
              {OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}
            </select>
            <button type="submit" aria-label="Save the time" className="p-1.5 rounded-lg bg-lira-blue text-lira-on-blue cursor-pointer"><Check className="w-3.5 h-3.5" /></button>
            <button type="button" aria-label="Cancel changing the time" onClick={() => setEditing(false)} className="p-1.5 rounded-lg border border-lira-border bg-white text-lira-text cursor-pointer"><X className="w-3.5 h-3.5" /></button>
          </form>
        ) : <div className="text-2xl font-semibold text-lira-text leading-none">{minutes} min</div>}
        <div className="text-2xs text-lira-muted mt-1">{editing ? 'Applies to the next tickets put up' : 'Time to vote on each ticket'}</div>
      </div>
      {canChange && !editing && <button type="button" aria-label="Change the time to vote" title="Change the time to vote" onClick={() => { setValue(String(minutes)); setEditing(true); }} className="p-1.5 rounded-lg text-lira-muted hover:bg-gray-100 hover:text-lira-text cursor-pointer"><Pencil className="w-4 h-4" /></button>}
    </div>
  );
}
