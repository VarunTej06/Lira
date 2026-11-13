
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AnimatePresence, motion } from './motionPresets';
import { menuPop } from './motionPresets';
import { MonthYearGrid } from './MonthYearGrid';
import { toKey, fromKey, formatPretty, monthGrid, dayClass, outOfRange } from './dateKeys';
import { currentTime } from '../../utils/clock';
import { useResetWhen } from '../../hooks/useResetWhen';
import { useDismiss } from '../../hooks/useDismiss';
import { placeCalendar } from './filterPlacement';

/**
 * Lira's date picker. It replaces the browser's own `<input type="date">`, which looks different in every browser and
 * cannot follow the theme. The value is a plain "YYYY-MM-DD" string (or "" for no date), the same as the native input.
 */

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];



interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  /** Show a button that clears the date. */
  clearable?: boolean;
  'aria-label'?: string;
}

/** The small x inside the field that empties the date. It is a span, because it sits inside the button that opens the calendar. */
function ClearDateButton({ onClear }: { onClear: () => void }) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label="Clear date"
      onClick={e => { e.stopPropagation(); onClear(); }}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onClear(); } }}
      className="p-0.5 rounded text-lira-muted hover:text-lira-text hover:bg-gray-100"
    >
      <X className="w-3.5 h-3.5" />
    </span>
  );
}

/** The month, its year and the previous and next arrows. The arrows wait while the month and year chooser is open. */
function CalendarHeader({ view, picking, onShift, onTogglePicking }: { view: Date; picking: boolean; onShift: (n: number) => void; onTogglePicking: () => void }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <button type="button" onClick={() => onShift(-1)} disabled={picking} aria-label="Previous month" className="p-1.5 rounded-lg hover:bg-gray-100 text-lira-muted cursor-pointer disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
      <button
        type="button"
        onClick={onTogglePicking}
        aria-expanded={picking}
        aria-label="Choose month and year"
        data-testid="month-year-toggle"
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-semibold hover:bg-gray-100 cursor-pointer"
      >
        {view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        <ChevronDown className={`w-3.5 h-3.5 text-lira-muted transition-transform ${picking ? 'rotate-180' : ''}`} />
      </button>
      <button type="button" onClick={() => onShift(1)} disabled={picking} aria-label="Next month" className="p-1.5 rounded-lg hover:bg-gray-100 text-lira-muted cursor-pointer disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
    </div>
  );
}

/** The weekday names and the days of the month; days outside min and max cannot be picked. */
function DayGrid({ view, value, today, min, max, onPick }: { view: Date; value: string; today: string; min?: string; max?: string; onPick: (key: string) => void }) {
  const grid = useMemo(() => monthGrid(view.getFullYear(), view.getMonth()), [view]);
  return (
    <>
      <div className="grid grid-cols-7 text-center text-3xs font-semibold uppercase tracking-wide text-lira-muted mb-1">
        {WEEKDAYS.map(d => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5" role="grid">
        {grid.map(({ date, inMonth }) => {
          const k = toKey(date);
          return (
            <button
              key={k}
              type="button"
              role="gridcell"
              aria-selected={k === value}
              disabled={outOfRange(k, min, max)}
              onClick={() => onPick(k)}
              className={`h-8 text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${dayClass(k === value, k === today, inMonth)}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </>
  );
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value, onChange, min, max, placeholder = 'Select a date', className = '', id, disabled, clearable = true, 'aria-label': ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false); // choosing a month and year instead of a day
  const selected = fromKey(value);
  const [view, setView] = useState(() => selected ?? new Date());
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useResetWhen([open, value], () => { if (open) { setView(fromKey(value) ?? currentTime()); setPicking(false); } });

  // place the calendar under the field, or above it when there is no room
  useLayoutEffect(() => {
    if (!open || !trigger.current || !panel.current) return;
    setPos(placeCalendar(trigger.current.getBoundingClientRect(), { width: panel.current.offsetWidth, height: panel.current.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }));
  }, [open, view, picking]);

  useDismiss(open, setOpen, panel, trigger);

  const today = toKey(currentTime());
  const pick = (k: string) => { if (outOfRange(k, min, max)) return; onChange(k); setOpen(false); trigger.current?.focus(); };
  const shift = (n: number) => setView(v => new Date(v.getFullYear(), v.getMonth() + n, 1));

  return (
    <div className={`relative ${className}`}>
      <button
        ref={trigger}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="w-full flex items-center gap-2 text-left text-sm border border-lira-border rounded-lg px-3 py-2 bg-white text-lira-text hover:border-lira-blue focus:outline-none focus:border-lira-blue focus:ring-1 focus:ring-lira-blue disabled:opacity-60 cursor-pointer"
      >
        <CalendarDays className="w-4 h-4 text-lira-muted flex-shrink-0" aria-hidden />
        <span className={`flex-1 truncate ${value ? '' : 'text-lira-muted'}`}>{value ? formatPretty(value) : placeholder}</span>
        {clearable && value && !disabled && <ClearDateButton onClear={() => onChange('')} />}
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panel}
              {...menuPop}
              role="dialog"
              aria-label="Choose a date"
              style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, zIndex: 300, visibility: pos ? 'visible' : 'hidden', transformOrigin: 'top left' }}
              className="w-[272px] bg-white border border-lira-border rounded-2xl shadow-2xl p-3 text-lira-text"
            >
              <CalendarHeader view={view} picking={picking} onShift={shift} onTogglePicking={() => setPicking(p => !p)} />
              {picking ? (
                <MonthYearGrid year={view.getFullYear()} month={view.getMonth()} onPick={(y, m) => { setView(new Date(y, m, 1)); setPicking(false); }} />
              ) : (<>
              <DayGrid view={view} value={value} today={today} min={min} max={max} onPick={pick} />
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-lira-border">
                <button type="button" onClick={() => pick(today)} disabled={outOfRange(today, min, max)} className="text-xs font-semibold text-lira-blue hover:underline disabled:opacity-40 cursor-pointer">Today</button>
                {clearable && <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="text-xs text-lira-muted hover:text-lira-text cursor-pointer">Clear</button>}
              </div>
              </>)}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
};
