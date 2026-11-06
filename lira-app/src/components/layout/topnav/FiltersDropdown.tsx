import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Zap, Clock, CheckCircle2, Filter, ArrowRight } from 'lucide-react';
import { useClickOutside, useHoverMenu, canHoverDevice } from './shared';

export const FiltersDropdown: React.FC<{
  onApplyFilter?: (filter: string) => void;
  onNavigateToFilters?: () => void;
}> = ({ onApplyFilter, onNavigateToFilters }) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const hover = useHoverMenu(setOpen);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const presets = [
    { id: 'all', label: 'All Issues', desc: 'Show every issue', icon: <Filter className="w-3.5 h-3.5 text-white/40" /> },
    { id: 'open', label: 'Open Issues', desc: 'Backlog, To-do, In Progress', icon: <Clock className="w-3.5 h-3.5 text-blue-400" /> },
    { id: 'completed', label: 'Completed', desc: 'Status: Done', icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> },
    { id: 'recent', label: 'Recently Updated', desc: 'Updated in last 7 days', icon: <Zap className="w-3.5 h-3.5 text-amber-400" /> },
  ];

  const handleSelect = (id: string) => {
    setActive(id);
    onApplyFilter?.(id);
    onNavigateToFilters?.();
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative" {...hover}>
      <button
        onClick={() => setOpen(v => (canHoverDevice() ? true : !v))}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-all duration-200 cursor-pointer ${
          open ? 'bg-white/15 text-white shadow-inner' : 'text-white/80 hover:text-white hover:bg-white/10'
        } ${active && active !== 'all' ? 'text-blue-300' : ''}`}
      >
        Filters <ChevronDown className={`w-3 h-3 opacity-60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-[#1D2939] border border-white/10 rounded-2xl shadow-2xl z-50 animate-scale-in origin-top-left p-2 transition-all duration-150">
          {/* Prominent Action to Open Full Filter Page */}
          <button
            onClick={() => { setOpen(false); onNavigateToFilters?.(); }}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-semibold mb-2 transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-400" />
              Advanced Filters Explorer
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-300" />
          </button>

          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider px-2 py-1">Preset filters</p>
          {presets.map(({ id, label, desc, icon }) => (
            <button
              key={id}
              onClick={() => handleSelect(id)}
              className={`w-full flex items-start gap-2.5 px-2 py-2 rounded-lg text-left transition-all duration-150 cursor-pointer ${
                active === id ? 'bg-white/15 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <span className="mt-0.5">{icon}</span>
              <div>
                <div className="text-xs font-medium">{label}</div>
                <div className="text-[10px] text-white/40">{desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
