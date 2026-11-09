import { isKeepingPlace } from '../../utils/keepPlace';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AnimatePresence, motion, menuPop } from './motion';
import { MonthYearGrid } from './MonthYearGrid';

/**
 * Lira's date picker. It replaces the browser's own `<input type="date">`, which looks different in every browser and
 * cannot follow the theme. The value is a plain "YYYY-MM-DD" string (or "" for no date), the same as the native input.
 */

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function fromKey(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}
export const formatPretty = (s: string) => {
  const d = fromKey(s);
  return d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
};

/** The 6 x 7 days shown for a month, starting on Monday. */
export function monthGrid(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(year, month, 1 - lead + i);
    return { date, inMonth: date.getMonth() === month };
  });
}

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

  useEffect(() => { if (open) { setView(fromKey(value) ?? new Date()); setPicking(false); } }, [open, value]);

  // place the calendar under the field, or above it when there is no room
  useLayoutEffect(() => {
    if (!open || !trigger.current || !panel.current) return;
    const a = trigger.current.getBoundingClientRect();
    const w = panel.current.offsetWidth, h = panel.current.offsetHeight;
    const margin = 8;
    let top = a.bottom + 6;
    if (top + h > window.innerHeight - margin) top = Math.max(margin, a.top - 6 - h);
    const left = Math.min(Math.max(margin, a.left), window.innerWidth - w - margin);
    setPos({ top, left });
  }, [open, view, picking]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); trigger.current?.focus(); } };
    const close = () => setOpen(false);
    const onScroll = (e: Event) => { if (isKeepingPlace()) return; if (!panel.current?.contains(e.target as Node)) setOpen(false); }; // scrolling the page closes it
    document.addEventListener('mousedown', away, true);
    document.addEventListener('keydown', esc, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => { document.removeEventListener('mousedown', away, true); document.removeEventListener('keydown', esc, true); window.removeEventListener('resize', close); window.removeEventListener('scroll', onScroll, true); };
  }, [open]);

  const grid = useMemo(() => monthGrid(view.getFullYear(), view.getMonth()), [view]);
  const today = toKey(new Date());
  const disabledDay = (k: string) => (!!min && k < min) || (!!max && k > max);
  const pick = (k: string) => { if (disabledDay(k)) return; onChange(k); setOpen(false); trigger.current?.focus(); };
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
        {clearable && value && !disabled && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear date"
            onClick={e => { e.stopPropagation(); onChange(''); }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onChange(''); } }}
            className="p-0.5 rounded text-lira-muted hover:text-lira-text hover:bg-gray-100"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
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
              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={() => shift(-1)} disabled={picking} aria-label="Previous month" className="p-1.5 rounded-lg hover:bg-gray-100 text-lira-muted cursor-pointer disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                <button
                  type="button"
                  onClick={() => setPicking(p => !p)}
                  aria-expanded={picking}
                  aria-label="Choose month and year"
                  data-testid="month-year-toggle"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-semibold hover:bg-gray-100 cursor-pointer"
                >
                  {view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  <ChevronDown className={`w-3.5 h-3.5 text-lira-muted transition-transform ${picking ? 'rotate-180' : ''}`} />
                </button>
                <button type="button" onClick={() => shift(1)} disabled={picking} aria-label="Next month" className="p-1.5 rounded-lg hover:bg-gray-100 text-lira-muted cursor-pointer disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
              </div>
              {picking ? (
                <MonthYearGrid year={view.getFullYear()} month={view.getMonth()} onPick={(y, m) => { setView(new Date(y, m, 1)); setPicking(false); }} />
              ) : (<>
              <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-lira-muted mb-1">
                {WEEKDAYS.map(d => <div key={d} className="py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5" role="grid">
                {grid.map(({ date, inMonth }) => {
                  const k = toKey(date);
                  const isSel = k === value;
                  const isToday = k === today;
                  const off = disabledDay(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      role="gridcell"
                      aria-selected={isSel}
                      disabled={off}
                      onClick={() => pick(k)}
                      className={`h-8 text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                        isSel ? 'bg-lira-blue text-white font-semibold'
                          : isToday ? 'ring-1 ring-lira-blue text-lira-blue font-semibold hover:bg-lira-blue-light'
                          : inMonth ? 'hover:bg-gray-100' : 'text-lira-muted/60 hover:bg-gray-50'
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-lira-border">
                <button type="button" onClick={() => pick(today)} disabled={disabledDay(today)} className="text-xs font-semibold text-lira-blue hover:underline disabled:opacity-40 cursor-pointer">Today</button>
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
