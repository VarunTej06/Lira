import { issueLink } from '../../utils/links';
import { TypeIcon } from '../common/Icons';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Clock, CheckCircle2, ChevronDown, ChevronUp, GripVertical,
  CalendarPlus
} from 'lucide-react';
import { MonthYearGrid } from '../common/MonthYearGrid';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { updateIssue } from '../../hooks/useIssues';

interface CalendarViewProps {
  issues: Issue[];
  space: Space | undefined;
  onSelectIssue: (issue: Issue) => void;
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDueDateKey(rawDate: Date | string | undefined): string | null {
  if (!rawDate) return null;
  const parsed = rawDate instanceof Date ? rawDate : new Date(rawDate);
  if (isNaN(parsed.getTime())) return null;
  return formatDateKey(parsed);
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  issues,
  space,
  onSelectIssue,
}) => {
  // Current viewed month and year
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [showUnscheduled, setShowUnscheduled] = useState<boolean>(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // days showing all their tickets

  // Drag and drop states
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);
  const [draggingIssueId, setDraggingIssueId] = useState<number | null>(null);
  const [optimisticDates, setOptimisticDates] = useState<Record<number, string>>({});

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  // Map issues by their due date key (YYYY-MM-DD), applying optimistic dates
  const { dateToIssues, unscheduledIssues } = useMemo(() => {
    const map = new Map<string, Issue[]>();
    const unscheduled: Issue[] = [];

    issues.forEach(issue => {
      const optimisticKey = issue.id ? optimisticDates[issue.id] : undefined;
      const key = optimisticKey !== undefined ? optimisticKey : parseDueDateKey(issue.dueDate);
      if (key) {
        const existing = map.get(key) || [];
        existing.push(issue);
        map.set(key, existing);
      } else {
        unscheduled.push(issue);
      }
    });

    return { dateToIssues: map, unscheduledIssues: unscheduled };
  }, [issues, optimisticDates]);

  // Clean up optimistic dates when live query delivers the real dueDate
  useEffect(() => {
    setOptimisticDates(prev => {
      const keys = Object.keys(prev);
      if (keys.length === 0) return prev;
      let changed = false;
      const next = { ...prev };
      keys.forEach(k => {
        const id = Number(k);
        const match = issues.find(i => i.id === id);
        if (match) {
          const actualKey = parseDueDateKey(match.dueDate);
          if (actualKey === prev[id]) {
            delete next[id];
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, [issues]);

  // Generate calendar grid days (including padding from previous & next months)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // the week starts on Monday: 0 = Mon ... 6 = Sun
    const totalDaysInMonth = lastDayOfMonth.getDate();

    const days: { date: Date; isCurrentMonth: boolean; key: string }[] = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date: d,
        isCurrentMonth: false,
        key: formatDateKey(d),
      });
    }

    // Current month days
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const d = new Date(year, month, day);
      days.push({
        date: d,
        isCurrentMonth: true,
        key: formatDateKey(d),
      });
    }

    // Next month padding to fill a complete 35 or 42 grid
    const remainingSlots = (7 - (days.length % 7)) % 7;
    for (let day = 1; day <= remainingSlots; day++) {
      const d = new Date(year, month + 1, day);
      days.push({
        date: d,
        isCurrentMonth: false,
        key: formatDateKey(d),
      });
    }

    return days;
  }, [year, month]);

  const todayKey = formatDateKey(new Date());

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // ── Drag & Drop Handlers ───────────────────────────────────────────────────

  const handleItemDragStart = (e: React.DragEvent, issue: Issue) => {
    if (!issue.id) return;
    e.dataTransfer.setData('text/plain', String(issue.id));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingIssueId(issue.id);
  };

  const handleItemDragEnd = () => {
    setDraggingIssueId(null);
    setDragOverDateKey(null);
  };

  const handleCellDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDateKey !== key) {
      setDragOverDateKey(key);
    }
  };

  const handleCellDragLeave = (e: React.DragEvent, key: string) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverDateKey === key) {
      setDragOverDateKey(null);
    }
  };

  const handleCellDrop = async (e: React.DragEvent, targetDateKey: string) => {
    e.preventDefault();
    setDragOverDateKey(null);
    setDraggingIssueId(null);

    const issueIdStr = e.dataTransfer.getData('text/plain');
    const issueId = Number(issueIdStr);
    if (!issueId || isNaN(issueId)) return;

    // Parse YYYY-MM-DD
    const parts = targetDateKey.split('-');
    if (parts.length !== 3) return;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const newDueDate = new Date(y, m, d, 12, 0, 0);

    // Optimistically update
    setOptimisticDates(prev => ({ ...prev, [issueId]: targetDateKey }));

    try {
      await updateIssue(issueId, { dueDate: newDueDate });
    } catch (err) {
      console.error('Failed to update issue dueDate on calendar drop:', err);
      // Revert optimistic update
      setOptimisticDates(prev => {
        const next = { ...prev };
        delete next[issueId];
        return next;
      });
    }
  };

  const monthIssueCount = useMemo(() => calendarDays.reduce((n, d) => n + (d.isCurrentMonth ? (dateToIssues.get(d.key)?.length ?? 0) : 0), 0), [calendarDays, dateToIssues]);
  const monthDoneCount = useMemo(() => calendarDays.reduce((n, d) => n + (d.isCurrentMonth ? (dateToIssues.get(d.key) || []).filter(i => i.status === 'done').length : 0), 0), [calendarDays, dateToIssues]);
  const toggleExpanded = (key: string) => setExpanded(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pickerOpen) return;
    const away = (e: MouseEvent) => { if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPickerOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [pickerOpen]);
  const MAX_VISIBLE = 3;

  const chipTone = (issue: Issue) =>
    issue.status === 'done' ? 'border-l-emerald-500 bg-emerald-500/10'
      : issue.blocked ? 'border-l-red-600 bg-red-600/15'
      : issue.status === 'inprogress' ? 'border-l-blue-500 bg-blue-500/10'
      : issue.priority === 'highest' || issue.priority === 'high' ? 'border-l-red-500 bg-red-500/10'
      : 'border-l-slate-400 bg-slate-500/10';

  return (
    <div className="flex-1 flex flex-col h-full bg-lira-bg overflow-hidden" data-testid="calendar-view">
      {/* Header */}
      <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3 select-none flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-lira-blue-light text-lira-blue flex items-center justify-center flex-shrink-0">
            <CalendarIcon className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="relative" ref={pickerRef}>
                <button
                  type="button"
                  onClick={() => setPickerOpen(o => !o)}
                  aria-expanded={pickerOpen}
                  aria-label="Choose month and year"
                  data-testid="calendar-month-year"
                  className="flex items-center gap-1.5 -ml-2 px-2 py-0.5 rounded-lg text-lg font-bold text-lira-text hover:bg-gray-100 cursor-pointer"
                >
                  {monthName} {year}
                  <ChevronDown className={`w-4 h-4 text-lira-muted transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
                </button>
                {pickerOpen && (
                  <div className="absolute left-0 top-full mt-2 z-30 w-[272px] bg-white border border-lira-border rounded-2xl shadow-2xl p-3 animate-scale-in">
                    <MonthYearGrid year={year} month={month} onPick={(y, m) => { setCurrentDate(new Date(y, m, 1)); setPickerOpen(false); }} />
                  </div>
                )}
              </div>
              {space && (
                <span className="text-xs px-2 py-0.5 rounded-md font-medium flex items-center gap-1" style={{ backgroundColor: (space.color || '#0052CC') + '22', color: space.color || '#0052CC' }}>
                  <span>{space.icon || '📁'}</span>
                  <span>{space.name}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-lira-muted mt-0.5">
              {monthIssueCount} due this month · {monthDoneCount} done · {unscheduledIssues.length} without a date
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {draggingIssueId && (
            <span className="text-xs text-lira-blue font-semibold animate-pulse bg-lira-blue-light px-2.5 py-1 rounded-full border border-lira-blue/30 flex items-center gap-1">
              <CalendarPlus className="w-3.5 h-3.5" /> Drop on a day to schedule
            </span>
          )}
          <button onClick={handleToday} className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-lira-border bg-white hover:bg-gray-50 text-lira-text transition-colors cursor-pointer">
            Today
          </button>
          <div className="flex items-center border border-lira-border rounded-lg overflow-hidden bg-white">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 text-lira-muted transition-colors cursor-pointer" title="Previous month" aria-label="Previous month">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-lira-border" />
            <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 text-lira-muted transition-colors cursor-pointer" title="Next month" aria-label="Next month">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Month grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-4 min-h-0">
        <div className="rounded-2xl border border-lira-border bg-white overflow-hidden shadow-xs">
          <div className="grid grid-cols-7 bg-gray-50 border-b border-lira-border text-[11px] font-semibold uppercase tracking-wider select-none">
            {DAYS_OF_WEEK.map((dayName, idx) => (
              <div key={dayName} className={`py-2.5 text-center ${idx >= 5 ? 'text-lira-muted/70' : 'text-lira-muted'}`}>{dayName}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarDays.map(({ date, isCurrentMonth, key }, idx) => {
              const isToday = key === todayKey;
              const isDragOver = dragOverDateKey === key;
              const isWeekend = idx % 7 >= 5;
              const dayIssues = dateToIssues.get(key) || [];
              const isExpanded = expanded.has(key);
              const shown = isExpanded ? dayIssues : dayIssues.slice(0, MAX_VISIBLE);
              const hidden = dayIssues.length - shown.length;

              return (
                <div
                  key={key}
                  onDragOver={(e) => handleCellDragOver(e, key)}
                  onDragLeave={(e) => handleCellDragLeave(e, key)}
                  onDrop={(e) => handleCellDrop(e, key)}
                  data-date={key}
                  className={`min-h-[124px] p-2 flex flex-col gap-1 border-b border-r border-lira-border [&:nth-child(7n)]:border-r-0 transition-colors relative ${
                    isDragOver ? 'bg-lira-blue-light ring-2 ring-lira-blue ring-inset z-10'
                      : isToday ? 'bg-lira-blue-light/50'
                      : !isCurrentMonth ? 'bg-gray-50/70'
                      : isWeekend ? 'bg-gray-50/40' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between select-none pointer-events-none">
                    <span
                      className={`text-xs w-7 h-7 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-lira-blue text-white font-bold shadow-xs' : isCurrentMonth ? 'text-lira-text font-semibold' : 'text-lira-muted/60'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    {dayIssues.length > 0 && (
                      <span className="text-[10px] font-medium text-lira-muted">{dayIssues.length}</span>
                    )}
                  </div>

                  {isDragOver && (
                    <div className="absolute inset-x-2 bottom-2 bg-lira-blue text-white rounded-md py-1 text-center text-[10px] font-semibold flex items-center justify-center gap-1 pointer-events-none">
                      <CalendarPlus className="w-3 h-3" /> Due {monthName.slice(0, 3)} {date.getDate()}
                    </div>
                  )}

                  <div className="flex-1 space-y-1 min-h-0">
                    {shown.map(issue => {
                      const isDone = issue.status === 'done';
                      const isBeingDragged = draggingIssueId === issue.id;
                      return (
                        <div
                          key={issue.id || issue.key}
                          draggable
                          onDragStart={(e) => handleItemDragStart(e, issue)}
                          onDragEnd={handleItemDragEnd}
                          onClick={() => onSelectIssue(issue)} {...issueLink(issue)}
                          className={`text-[11px] px-1.5 py-1 rounded-md border-l-[3px] leading-tight cursor-grab active:cursor-grabbing transition-all hover:shadow-sm hover:-translate-y-px group select-none ${chipTone(issue)} ${
                            isBeingDragged ? 'opacity-40 scale-95' : ''
                          } ${isDone ? 'opacity-70' : ''}`}
                          title={`${issue.key} · ${issue.title}. Drag to change the due date.`}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <TypeIcon type={issue.type} className="w-3 h-3" />
                            <span className={`font-mono text-[10px] font-semibold text-lira-text ${isDone ? 'line-through' : ''}`}>{issue.key}</span>
                            {isDone && <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-auto flex-shrink-0" />}
                          </div>
                          <div className="truncate text-[10px] text-lira-muted mt-0.5">{issue.title}</div>
                        </div>
                      );
                    })}
                    {(hidden > 0 || (isExpanded && dayIssues.length > MAX_VISIBLE)) && (
                      <button
                        onClick={() => toggleExpanded(key)}
                        className="w-full text-left text-[10px] font-semibold text-lira-blue hover:underline px-1 cursor-pointer"
                      >
                        {isExpanded ? 'Show less' : `+${hidden} more`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Unscheduled tickets */}
      <div className="border-t border-lira-border bg-white flex-shrink-0">
        <button
          onClick={() => setShowUnscheduled(!showUnscheduled)}
          className="w-full px-6 py-2.5 flex items-center justify-between text-xs font-semibold text-lira-muted hover:bg-gray-50 transition-colors cursor-pointer select-none"
          aria-expanded={showUnscheduled}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-lira-blue" />
            <span className="font-bold text-lira-text">Without a due date</span>
            <span className="px-1.5 py-0.5 bg-gray-100 rounded-full text-[10px] font-bold text-lira-text">{unscheduledIssues.length}</span>
            <span className="text-[11px] font-normal">Drag a ticket onto a day to schedule it</span>
          </div>
          {showUnscheduled ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>

        {showUnscheduled && (
          <div className="px-6 pb-3 max-h-40 overflow-y-auto">
            {unscheduledIssues.length === 0 ? (
              <p className="text-xs text-lira-muted italic py-1">Every ticket has a due date.</p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {unscheduledIssues.map(issue => {
                  const isBeingDragged = draggingIssueId === issue.id;
                  return (
                    <div
                      key={issue.id || issue.key}
                      draggable
                      onDragStart={(e) => handleItemDragStart(e, issue)}
                      onDragEnd={handleItemDragEnd}
                      onClick={() => onSelectIssue(issue)} {...issueLink(issue)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border rounded-lg text-xs transition-all cursor-grab active:cursor-grabbing select-none group ${
                        isBeingDragged ? 'opacity-40 border-dashed border-lira-blue scale-95' : 'border-lira-border hover:border-lira-blue hover:shadow-xs'
                      }`}
                      title="Drag onto a day to set the due date, or click to open"
                    >
                      <GripVertical className="w-3 h-3 text-lira-muted group-hover:text-lira-blue" />
                      <TypeIcon type={issue.type} className="w-3.5 h-3.5" />
                      <span className="font-mono font-bold text-lira-blue">{issue.key}</span>
                      <span className="truncate max-w-[180px] text-lira-text text-[11px] font-medium">{issue.title}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
