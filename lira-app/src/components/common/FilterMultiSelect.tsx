import { isKeepingPlace } from '../../utils/keepPlace';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { AnimatePresence, motion, menuPop } from './motion';

interface FilterOption { value: string; label: string; color?: string }

interface Props {
  label: string;
  icon?: React.ReactNode;
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear?: () => void;
  /** Adds a text box that narrows the list (used for labels). */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  /** One value at a time (radio buttons). Choosing closes the list. */
  single?: boolean;
  /** Highlight the button (a filter is set). Default: something is selected. */
  active?: boolean;
  /** Shown on the button after the label, for a single choice ("Sprint: Current"). */
  valueLabel?: string;
}

/**
 * A small filter dropdown with a checkbox for every value, so one or several can be chosen.
 * The list scrolls inside the dropdown and is drawn above everything else, so it is never clipped.
 */
export const FilterMultiSelect: React.FC<Props> = ({ label, icon, options, selected, onToggle, onClear, searchable, searchPlaceholder = 'Search', emptyText = 'Nothing to choose', single, valueLabel, active }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; maxHeight: number } | null>(null);

  useEffect(() => { if (!open) setQuery(''); }, [open]);

  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const a = trigger.current.getBoundingClientRect();
    const w = panel.current?.offsetWidth ?? 240;
    const margin = 8;
    const left = Math.min(Math.max(margin, a.left), window.innerWidth - w - margin);
    // Open downwards if the whole list fits there; otherwise on whichever side has more room, and never taller than that room,
    // so every value can be reached by scrolling the list itself.
    const below = window.innerHeight - a.bottom - 6 - margin;
    const above = a.top - 6 - margin;
    const wanted = Math.min(panel.current?.scrollHeight ?? 320, 360);
    const down = wanted <= below || below >= above;
    setPos(down
      ? { top: a.bottom + 6, left, maxHeight: Math.max(120, Math.min(360, below)) }
      : { bottom: window.innerHeight - a.top + 6, left, maxHeight: Math.max(120, Math.min(360, above)) });
  }, [open, query, options.length]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); trigger.current?.focus(); } };
    const close = () => setOpen(false);
    // scrolling the page closes it (it would otherwise stay on the screen while the button moves away); scrolling its own list does not
    const onScroll = (e: Event) => { if (isKeepingPlace()) return; if (!panel.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away, true);
    document.addEventListener('keydown', esc, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => { document.removeEventListener('mousedown', away, true); document.removeEventListener('keydown', esc, true); window.removeEventListener('resize', close); window.removeEventListener('scroll', onScroll, true); };
  }, [open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const count = selected.length;

  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid={`filter-${label.toLowerCase()}`}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded transition-colors cursor-pointer ${
          (active ?? count > 0) ? 'border-lira-blue text-lira-blue bg-blue-50 hover:bg-blue-100' : 'text-lira-muted border-lira-border hover:bg-gray-50'
        }`}
      >
        {icon}
        <span>{label}{single && valueLabel ? <span className="font-semibold">{`: ${valueLabel}`}</span> : null}</span>
        {!single && count > 0 && <span className="bg-blue-100 text-blue-700 text-xs rounded-full px-1.5 font-semibold">{count}</span>}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panel}
              {...menuPop}
              role="dialog"
              aria-label={`${label} filter`}
              style={{ position: 'fixed', top: pos?.top, bottom: pos?.bottom, left: pos?.left ?? 0, maxHeight: pos?.maxHeight, zIndex: 300, visibility: pos ? 'visible' : 'hidden', transformOrigin: pos?.bottom !== undefined ? 'bottom left' : 'top left' }}
              className="w-60 bg-white border border-lira-border rounded-xl shadow-2xl flex flex-col text-lira-text"
            >
              {searchable && (
                <div className="p-2 border-b border-lira-border">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-lira-muted" />
                    <input
                      autoFocus
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder={searchPlaceholder}
                      aria-label={searchPlaceholder}
                      className="w-full text-sm border border-lira-border rounded-lg pl-8 pr-2 py-1.5 focus:outline-none focus:border-lira-blue focus:ring-1 focus:ring-lira-blue bg-white"
                    />
                  </div>
                </div>
              )}
              <ul className="overflow-y-auto overscroll-contain py-1 flex-1 min-h-0" role="listbox" aria-multiselectable="true">
                {shown.length === 0 && <li className="px-3 py-3 text-xs text-lira-muted text-center">{options.length === 0 ? emptyText : 'No match'}</li>}
                {shown.map(o => {
                  const on = selected.includes(o.value);
                  return (
                    <li key={o.value} role="option" aria-selected={on}>
                      <label className="flex items-center gap-2.5 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50">
                        <input type={single ? 'radio' : 'checkbox'} className="sr-only peer" checked={on} onChange={() => { onToggle(o.value); if (single) setOpen(false); }} />
                        <span className={`w-4 h-4 ${single ? 'rounded-full' : 'rounded'} border flex items-center justify-center flex-shrink-0 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-lira-blue ${on ? 'bg-lira-blue border-lira-blue text-white' : 'border-gray-300 bg-white'}`}>
                          {on && <Check className="w-3 h-3" strokeWidth={3} />}
                        </span>
                        {o.color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: o.color }} />}
                        <span className="truncate">{o.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {count > 0 && onClear && (
                <div className="border-t border-lira-border px-3 py-2">
                  <button type="button" onClick={onClear} className="text-xs font-medium text-lira-muted hover:text-red-500 cursor-pointer">Clear {label.toLowerCase()}</button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
};
