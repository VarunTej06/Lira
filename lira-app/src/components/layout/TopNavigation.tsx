import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Search, Bell, Settings, ChevronDown, Plus, Download, Upload,
  HardDrive, X, LayoutGrid, Zap, Clock, CheckCircle2, Filter,
  GitBranch, DatabaseBackup, AlertCircle, ArrowRight, ExternalLink,
  FolderKanban
} from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { Modal } from '../common/Modal';
import { exportBackup, importBackup } from '../../db/storageService';
import { subscribeToSyncStatus, saveToDiskNow } from '../../services/localDiskSync';
import { AccountDropdown } from './AccountDropdown';
import { SettingsModal, type SettingsSection } from './SettingsModal';
import {
  GeneralSettingsModal,
  NotificationSettingsModal,
  ManageSpacesModal,
  WorkItemsModal,
  MarketplaceModal,
  UserManagementModal,
  BillingModal,
} from './SettingsModals';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TopNavigationProps {
  onCreateIssue?: () => void;
  onToggleAI?: () => void;
  issues?: Issue[];
  spaces?: Space[];
  onSelectIssue?: (issue: Issue) => void;
  onApplyFilter?: (filter: string) => void;
  onNavigateToFilters?: () => void;
  onNavigateToProjects?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

function relativeTime(date: Date | string | undefined): string {
  if (!date) return 'recently';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

// ─── App Launcher Popover (Quick-links with Modern 9-Dot Switcher) ───────────

/** True on devices with a real hover pointer (mouse / trackpad) — hover menus are skipped on touch. */
const canHoverDevice = () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover)').matches;

/** Opens a dropdown shortly after the pointer enters it and closes it after the pointer leaves. */
function useHoverMenu(setOpen: (v: boolean) => void) {
  const timer = useRef<number | undefined>(undefined);
  const clear = () => { if (timer.current) window.clearTimeout(timer.current); };
  useEffect(() => clear, []);
  return {
    onMouseEnter: () => {
      if (!canHoverDevice()) return;
      clear();
      timer.current = window.setTimeout(() => setOpen(true), 90);
    },
    onMouseLeave: () => {
      if (!canHoverDevice()) return;
      clear();
      timer.current = window.setTimeout(() => setOpen(false), 240);
    },
  };
}

const AppLauncher: React.FC<{
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

// ─── Your Work Dropdown ───────────────────────────────────────────────────────

type YourWorkTab = 'worked' | 'assigned' | 'starred';

const YourWorkDropdown: React.FC<{
  issues: Issue[];
  spaces: Space[];
  onSelectIssue?: (issue: Issue) => void;
}> = ({ issues, spaces, onSelectIssue }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<YourWorkTab>('worked');
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const hover = useHoverMenu(setOpen);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const spaceMap = useMemo(() => {
    const map: Record<number, Space> = {};
    spaces.forEach(s => { if (s.id) map[s.id] = s; });
    return map;
  }, [spaces]);

  const workedOn = useMemo(() => {
    return [...issues]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, 8);
  }, [issues]);

  const assignedToMe = useMemo(() => {
    return issues.filter(i => i.assigneeInitials === 'VY' || i.assignee === 'Varun Tej').slice(0, 8);
  }, [issues]);

  const starred = useMemo(() => {
    return issues.filter(i => (i as unknown as { isStarred?: boolean }).isStarred).slice(0, 8);
  }, [issues]);

  const currentItems = tab === 'worked' ? workedOn : tab === 'assigned' ? assignedToMe : starred;

  const statusIcon = (status: string) => {
    if (status === 'done') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
    if (status === 'inprogress') return <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
    return <AlertCircle className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
  };

  return (
    <div ref={ref} className="relative" {...hover}>
      <button
        onClick={() => setOpen(v => (canHoverDevice() ? true : !v))}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-all duration-200 cursor-pointer ${
          open ? 'bg-white/15 text-white shadow-inner' : 'text-white/80 hover:text-white hover:bg-white/10'
        }`}
      >
        Your work <ChevronDown className={`w-3 h-3 opacity-60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-[#1D2939] border border-white/10 rounded-2xl shadow-2xl z-50 animate-scale-in origin-top-left overflow-hidden transition-all duration-150">
          <div className="flex border-b border-white/10 px-2 pt-2 gap-1 bg-white/5">
            {[
              { id: 'worked' as const, label: 'Worked on' },
              { id: 'assigned' as const, label: 'Assigned to me' },
              { id: 'starred' as const, label: 'Starred' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors cursor-pointer ${
                  tab === t.id
                    ? 'bg-[#1D2939] text-white border-t border-x border-white/10'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {currentItems.length === 0 ? (
              <p className="text-xs text-white/40 text-center py-6">
                {tab === 'starred' ? 'Star work items to see them here.' : 'No items found.'}
              </p>
            ) : (
              currentItems.map(issue => (
                <button
                  key={issue.key}
                  onClick={() => { onSelectIssue?.(issue); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 transition-all duration-150 text-left cursor-pointer"
                >
                  {statusIcon(issue.status)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-mono text-white/40 flex-shrink-0">{issue.key}</span>
                      <span className="text-xs text-white/80 truncate">{issue.title}</span>
                    </div>
                    <div className="text-[10px] text-white/30">
                      {spaceMap[issue.spaceId]?.name ?? 'Space'} · {relativeTime(issue.updatedAt)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Filters Dropdown ─────────────────────────────────────────────────────────

const FiltersDropdown: React.FC<{
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

// ─── Omni-Search Bar ─────────────────────────────────────────────────────────

const OmniSearch: React.FC<{
  issues: Issue[];
  spaces: Space[];
  onSelectIssue?: (issue: Issue) => void;
}> = ({ issues, spaces, onSelectIssue }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  const spaceMap = useMemo(() => {
    const map: Record<number, Space> = {};
    spaces.forEach(s => { if (s.id) map[s.id] = s; });
    return map;
  }, [spaces]);

  // Global hotkey: Ctrl+K or /
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      const inInput = activeTag === 'input' || activeTag === 'textarea';
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      } else if (e.key === '/' && !inInput) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return issues.filter(issue => {
      return (
        fuzzyMatch(query, issue.key) ||
        fuzzyMatch(query, issue.title) ||
        issue.labels?.some(l => fuzzyMatch(query, l))
      );
    }).slice(0, 10);
  }, [issues, query]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[selectedIdx];
      if (target) {
        onSelectIssue?.(target);
        setQuery('');
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const grouped = useMemo(() => {
    const map: Record<string, Issue[]> = {};
    results.forEach(issue => {
      const sName = spaceMap[issue.spaceId]?.name ?? 'Other';
      if (!map[sName]) map[sName] = [];
      map[sName].push(issue);
    });
    return map;
  }, [results, spaceMap]);

  let flatIdx = 0;

  return (
    <div ref={containerRef} className="flex-1 max-w-xs mx-2 relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search work items..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (query.trim()) setOpen(true); }}
          onKeyDown={handleKeyDown}
          className="w-full bg-white/10 text-white placeholder-white/40 text-xs rounded-xl pl-8 pr-7 py-2 border border-white/10 focus:outline-none focus:bg-white/15 focus:border-white/30 transition-all"
        />
        {query ? (
          <button
            onClick={() => { setQuery(''); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        ) : (
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/30 font-mono">/</kbd>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1D2939] border border-white/10 rounded-2xl shadow-2xl z-50 animate-scale-in origin-top-left overflow-hidden transition-all duration-150 animate-scale-in">
          <div className="max-h-72 overflow-y-auto py-1">
            {Object.entries(grouped).map(([spaceName, spaceIssues]) => (
              <div key={spaceName}>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider">{spaceName}</div>
                {spaceIssues.map(issue => {
                  const idx = flatIdx++;
                  return (
                    <button
                      key={issue.key}
                      onClick={() => { onSelectIssue?.(issue); setQuery(''); setOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-all duration-150 cursor-pointer ${
                        selectedIdx === idx ? 'bg-white/15' : 'hover:bg-white/10'
                      }`}
                    >
                      <span className="text-[10px] font-mono text-blue-400 font-bold flex-shrink-0">{issue.key}</span>
                      <span className="text-xs text-white/80 truncate flex-1">{issue.title}</span>
                      <span className="text-[10px] text-white/30 flex-shrink-0 hidden sm:block">{spaceMap[issue.spaceId]?.name}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 px-3 py-1.5 flex gap-3 text-[10px] text-white/30">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">Enter</kbd> open</span>
            <span><kbd className="font-mono">Esc</kbd> close</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Notifications Bell (With Action Details & Clickable Ticket Link) ─────────

const NotificationsBell: React.FC<{
  issues: Issue[];
  onSelectIssue?: (issue: Issue) => void;
}> = ({ issues, onSelectIssue }) => {
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'created' | 'edited' | 'closed'>('all');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Collect and classify action entries (created / edited / closed) across issues
  const notifications = useMemo(() => {
    type ActionCategory = 'created' | 'edited' | 'closed';
    type Entry = {
      id: string;
      issue: Issue;
      author: string;
      category: ActionCategory;
      actionText: string;
      createdAt: Date | string;
    };
    const all: Entry[] = [];

    issues.forEach(issue => {
      // 1. Closed tickets (Done)
      if (issue.status === 'done') {
        all.push({
          id: `${issue.key}-closed`,
          issue,
          author: issue.assigneeInitials || issue.assignee || 'VY',
          category: 'closed',
          actionText: 'closed ticket and transitioned to Done',
          createdAt: issue.resolvedAt || issue.updatedAt || issue.createdAt,
        });
      }

      // 2. Activity events (status change, created, edit)
      (issue.activity ?? []).forEach((act: unknown, idx: number) => {
        const item = act as {
          text?: string;
          description?: string;
          author?: string;
          type?: string;
          createdAt?: Date | string;
          timestamp?: Date | string;
        };

        let cat: ActionCategory = 'edited';
        let desc = item.text || item.description || 'updated ticket details';

        if (item.type === 'created') {
          cat = 'created';
          desc = `created this ${issue.type}`;
        } else if (item.type === 'status_change') {
          if (desc.toLowerCase().includes('done')) {
            cat = 'closed';
            desc = 'transitioned ticket to Done';
          } else {
            cat = 'edited';
            desc = `changed status to ${item.description || 'in progress'}`;
          }
        }

        all.push({
          id: `${issue.key}-act-${idx}`,
          issue,
          author: item.author || issue.assigneeInitials || 'VY',
          category: cat,
          actionText: desc,
          createdAt: item.createdAt || item.timestamp || issue.updatedAt || issue.createdAt,
        });
      });

      // 3. Issue creation event fallback
      if (!issue.activity || issue.activity.length === 0) {
        all.push({
          id: `${issue.key}-created`,
          issue,
          author: issue.reporter || 'VY',
          category: 'created',
          actionText: `created ${issue.type}`,
          createdAt: issue.createdAt,
        });

        // 4. Issue edit fallback if updated significantly after creation and not done
        if (
          issue.updatedAt &&
          new Date(issue.updatedAt).getTime() > new Date(issue.createdAt).getTime() + 60000 &&
          issue.status !== 'done'
        ) {
          all.push({
            id: `${issue.key}-edited`,
            issue,
            author: issue.assigneeInitials || 'VY',
            category: 'edited',
            actionText: `edited priority to ${issue.priority} & updated fields`,
            createdAt: issue.updatedAt,
          });
        }
      }
    });

    return all
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);
  }, [issues]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (activeTab !== 'all' && n.category !== activeTab) return false;
      if (onlyUnread && !hasUnread) return false;
      return true;
    });
  }, [notifications, activeTab, onlyUnread, hasUnread]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`relative p-1.5 rounded hover:bg-white/10 transition-colors cursor-pointer ${
          open ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white'
        }`}
        title="Notifications Center"
      >
        <Bell className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
        {hasUnread && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-[#1D2125]" />}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-96 bg-[#1D2939] border border-white/10 rounded-xl shadow-2xl z-50 transition-all duration-150 animate-scale-in overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Notifications</span>
              <span className="text-[10px] bg-white/10 text-white/60 px-1.5 py-0.2 rounded font-mono">
                {filteredNotifications.length}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11px] text-white/60 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyUnread}
                  onChange={e => setOnlyUnread(e.target.checked)}
                  className="w-3.5 h-3.5 text-blue-500 rounded border-white/20 bg-white/10"
                />
                <span>Only unread</span>
              </label>
              {hasUnread && (
                <button
                  onClick={() => setHasUnread(false)}
                  className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                >
                  Mark all as read
                </button>
              )}
            </div>
          </div>

          {/* Action Filter Tabs (All / Created / Edited / Closed) */}
          <div className="flex border-b border-white/10 px-2 pt-1.5 gap-1 bg-white/[0.02]">
            {[
              { id: 'all' as const, label: 'All' },
              { id: 'created' as const, label: 'Created' },
              { id: 'edited' as const, label: 'Edited' },
              { id: 'closed' as const, label: 'Closed' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-t-lg transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#1D2939] text-white border-t border-x border-white/10'
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notifications Feed */}
          <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
                <Bell className="w-6 h-6 text-white/20" />
                <p className="text-xs text-white/50">No notifications in this view</p>
                <p className="text-[11px] text-white/30">Action updates will appear as tickets are created, edited, or closed.</p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const badgeColor =
                  notif.category === 'closed'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : notif.category === 'edited'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-blue-500/20 text-blue-300 border-blue-500/30';

                const badgeLabel =
                  notif.category === 'closed'
                    ? '✓ Closed'
                    : notif.category === 'edited'
                    ? '✏️ Edited'
                    : '+ Created';

                return (
                  <div
                    key={notif.id}
                    onClick={() => { onSelectIssue?.(notif.issue); setOpen(false); }}
                    className="flex items-start gap-2.5 px-3.5 py-2.5 hover:bg-white/10 transition-colors cursor-pointer group"
                  >
                    <Avatar initials={notif.author.slice(0, 2).toUpperCase()} size="xs" className="mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-white text-xs">{notif.author}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${badgeColor}`}>
                          {badgeLabel}
                        </span>
                        <span className="text-white/70 text-xs">{notif.actionText}</span>
                      </div>

                      {/* Explicit Ticket Hyperlink */}
                      <div className="mt-1 flex items-center gap-1.5">
                        <a
                          href={`#issue-${notif.issue.key}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onSelectIssue?.(notif.issue);
                            setOpen(false);
                          }}
                          className="text-blue-400 hover:text-blue-300 font-mono font-bold text-xs hover:underline flex items-center gap-0.5"
                          title={`Open ${notif.issue.key}`}
                        >
                          {notif.issue.key}
                          <ExternalLink className="w-2.5 h-2.5 opacity-60 inline" />
                        </a>
                        <span className="text-white/30 text-[11px]">·</span>
                        <span className="text-[11px] text-white/60 truncate max-w-[200px] group-hover:text-white/90">
                          {notif.issue.title}
                        </span>
                      </div>

                      <p className="text-[10px] text-white/30 mt-1">{relativeTime(notif.createdAt)}</p>
                    </div>
                    {hasUnread && (
                      <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};



// ─── System & Backup Modal ───────────────────────────────────────────────────

const SystemSettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  importing: boolean;
  importStatus: string | null;
  onExport: () => void;
  onImportClick: () => void;
}> = ({ isOpen, onClose, importing, importStatus, onExport, onImportClick }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('lira_theme') as 'light' | 'dark') ?? 'dark';
  });

  const handleThemeToggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('lira_theme', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="System & Data Management" size="md">
      <div className="p-6 space-y-6 text-jira-text">
        {/* PC Disk info */}
        <div>
          <h3 className="text-sm font-bold text-jira-text flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-600" />
            Local PC Disk Persistence
          </h3>
          <p className="text-xs text-jira-muted mt-1 leading-relaxed">
            All data is partitioned into individual space files (<code className="bg-gray-100 px-1 py-0.5 rounded font-mono">data/spaces/*.json</code>) and simultaneously consolidated at <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">data/lira-workspace.json</code>.
          </p>
        </div>

        {/* Backup actions */}
        <div className="space-y-3">
          <button
            onClick={onExport}
            className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 text-jira-blue rounded-xl hover:bg-blue-100 transition-colors text-sm font-semibold cursor-pointer border border-blue-200"
          >
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export Unified JSON Backup
            </span>
            <span className="text-[11px] bg-jira-blue text-white px-2 py-0.5 rounded-full font-medium">
              Download + Disk Sync
            </span>
          </button>

          <button
            onClick={onImportClick}
            disabled={importing}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-jira-text rounded-xl hover:bg-gray-100 transition-colors text-sm font-semibold border border-jira-border disabled:opacity-50 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-gray-600" />
              {importing ? 'Importing dataset...' : 'Import JSON Backup'}
            </span>
            <span className="text-[11px] text-jira-muted">Restore &amp; Overwrite</span>
          </button>
        </div>

        {importStatus && (
          <div className={`text-xs p-3 rounded-lg ${importStatus.startsWith('✅') ? 'bg-green-50 text-green-700 font-medium' : 'bg-red-50 text-red-700'}`}>
            {importStatus}
          </div>
        )}

        {/* Theme Settings */}
        <div className="border-t border-jira-border pt-4 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-jira-text">Appearance Theme</h4>
            <p className="text-xs text-jira-muted">Toggle between dark and light workspace interface</p>
          </div>
          <button
            onClick={handleThemeToggle}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-800'
            }`}
          >
            {theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Main TopNavigation Export ────────────────────────────────────────────────

export const TopNavigation: React.FC<TopNavigationProps> = ({
  onCreateIssue,
  onToggleAI,
  issues = [],
  spaces = [],
  onSelectIssue,
  onApplyFilter,
  onNavigateToFilters,
  onNavigateToProjects,
}) => {
  const [showUnifiedSettingsModal, setShowUnifiedSettingsModal] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsSection>('appearance');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const [showSystemModal, setShowSystemModal] = useState(false);
  const [showGeneralModal, setShowGeneralModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showSpacesModal, setShowSpacesModal] = useState(false);
  const [showWorkItemsModal, setShowWorkItemsModal] = useState(false);
  const [showMarketplaceModal, setShowMarketplaceModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<{ status: string; lastSaved: Date | null; filePath: string }>({
    status: 'synced',
    lastSaved: null,
    filePath: 'data/lira-workspace.json',
  });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return subscribeToSyncStatus(setSyncState);
  }, []);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const result = await importBackup(file);
      const msg = `Imported ${result.spaces} spaces and ${result.issues} issues!`;
      setImportStatus(`✅ ${msg}`);
      showToast(msg, 'success');
    } catch (err) {
      const errText = `Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setImportStatus(`❌ ${errText}`);
      showToast(errText, 'error');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [showToast]);

  const handleExport = useCallback(async () => {
    try {
      await exportBackup();
      const msg = 'Backup downloaded & synced to PC disk (data/spaces/*.json)!';
      setImportStatus(`✅ ${msg}`);
      showToast(msg, 'success');
    } catch (err) {
      const errText = `Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setImportStatus(`❌ ${errText}`);
      showToast(errText, 'error');
    }
  }, [showToast]);

  return (
    <nav className="mx-2 mt-2 h-14 rounded-2xl bg-gradient-to-r from-[#1C2540] via-[#1A2236] to-[#151B2B] border border-white/[0.08] shadow-[0_8px_26px_rgba(0,0,0,0.32)] flex items-center px-3 gap-2 flex-shrink-0 z-40 relative">
      {/* App Launcher with Custom Geometric Logo */}
      <AppLauncher
        onToggleAI={onToggleAI}
        onNavigateToProjects={onNavigateToProjects}
        onOpenBackup={() => {
          setSettingsInitialSection('backup');
          setShowUnifiedSettingsModal(true);
        }}
      />

      {/* Lira Logo + Brand */}
      <div className="flex items-center gap-2 mr-2 px-1.5 py-1 rounded-xl cursor-pointer select-none transition-transform duration-200 hover:scale-[1.04]">
        <img
          src="/lira-logo.png"
          alt="Lira Logo"
          className="w-7 h-7 object-contain drop-shadow-xs"
        />
        <span className="text-white font-bold text-base tracking-tight">Lira</span>
      </div>

      {/* Nav items — Your work + Filters */}
      <div className="hidden md:flex items-center gap-0.5">
        <YourWorkDropdown issues={issues} spaces={spaces} onSelectIssue={onSelectIssue} />
        <FiltersDropdown
          onApplyFilter={onApplyFilter}
          onNavigateToFilters={onNavigateToFilters}
        />
      </div>

      {/* Omni-Search */}
      <OmniSearch issues={issues} spaces={spaces} onSelectIssue={onSelectIssue} />

      {/* Create button */}
      <button
        onClick={onCreateIssue}
        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-jira-blue to-jira-blue-hover hover:brightness-110 text-white text-sm font-semibold rounded-xl shadow-[0_4px_14px_rgb(var(--jira-blue)/0.35)] hover:shadow-[0_6px_18px_rgb(var(--jira-blue)/0.5)] hover:-translate-y-px active:translate-y-0 transition-all duration-200 ml-1 cursor-pointer"
        title="Create a ticket — you'll choose the space"
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">Create</span>
      </button>

      {/* Local PC Storage Indicator */}
      <button
        type="button"
        onClick={async () => {
          const ok = await saveToDiskNow();
          showToast(
            ok ? 'Workspace saved to local PC disk (data/spaces/*.json)!' : 'Failed to save to PC disk',
            ok ? 'success' : 'error'
          );
        }}
        className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all border border-white/15 hover:border-white/30 hover:bg-white/5 ml-auto cursor-pointer"
        title={`Saved locally on your PC in: ${syncState.filePath}\nClick to force save now.`}
      >
        <HardDrive className="w-3.5 h-3.5 text-white/60" />
        {syncState.status === 'saving' ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-amber-300 text-[11px] font-medium">Saving to PC…</span>
          </>
        ) : syncState.status === 'error' ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="text-red-300 text-[11px] font-medium">Save error</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-emerald-300 text-[11px] font-medium">PC Saved</span>
          </>
        )}
      </button>

      {/* Right utilities */}
      <div className="flex items-center gap-1 ml-1">
        <NotificationsBell issues={issues} onSelectIssue={onSelectIssue} />

        {/* Wired Settings Gear Icon Button */}
        <button
          onClick={() => {
            setSettingsInitialSection('appearance');
            setShowUnifiedSettingsModal(true);
          }}
          className={`p-2 rounded-xl hover:bg-white/10 transition-all duration-200 hover:rotate-45 cursor-pointer ${
            showUnifiedSettingsModal ? 'bg-white/15 text-white ring-1 ring-white/30' : 'text-white/70 hover:text-white'
          }`}
          title="Settings & Administration"
        >
          <Settings className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
        </button>

        <AccountDropdown />
      </div>

      {/* Hidden file input for import */}
      <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

      {/* Unified Settings Modal (Appearance, Export/Backup, Profile) */}
      <SettingsModal
        isOpen={showUnifiedSettingsModal}
        onClose={() => setShowUnifiedSettingsModal(false)}
        initialSection={settingsInitialSection}
        onToast={showToast}
      />

      {/* Toast Feedback Banner */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold animate-scale-in transition-all ${
          toast.type === 'error'
            ? 'bg-red-900/95 text-red-100 border-red-700'
            : 'bg-[#1D2939]/95 text-white border-white/20'
        }`}>
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* System Settings & Data Backup Modal */}
      <SystemSettingsModal
        isOpen={showSystemModal}
        onClose={() => { setShowSystemModal(false); setImportStatus(null); }}
        importing={importing}
        importStatus={importStatus}
        onExport={handleExport}
        onImportClick={() => fileRef.current?.click()}
      />

      {/* Jira Settings Modals */}
      <GeneralSettingsModal isOpen={showGeneralModal} onClose={() => setShowGeneralModal(false)} />
      <NotificationSettingsModal isOpen={showNotifModal} onClose={() => setShowNotifModal(false)} />
      <ManageSpacesModal
        isOpen={showSpacesModal}
        onClose={() => setShowSpacesModal(false)}
        spaces={spaces}
        onSelectSpace={(id) => {
          localStorage.setItem('lira_active_space_id', String(id));
          window.location.reload();
        }}
      />
      <WorkItemsModal isOpen={showWorkItemsModal} onClose={() => setShowWorkItemsModal(false)} />
      <MarketplaceModal isOpen={showMarketplaceModal} onClose={() => setShowMarketplaceModal(false)} />
      <UserManagementModal isOpen={showUsersModal} onClose={() => setShowUsersModal(false)} />
      <BillingModal isOpen={showBillingModal} onClose={() => setShowBillingModal(false)} />
    </nav>
  );
};
