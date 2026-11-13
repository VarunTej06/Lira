import React, { useState, useEffect, useRef } from 'react';
import { LayoutGrid, Zap, GitBranch, DatabaseBackup, FolderKanban } from 'lucide-react';
import { useClickOutside, useHoverMenu } from './shared';
import { APP_VERSION } from '../../../utils/appVersion';

const ICON = 'w-4 h-4';
// The nine dots; the middle one carries the accent of the theme
const DOTS = [1.5, 6.5, 11.5].flatMap(y => [1.5, 6.5, 11.5].map(x => ({ x, y })));

export const AppLauncher: React.FC<{
  onToggleAI?: () => void;
  onOpenBackup: () => void;
  onNavigateToProjects?: () => void;
}> = ({ onToggleAI, onOpenBackup, onNavigateToProjects }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const hover = useHoverMenu(setOpen);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const links = [
    {
      label: 'Lira Board',
      icon: <LayoutGrid className={ICON} />,
      action: () => setOpen(false),
    },
    {
      label: 'Projects',
      icon: <FolderKanban className={ICON} />,
      action: () => { setOpen(false); onNavigateToProjects?.(); },
    },
    {
      label: 'Viva AI Assistant',
      icon: <Zap className={ICON} />,
      action: () => { setOpen(false); onToggleAI?.(); },
    },
    {
      label: 'Backup & Restore',
      icon: <DatabaseBackup className={ICON} />,
      action: () => { setOpen(false); onOpenBackup(); },
    },
    {
      label: 'GitHub Repo',
      icon: <GitBranch className={ICON} />,
      action: () => {
        setOpen(false);
        window.open('https://github.com/VarunTej06/Lira', '_blank', 'noopener');
      },
    },
  ];

  return (
    <div ref={ref} className="relative" {...hover}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-9 h-9 rounded-xl flex items-center justify-center group cursor-pointer border transition-[background-color,border-color,transform] duration-150 active:scale-95 ${
          open
            ? 'bg-lira-nav-accent/15 border-lira-nav-accent/60 text-lira-nav-accent'
            : 'bg-white/[0.06] border-white/10 text-white/85 hover:bg-white/[0.12] hover:border-white/25 hover:text-white'
        }`}
        title="Switch sites or apps"
        aria-label="Switch sites or apps"
        aria-expanded={open}
      >
        <svg className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-90' : 'group-hover:rotate-90'}`} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          {DOTS.map(({ x, y }, i) => <rect key={i} x={x} y={y} width="3" height="3" rx="1.5" className={i === 4 ? 'fill-lira-nav-accent' : undefined} />)}
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-lira-nav border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden origin-top-left animate-scale-in">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/[0.04]">
            <div>
              <p className="text-sm font-bold text-white tracking-tight leading-none">Lira</p>
              <p className="text-3xs text-white/50 mt-1 uppercase tracking-wider">Switch sites or apps</p>
            </div>
            <span className="text-3xs font-semibold px-2 py-0.5 rounded-full border border-lira-nav-accent/50 text-lira-nav-accent">v{APP_VERSION}</span>
          </div>
          <div className="grid grid-cols-2 gap-1 p-1.5">
            {links.map(({ label, icon, action }) => (
              <button
                key={label}
                onClick={action}
                className="flex flex-col items-start gap-1.5 p-2 rounded-lg text-2xs font-medium text-white/80 border border-transparent hover:text-white hover:bg-white/[0.07] hover:border-white/10 transition-colors cursor-pointer text-left group last:odd:col-span-2 last:odd:flex-row last:odd:items-center"
              >
                <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.07] text-lira-nav-accent group-hover:bg-lira-nav-accent/15 transition-colors flex-shrink-0">
                  {icon}
                </span>
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
