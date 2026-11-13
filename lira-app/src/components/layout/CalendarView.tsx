import { SpaceIcon } from '../common/SpaceIcon';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, ChevronDown, ChevronUp, CalendarPlus } from 'lucide-react';
import { MonthYearGrid } from '../common/MonthYearGrid';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { formatDateKey, monthGrid } from '../../utils/calendarGrid';
import { useCalendarDrag } from './useCalendarDrag';
import { currentTime } from '../../utils/clock';
import { dayNumberTone, dayTone } from './calendarTones';
import { IssueChip, MoreToggle, UnscheduledChip } from './CalendarParts';

interface CalendarViewProps {
  issues: Issue[];
  space: Space | undefined;
  onSelectIssue: (issue: Issue) => void;
}

type Drag = ReturnType<typeof useCalendarDrag>;
type Day = ReturnType<typeof monthGrid>[number];

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_VISIBLE = 3;

/** The month and year as a button that opens a month chooser; it closes on an outside click or Escape. */
function MonthYearPicker({ year, month, monthName, onPick }: { year: number; month: number; monthName: string; onPick: (year: number, month: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label="Choose month and year"
        data-testid="calendar-month-year"
        className="flex items-center gap-1.5 -ml-2 px-2 py-0.5 rounded-lg text-lg font-bold text-lira-text hover:bg-gray-100 cursor-pointer"
      >
        {monthName} {year}
        <ChevronDown className={`w-4 h-4 text-lira-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 z-30 w-[272px] bg-white border border-lira-border rounded-2xl shadow-2xl p-3 animate-scale-in">
          <MonthYearGrid year={year} month={month} onPick={(y, m) => { onPick(y, m); setOpen(false); }} />
        </div>
      )}
    </div>
  );
}

/** One day: its number, a drop hint while dragging over it, and up to three tickets (all of them when expanded). */
function DayCell({ day, idx, todayKey, monthName, drag, expanded, onToggle, onSelect }: {
  day: Day; idx: number; todayKey: string; monthName: string; drag: Drag; expanded: boolean; onToggle: () => void; onSelect: (issue: Issue) => void;
}) {
  const { date, isCurrentMonth, key } = day;
  const isToday = key === todayKey;
  const isDragOver = drag.dragOverKey === key;
  const dayIssues = drag.byDay.get(key) || [];
  const shown = expanded ? dayIssues : dayIssues.slice(0, MAX_VISIBLE);
  const hidden = dayIssues.length - shown.length;
  return (
    <div
      {...drag.dayProps(key)}
      data-date={key}
      className={`min-h-[124px] p-2 flex flex-col gap-1 border-b border-r border-lira-border [&:nth-child(7n)]:border-r-0 transition-colors relative ${dayTone({ dragOver: isDragOver, today: isToday, inMonth: isCurrentMonth, weekend: idx % 7 >= 5 })}`}
    >
      <div className="flex items-center justify-between select-none pointer-events-none">
        <span className={`text-xs w-7 h-7 flex items-center justify-center rounded-full ${dayNumberTone(isToday, isCurrentMonth)}`}>{date.getDate()}</span>
        {dayIssues.length > 0 && <span className="text-3xs font-medium text-lira-muted">{dayIssues.length}</span>}
      </div>
      {isDragOver && (
        <div className="absolute inset-x-2 bottom-2 bg-lira-blue text-lira-on-blue rounded-md py-1 text-center text-3xs font-semibold flex items-center justify-center gap-1 pointer-events-none">
          <CalendarPlus className="w-3 h-3" /> Due {monthName.slice(0, 3)} {date.getDate()}
        </div>
      )}
      <div className="flex-1 space-y-1 min-h-0">
        {shown.map(issue => <IssueChip key={issue.id || issue.key} issue={issue} drag={drag} onSelect={onSelect} />)}
        {(hidden > 0 || (expanded && dayIssues.length > MAX_VISIBLE)) && <MoreToggle expanded={expanded} hidden={hidden} onToggle={onToggle} />}
      </div>
    </div>
  );
}

/** The folding tray of tickets without a due date. */
function UnscheduledTray({ drag, onSelect }: { drag: Drag; onSelect: (issue: Issue) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-t border-lira-border bg-white flex-shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-2.5 flex items-center justify-between text-xs font-semibold text-lira-muted hover:bg-gray-50 transition-colors cursor-pointer select-none"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-lira-blue" />
          <span className="font-bold text-lira-text">Without a due date</span>
          <span className="px-1.5 py-0.5 bg-gray-100 rounded-full text-3xs font-bold text-lira-text">{drag.unscheduled.length}</span>
          <span className="text-2xs font-normal">Drag a ticket onto a day to schedule it</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-6 pb-3 max-h-40 overflow-y-auto">
          {drag.unscheduled.length === 0 ? (
            <p className="text-xs text-lira-muted italic py-1">Every ticket has a due date.</p>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {drag.unscheduled.map(issue => <UnscheduledChip key={issue.id || issue.key} issue={issue} drag={drag} onSelect={onSelect} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SpaceChip({ space }: { space: Space }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-md font-medium flex items-center gap-1 bg-lira-blue-light text-lira-blue">
      <SpaceIcon icon={space.icon} className="w-3 h-3" /><span>{space.name}</span>
    </span>
  );
}

export const CalendarView: React.FC<CalendarViewProps> = ({ issues, space, onSelectIssue }) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // days showing all their tickets
  const drag = useCalendarDrag(issues);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const days = useMemo(() => monthGrid(year, month), [year, month]);
  const todayKey = formatDateKey(currentTime());

  const thisMonth = days.filter(d => d.isCurrentMonth).flatMap(d => drag.byDay.get(d.key) ?? []);
  const toggleExpanded = (key: string) => setExpanded(prev => { const n = new Set(prev); if (!n.delete(key)) n.add(key); return n; });
  const goToMonth = (offset: number) => setCurrentDate(new Date(year, month + offset, 1));

  return (
    <div className="flex-1 flex flex-col h-full bg-lira-bg overflow-hidden" data-testid="calendar-view">
      <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3 select-none flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-lira-blue-light text-lira-blue flex items-center justify-center flex-shrink-0"><CalendarIcon className="w-5 h-5" /></span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MonthYearPicker year={year} month={month} monthName={monthName} onPick={(y, m) => setCurrentDate(new Date(y, m, 1))} />
              {space && <SpaceChip space={space} />}
            </div>
            <p className="text-xs text-lira-muted mt-0.5">
              {thisMonth.length} due this month · {thisMonth.filter(i => i.status === 'done').length} done · {drag.unscheduled.length} without a date
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {drag.draggingId && (
            <span className="text-xs text-lira-blue font-semibold animate-pulse bg-lira-blue-light px-2.5 py-1 rounded-full border border-lira-blue/30 flex items-center gap-1">
              <CalendarPlus className="w-3.5 h-3.5" /> Drop on a day to schedule
            </span>
          )}
          <button onClick={() => setCurrentDate(new Date())} className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-lira-border bg-white hover:bg-gray-50 text-lira-text transition-colors cursor-pointer">Today</button>
          <div className="flex items-center border border-lira-border rounded-lg overflow-hidden bg-white">
            <button onClick={() => goToMonth(-1)} className="p-2 hover:bg-gray-100 text-lira-muted transition-colors cursor-pointer" title="Previous month" aria-label="Previous month"><ChevronLeft className="w-4 h-4" /></button>
            <div className="w-px h-5 bg-lira-border" />
            <button onClick={() => goToMonth(1)} className="p-2 hover:bg-gray-100 text-lira-muted transition-colors cursor-pointer" title="Next month" aria-label="Next month"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-4 min-h-0">
        <div className="rounded-2xl border border-lira-border bg-white overflow-hidden shadow-xs">
          <div className="grid grid-cols-7 bg-gray-50 border-b border-lira-border text-2xs font-semibold uppercase tracking-wider select-none">
            {DAYS_OF_WEEK.map(name => <div key={name} className="py-2.5 text-center text-lira-muted">{name}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, idx) => (
              <DayCell
                key={day.key} day={day} idx={idx} todayKey={todayKey} monthName={monthName} drag={drag}
                expanded={expanded.has(day.key)} onToggle={() => toggleExpanded(day.key)} onSelect={onSelectIssue}
              />
            ))}
          </div>
        </div>
      </div>

      <UnscheduledTray drag={drag} onSelect={onSelectIssue} />
    </div>
  );
};
