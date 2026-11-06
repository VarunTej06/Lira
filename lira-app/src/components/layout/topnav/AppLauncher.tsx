import React, { useState, useEffect, useRef } from 'react';
import { LayoutGrid, Zap, GitBranch, DatabaseBackup, FolderKanban } from 'lucide-react';
import { useClickOutside, useHoverMenu, canHoverDevice } from './shared';

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
      icon: <LayoutGrid className="w-4 h-4 text-blue-400" />,
      action: () => setOpen(false),
    },
    {
      label: 'Projects',
      icon: <FolderKanban className="w-4 h-4 text-violet-400" />,
      action: () => { setOpen(false); onNavigateToProjects?.(); },
    },
    {
      label: 'Viva AI Assistant',
      icon: <Zap className="w-4 h-4 text-purple-400" />,
      action: () => { setOpen(false); onToggleAI?.(); },
    },
    {
      label: 'Backup & Restore',
      icon: <DatabaseBackup className="w-4 h-4 text-emerald-400" />,
      action: () => { setOpen(false); onOpenBackup(); },
    },
    {
      label: 'GitHub Repo',
      icon: <GitBranch className="w-4 h-4 text-sky-400" />,
      action: () => {
        setOpen(false);
        window.open('https://github.com/VarunTej06/Lira', '_blank', 'noopener');
      },
    },
  ];

  return (
    <div ref={ref} className="relative" {...hover}>
      {/* Modern 9-Dot Quick-Links App Switcher */}
      <button
        onClick={() => setOpen(v => (canHoverDevice() ? true : !v))}
        className={`p-2 rounded-lg transition-all duration-150 flex items-center justify-center group cursor-pointer ${
          open
            ? 'bg-[#0C66E4]/25 border border-blue-400 text-blue-300 ring-2 ring-blue-500/30 shadow-md'
            : 'bg-white/5 hover:bg-white/15 active:scale-95 text-white/80 hover:text-white border border-white/10 hover:border-white/20 shadow-2xs'
        }`}
        title="Switch sites or apps"
        aria-label="Switch sites or apps"
      >
        {/* 9-dot waffle grid SVG (3x3 grid of small rounded rectangles, white on dark bg) */}
        <svg
          className="w-4 h-4 text-white/90 group-hover:text-white transition-colors duration-150"
          viewBox="0 0 16 16"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="1.5" y="1.5" width="3" height="3" rx="0.75" />
          <rect x="6.5" y="1.5" width="3" height="3" rx="0.75" />
          <rect x="11.5" y="1.5" width="3" height="3" rx="0.75" />
          <rect x="1.5" y="6.5" width="3" height="3" rx="0.75" />
          <rect x="6.5" y="6.5" width="3" height="3" rx="0.75" />
          <rect x="11.5" y="6.5" width="3" height="3" rx="0.75" />
          <rect x="1.5" y="11.5" width="3" height="3" rx="0.75" />
          <rect x="6.5" y="11.5" width="3" height="3" rx="0.75" />
          <rect x="11.5" y="11.5" width="3" height="3" rx="0.75" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-60 bg-[#1D2939] border border-white/10 rounded-2xl shadow-2xl z-50 p-2 origin-top-left animate-scale-in">
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider px-2.5 pb-2 border-b border-white/10 mb-1 flex items-center justify-between">
            <span>Switch sites or apps</span>
            <span className="text-[9px] bg-white/10 px-1.5 py-0.2 rounded font-normal text-white/50">Lira v2.0</span>
          </p>
          <div className="space-y-0.5">
            {links.map(({ label, icon, action }) => (
              <button
                key={label}
                onClick={action}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition-all cursor-pointer text-left group"
              >
                <div className="p-1 rounded-md bg-white/5 group-hover:bg-white/15 transition-colors">
                  {icon}
                </div>
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
