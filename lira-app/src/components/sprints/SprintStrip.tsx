import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Issue } from '../../types/issue';
import { currentSprintKey, issuesInSprint, neighbourSprint, sprintLabel, sprintStats } from '../../utils/sprintUtils';

interface Props {
  sprint: string;
  /** Every sprint, in order. */
  keys: string[];
  /** The tickets of the chosen space(s); each chip counts its own sprint's. */
  scoped: Issue[];
  onPick: (sprint: string) => void;
}

const ARROW = 'p-1.5 rounded border border-lira-border bg-white hover:bg-gray-50 cursor-pointer';

/** The row of sprint chips with previous / next arrows, scrolled sideways to the sprint you are on. */
export function SprintStrip({ sprint, keys, scoped, onPick }: Props) {
  // Only the strip scrolls, never the page (scrollIntoView would move the whole page).
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = stripRef.current;
    const chip = strip?.querySelector<HTMLElement>('[data-active-sprint="true"]');
    if (strip && chip) strip.scrollLeft = chip.offsetLeft - strip.clientWidth / 2 + chip.clientWidth / 2;
  }, [sprint]);

  const current = currentSprintKey();
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onPick(neighbourSprint(sprint, keys, -1))} className={ARROW} aria-label="Previous sprint"><ChevronLeft className="w-4 h-4" /></button>
      <div ref={stripRef} className="relative flex-1 flex gap-1.5 overflow-x-auto py-1">
        {keys.map(k => {
          const s = sprintStats(issuesInSprint(scoped, k));
          const active = k === sprint;
          return (
            <button
              key={k}
              onClick={() => onPick(k)}
              data-active-sprint={active ? 'true' : undefined}
              className={`flex-shrink-0 px-3 py-1.5 rounded-md border text-left cursor-pointer transition-colors ${active ? 'bg-lira-blue border-lira-blue text-lira-on-blue' : 'bg-white border-lira-border text-lira-text hover:bg-gray-50'}`}
            >
              <div className="text-xs font-semibold flex items-center gap-1">
                {sprintLabel(k, true)}
                {k === current && <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-green-500'}`} />}
              </div>
              <div className={`text-3xs ${active ? 'text-white' : 'text-lira-muted'}`}>{s.done}/{s.total} done</div>
            </button>
          );
        })}
      </div>
      <button onClick={() => onPick(neighbourSprint(sprint, keys, 1))} className={ARROW} aria-label="Next sprint"><ChevronRight className="w-4 h-4" /></button>
      {sprint !== current && (
        <button onClick={() => onPick(current)} className="text-xs px-2.5 py-1.5 rounded border border-lira-border bg-white hover:bg-gray-50 cursor-pointer">Current</button>
      )}
    </div>
  );
}
