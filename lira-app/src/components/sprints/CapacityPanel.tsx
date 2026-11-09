import { AlertTriangle } from 'lucide-react';
import { capacityBarColor, capacityPercent, parseCapacity } from './planningRules';

interface Props {
  points: number;
  total: number;
  capacity: number | undefined;
  /** Average of the last closed sprints, or null when there is none. */
  suggestion: number | null;
  /** Tickets with no story points. */
  unestimated: number;
  closed: boolean;
  onCapacity: (value: number | undefined) => void;
}

/** What the sprint commits to, the team capacity box and the warnings about it. */
export function CapacityPanel({ points, total, capacity, suggestion, unestimated, closed, onCapacity }: Props) {
  const overBy = capacity !== undefined ? points - capacity : 0;
  const pct = capacityPercent(points, capacity);
  return (
    <div className="bg-white border border-lira-border rounded-xl p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <div className="text-2xs uppercase tracking-wide text-lira-muted font-semibold">Committed</div>
          <div className="text-lg font-semibold text-lira-text" data-testid="plan-points">{points} <span className="text-xs font-normal text-lira-muted">points · {total} tickets</span></div>
        </div>
        <label className="text-xs text-lira-muted flex items-center gap-2">
          Team capacity
          <input
            type="number"
            min={0}
            value={capacity ?? ''}
            placeholder="points"
            aria-label="Team capacity in story points"
            onChange={e => onCapacity(parseCapacity(e.target.value))}
            className="w-20 text-sm border border-lira-border rounded-lg px-2 py-1 bg-white text-lira-text focus:outline-none focus:border-lira-blue"
          />
        </label>
        {capacity === undefined && suggestion !== null && (
          <button onClick={() => onCapacity(suggestion)} className="text-xs text-lira-blue hover:underline cursor-pointer">
            Use {suggestion} (average of the last closed sprints)
          </button>
        )}
      </div>
      {capacity !== undefined && capacity > 0 && (
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={points} aria-label="Points against capacity">
          <div className={`${capacityBarColor(overBy, pct)} h-full`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {overBy > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert" data-testid="plan-overcommit">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          Over-committed by {overBy} point{overBy === 1 ? '' : 's'}: {points} planned against a capacity of {capacity}. Move something out or raise the capacity.
        </p>
      )}
      {unestimated > 0 && (
        <p className="text-2xs text-amber-700">{unestimated} ticket{unestimated === 1 ? ' has' : 's have'} no story points, so the total may be understated.</p>
      )}
      {closed && <p className="text-2xs text-lira-muted">This sprint is closed. Planning is read-only.</p>}
    </div>
  );
}
