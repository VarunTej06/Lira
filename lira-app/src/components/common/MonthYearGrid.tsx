import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { currentTime } from '../../utils/clock';

const MONTHS = Array.from({ length: 12 }, (_, m) => new Date(2000, m, 1).toLocaleString('en-US', { month: 'short' }));

interface Props {
  year: number;
  month: number; // 0-11
  /** Called when a month is chosen. */
  onPick: (year: number, month: number) => void;
}

/** Jump to any month of any year: step the year with the arrows, then click a month. */
export const MonthYearGrid: React.FC<Props> = ({ year, month, onPick }) => {
  const [shownYear, setShownYear] = useState(year);
  const now = currentTime();
  return (
    <div data-testid="month-year-grid">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setShownYear(y => y - 1)} aria-label="Previous year" className="p-1.5 rounded-lg hover:bg-gray-100 text-lira-muted cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
        <input
          type="number"
          aria-label="Year"
          value={shownYear}
          onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v) && v > 0 && v < 10000) setShownYear(v); }}
          className="w-20 text-center text-sm font-semibold bg-transparent text-lira-text rounded-md border border-transparent hover:border-lira-border focus:border-lira-blue focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button type="button" onClick={() => setShownYear(y => y + 1)} aria-label="Next year" className="p-1.5 rounded-lg hover:bg-gray-100 text-lira-muted cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Month">
        {MONTHS.map((name, m) => {
          const selected = shownYear === year && m === month;
          const current = shownYear === now.getFullYear() && m === now.getMonth();
          return (
            <button
              key={name}
              type="button"
              aria-pressed={selected}
              onClick={() => onPick(shownYear, m)}
              className={`py-2.5 text-sm rounded-lg transition-colors cursor-pointer ${
                selected ? 'bg-lira-blue text-lira-on-blue font-semibold'
                  : current ? 'ring-1 ring-lira-blue text-lira-blue font-semibold hover:bg-lira-blue-light'
                  : 'text-lira-text hover:bg-gray-100'
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
};
