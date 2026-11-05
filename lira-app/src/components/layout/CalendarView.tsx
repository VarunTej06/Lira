import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Clock, CheckCircle2, ChevronDown, ChevronUp, GripVertical,
  CalendarPlus
} from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { ISSUE_TYPE_CONFIG } from '../../types/issue';
import { updateIssue } from '../../hooks/useIssues';

interface CalendarViewProps {
  issues: Issue[];
  space: Space | undefined;
  onSelectIssue: (issue: Issue) => void;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon...
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

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      {/* Calendar Navigation Header */}
      <div className="px-6 py-3.5 border-b border-gray-200 flex items-center justify-between bg-white select-none flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-jira-blue" />
            <h2 className="text-lg font-bold text-gray-800">
              {monthName} {year}
            </h2>
          </div>
          {space && (
            <span
              className="text-xs px-2 py-0.5 rounded font-medium flex items-center gap-1"
              style={{ backgroundColor: (space.color || '#0052CC') + '15', color: space.color || '#0052CC' }}
            >
              <span>{space.icon || '📁'}</span>
              <span>{space.name}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {draggingIssueId && (
            <span className="text-xs text-jira-blue font-semibold animate-pulse bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 flex items-center gap-1">
              <CalendarPlus className="w-3.5 h-3.5" /> Drop on any day to schedule
            </span>
          )}

          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-xs font-semibold rounded border border-gray-300 hover:bg-gray-100 text-gray-700 transition-colors cursor-pointer"
          >
            Today
          </button>
          <div className="flex items-center border border-gray-300 rounded overflow-hidden">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-gray-300" />
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Days of Week Header */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center text-xs font-semibold text-gray-600 py-2 select-none flex-shrink-0">
        {DAYS_OF_WEEK.map((dayName, idx) => (
          <div
            key={dayName}
            className={idx === 0 || idx === 6 ? 'text-gray-400' : 'text-gray-700'}
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-5 lg:grid-rows-6 border-b border-gray-200 bg-gray-200 gap-px overflow-y-auto">
        {calendarDays.map(({ date, isCurrentMonth, key }) => {
          const isToday = key === todayKey;
          const isDragOver = dragOverDateKey === key;
          const dayIssues = dateToIssues.get(key) || [];

          return (
            <div
              key={key}
              onDragOver={(e) => handleCellDragOver(e, key)}
              onDragLeave={(e) => handleCellDragLeave(e, key)}
              onDrop={(e) => handleCellDrop(e, key)}
              className={`min-h-[90px] p-1.5 flex flex-col transition-all overflow-hidden relative ${
                isDragOver
                  ? 'bg-blue-50/95 ring-2 ring-jira-blue ring-inset shadow-md z-10'
                  : !isCurrentMonth
                  ? 'bg-gray-50/60 text-gray-400'
                  : 'bg-white text-gray-800'
              }`}
            >
              {/* Day Number Header */}
              <div className="flex items-center justify-between mb-1 select-none pointer-events-none">
                <span
                  className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-jira-blue text-white font-bold'
                      : isCurrentMonth
                      ? 'text-gray-700'
                      : 'text-gray-400'
                  }`}
                >
                  {date.getDate()}
                </span>
                {dayIssues.length > 0 && (
                  <span className="text-[10px] text-gray-400 font-medium">
                    {dayIssues.length} {dayIssues.length === 1 ? 'task' : 'tasks'}
                  </span>
                )}
              </div>

              {/* Drop target visual indicator when dragged over */}
              {isDragOver && (
                <div className="absolute inset-x-2 bottom-2 bg-blue-100 border border-jira-blue rounded-md py-1 text-center text-[10px] text-jira-blue font-bold flex items-center justify-center gap-1 animate-pulse pointer-events-none">
                  <CalendarPlus className="w-3 h-3" /> Set due {monthName.slice(0, 3)} {date.getDate()}
                </div>
              )}

              {/* Day Issues List */}
              <div className="flex-1 space-y-1 overflow-y-auto pr-0.5">
                {dayIssues.map(issue => {
                  const typeConfig = ISSUE_TYPE_CONFIG[issue.type] || { symbol: '📋' };
                  const isDone = issue.status === 'done';
                  const isBeingDragged = draggingIssueId === issue.id;

                  return (
                    <div
                      key={issue.id || issue.key}
                      draggable={true}
                      onDragStart={(e) => handleItemDragStart(e, issue)}
                      onDragEnd={handleItemDragEnd}
                      onClick={() => onSelectIssue(issue)}
                      className={`text-[11px] p-1 rounded border leading-tight cursor-grab active:cursor-grabbing transition-all hover:shadow-xs group select-none ${
                        isBeingDragged ? 'opacity-40 scale-95 border-dashed border-jira-blue' : ''
                      } ${
                        isDone
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900 opacity-75'
                          : issue.priority === 'highest' || issue.priority === 'high'
                          ? 'bg-red-50/80 border-red-200 text-red-950 hover:bg-red-100/80'
                          : 'bg-blue-50/80 border-blue-200 text-blue-950 hover:bg-blue-100/80'
                      }`}
                      title={`Drag to reschedule: ${issue.key} - ${issue.title}`}
                    >
                      <div className="flex items-center gap-1 font-semibold truncate">
                        <span className="text-[10px]">{typeConfig.symbol}</span>
                        <span className="font-mono text-[10px] group-hover:underline">
                          {issue.key}
                        </span>
                        {isDone && <CheckCircle2 className="w-3 h-3 text-emerald-600 ml-auto flex-shrink-0" />}
                      </div>
                      <div className="truncate text-[10px] text-gray-700 mt-0.5">
                        {issue.title}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Unscheduled Tasks Tray ────────────────────────────────────────── */}
      <div className="border-t border-gray-200 bg-gray-50 flex-shrink-0">
        <button
          onClick={() => setShowUnscheduled(!showUnscheduled)}
          className="w-full px-4 py-2 flex items-center justify-between text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-jira-blue" />
            <span className="font-bold text-gray-800">Unscheduled Tasks</span>
            <span className="px-1.5 py-0.5 bg-gray-200 rounded-full text-[10px] font-bold text-gray-700">
              {unscheduledIssues.length}
            </span>
            <span className="text-[11px] text-jira-muted font-normal">
              (Drag task cards onto any calendar day above to set due date)
            </span>
          </div>
          {showUnscheduled ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {showUnscheduled && (
          <div className="px-4 pb-3 max-h-40 overflow-y-auto">
            {unscheduledIssues.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-1">
                All issues have due dates assigned.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {unscheduledIssues.map(issue => {
                  const typeConfig = ISSUE_TYPE_CONFIG[issue.type] || { symbol: '📋' };
                  const isBeingDragged = draggingIssueId === issue.id;

                  return (
                    <div
                      key={issue.id || issue.key}
                      draggable={true}
                      onDragStart={(e) => handleItemDragStart(e, issue)}
                      onDragEnd={handleItemDragEnd}
                      onClick={() => onSelectIssue(issue)}
                      className={`
                        inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border rounded-lg text-xs
                        transition-all cursor-grab active:cursor-grabbing shadow-2xs select-none group
                        ${isBeingDragged
                          ? 'opacity-40 border-dashed border-jira-blue ring-2 ring-blue-200 scale-95'
                          : 'border-gray-200 hover:border-jira-blue hover:shadow-xs'
                        }
                      `}
                      title="Drag to calendar cell above to set due date, or click to view details"
                    >
                      <GripVertical className="w-3 h-3 text-gray-400 group-hover:text-jira-blue cursor-grab" />
                      <span className="text-xs">{typeConfig.symbol}</span>
                      <span className="font-mono font-bold text-jira-blue">{issue.key}</span>
                      <span className="truncate max-w-[160px] text-gray-700 text-[11px] font-medium">
                        {issue.title}
                      </span>
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
