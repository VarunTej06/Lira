import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Search, Bell, Settings, ChevronDown, Plus, Download, Upload,
  HardDrive, X, LayoutGrid, Zap, Clock, CheckCircle2, Filter,
  GitBranch, DatabaseBackup, AlertCircle, ArrowRight, User, ExternalLink,
  Shield, CheckSquare, Layers, Monitor, CreditCard, Sparkles,
} from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { Modal } from '../common/Modal';
import { exportBackup, importBackup } from '../../db/storageService';
import { subscribeToSyncStatus, saveToDiskNow } from '../../services/localDiskSync';
import { LiraAIAvatar } from '../ai/LiraAIAvatar';
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

// ─── App Launcher Popover (Premium Geometric Logo Button) ─────────────────────

const AppLauncher: React.FC<{
  onToggleAI?: () => void;
  onOpenBackup: () => void;
}> = ({ onToggleAI, onOpenBackup }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const links = [
    {
      label: 'Lira Board',
      icon: <LayoutGrid className="w-5 h-5 text-blue-400" />,
      action: () => setOpen(false),
    },
    {
      label: 'Lira AI Assistant',
      icon: <Zap className="w-5 h-5 text-purple-400" />,
      action: () => { setOpen(false); onToggleAI?.(); },
    },
    {
      label: 'Backup & Restore',
      icon: <DatabaseBackup className="w-5 h-5 text-emerald-400" />,
      action: () => { setOpen(false); onOpenBackup(); },
    },
    {
      label: 'GitHub Repo',
      icon: <GitBranch className="w-5 h-5 text-sky-400" />,
      action: () => {
        setOpen(false);
        window.open('https://github.com/VarunTej06/Lira', '_blank', 'noopener');
      },
    },
  ];

  return (
    <div ref={ref} className="relative">
      {/* Sleek Geometric App Launcher Button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`p-2 rounded-lg transition-all flex items-center justify-center group cursor-pointer ${
          open
            ? 'bg-blue-600/30 ring-1 ring-blue-400 text-white'
            : 'bg-white/5 hover:bg-white/15 text-white/80 hover:text-white border border-white/10 hover:border-white/20'
        }`}
        title="App Launcher & Quick Links"
      >
        <svg className="w-5 h-5 transition-transform group-hover:scale-105" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="4.5" height="4.5" rx="1.2" fill="#60A5FA" />
          <rect x="9.75" y="3" width="4.5" height="4.5" rx="1.2" fill="#3B82F6" />
          <rect x="16.5" y="3" width="4.5" height="4.5" rx="1.2" fill="#2563EB" />
          <rect x="3" y="9.75" width="4.5" height="4.5" rx="1.2" fill="#818CF8" />
          <rect x="9.75" y="9.75" width="4.5" height="4.5" rx="1.2" fill="#38BDF8" />
          <rect x="16.5" y="9.75" width="4.5" height="4.5" rx="1.2" fill="#6366F1" />
          <rect x="3" y="16.5" width="4.5" height="4.5" rx="1.2" fill="#A78BFA" />
          <rect x="9.75" y="16.5" width="4.5" height="4.5" rx="1.2" fill="#8B5CF6" />
          <rect x="16.5" y="16.5" width="4.5" height="4.5" rx="1.2" fill="#7C3AED" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-[#1D2939] border border-white/10 rounded-xl shadow-2xl z-50 p-2 transition-all duration-150 animate-scale-in">
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider px-2 pb-1.5 border-b border-white/10 mb-1">
            Quick links & apps
          </p>
          {links.map(({ label, icon, action }) => (
            <button
              key={label}
              onClick={action}
              className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm text-white/80 hover:text-white hover:bg-white/10 transition-all cursor-pointer text-left"
            >
              {icon}
              <span className="font-medium text-xs">{label}</span>
            </button>
          ))}
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
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[13px] transition-colors cursor-pointer ${
          open ? 'bg-white/15 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
        }`}
      >
        Your work <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-[#1D2939] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden transition-all duration-150">
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
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[13px] transition-colors cursor-pointer ${
          open ? 'bg-white/15 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
        } ${active && active !== 'all' ? 'text-blue-300' : ''}`}
      >
        Filters <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-[#1D2939] border border-white/10 rounded-xl shadow-xl z-50 p-2 transition-all duration-150">
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
          className="w-full bg-white/10 text-white placeholder-white/40 text-xs rounded pl-8 pr-7 py-1.5 border border-white/10 focus:outline-none focus:bg-white/15 focus:border-white/30 transition-all"
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
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1D2939] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden transition-all duration-150 animate-scale-in">
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

// ─── Notifications Bell (With Update Detail & Clickable Ticket Link) ─────────

const NotificationsBell: React.FC<{
  issues: Issue[];
  onSelectIssue?: (issue: Issue) => void;
}> = ({ issues, onSelectIssue }) => {
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Collect most recent activity entries across issues
  const notifications = useMemo(() => {
    type Entry = {
      issue: Issue;
      author: string;
      actionText: string;
      createdAt: Date | string;
    };
    const all: Entry[] = [];

    issues.forEach(issue => {
      // Activity array
      (issue.activity ?? []).forEach((act: unknown) => {
        const item = act as {
          text?: string;
          description?: string;
          author?: string;
          authorInitials?: string;
          type?: string;
          createdAt?: Date | string;
          timestamp?: Date | string;
        };
        const actionText =
          item.text ||
          item.description ||
          (item.type === 'created' ? 'created this work item' : item.type === 'status_change' ? 'changed status' : 'updated ticket');

        all.push({
          issue,
          author: item.author || 'VY',
          actionText,
          createdAt: item.createdAt || item.timestamp || issue.updatedAt || issue.createdAt,
        });
      });

      // If no activity array but has issue info, add creation entry
      if (!issue.activity || issue.activity.length === 0) {
        all.push({
          issue,
          author: issue.reporter || 'VY',
          actionText: `created ${issue.type} ${issue.key}`,
          createdAt: issue.createdAt,
        });
      }
    });

    return all
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12);
  }, [issues]);

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
        <div className="absolute top-full right-0 mt-2 w-84 bg-[#1D2939] border border-white/10 rounded-xl shadow-2xl z-50 transition-all duration-150 animate-scale-in">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-white/5">
            <span className="text-sm font-semibold text-white">Notifications</span>
            {hasUnread && (
              <button
                onClick={() => setHasUnread(false)}
                className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-88 overflow-y-auto divide-y divide-white/5">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Bell className="w-6 h-6 text-white/20" />
                <p className="text-xs text-white/40">No new notifications</p>
              </div>
            ) : (
              notifications.map((notif, idx) => (
                <div
                  key={`${notif.issue.key}-${idx}`}
                  onClick={() => { onSelectIssue?.(notif.issue); setOpen(false); }}
                  className="flex items-start gap-2.5 px-3.5 py-2.5 hover:bg-white/10 transition-colors cursor-pointer group"
                >
                  <Avatar initials={notif.author.slice(0, 2).toUpperCase()} size="xs" className="mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white/90 leading-snug">
                      <span className="font-semibold text-white">{notif.author}</span>{' '}
                      <span className="text-white/70">{notif.actionText}</span>{' '}
                      <span className="text-blue-400 font-mono font-bold hover:underline">
                        {notif.issue.key}
                      </span>
                    </p>
                    <p className="text-[11px] text-white/50 mt-0.5 truncate group-hover:text-white/80">
                      {notif.issue.title}
                    </p>
                    <p className="text-[10px] text-white/30 mt-1">{relativeTime(notif.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Jira Settings Popover Menu (Matching Settings Gear Features.png) ─────────

const SettingsGearMenu: React.FC<{
  onOpenSystemModal: () => void;
  onOpenProfileModal: () => void;
}> = ({ onOpenSystemModal, onOpenProfileModal }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  interface SettingsAction {
    id: string;
    label: string;
    desc: string;
    icon: React.ReactNode;
    external?: boolean;
    onClick: () => void;
  }
  interface SettingsGroup {
    category: string;
    actions: SettingsAction[];
  }

  const items: SettingsGroup[] = [
    {
      category: 'Personal Jira settings',
      actions: [
        {
          id: 'general',
          label: 'General settings',
          desc: 'Manage language, time zone, and other personal preferences',
          icon: <User className="w-4 h-4 text-blue-400" />,
          onClick: () => { setOpen(false); onOpenProfileModal(); },
        },
        {
          id: 'notifications',
          label: 'Notification settings',
          desc: 'Manage email and in-app notifications from Jira',
          icon: <Bell className="w-4 h-4 text-amber-400" />,
          onClick: () => { setOpen(false); alert('Notification settings: In-app live sync is enabled.'); },
        },
      ],
    },
    {
      category: 'Jira admin settings',
      actions: [
        {
          id: 'system',
          label: 'System & Local PC Data',
          desc: 'Manage disk backups, sync status, theme, and system diagnostics',
          icon: <Monitor className="w-4 h-4 text-emerald-400" />,
          onClick: () => { setOpen(false); onOpenSystemModal(); },
        },
        {
          id: 'apps',
          label: 'Jira apps',
          desc: 'Manage access, settings, and integrations across Jira',
          icon: <LayoutGrid className="w-4 h-4 text-purple-400" />,
          onClick: () => { setOpen(false); alert('Jira apps: Vite Local File Storage Plugin & Dexie DB active.'); },
        },
        {
          id: 'spaces',
          label: 'Spaces',
          desc: 'Manage space settings, categories, and more',
          icon: <Layers className="w-4 h-4 text-sky-400" />,
          onClick: () => { setOpen(false); alert('Manage spaces via sidebar space settings gear.'); },
        },
        {
          id: 'workitems',
          label: 'Work items',
          desc: 'Configure work types, workflows, screens, fields, and hierarchy',
          icon: <CheckSquare className="w-4 h-4 text-orange-400" />,
          onClick: () => { setOpen(false); alert('Work items: 3-tier hierarchy (Epic → Task/Bug → Subtask) active.'); },
        },
        {
          id: 'marketplace',
          label: 'Marketplace apps',
          desc: 'Add and manage Jira Marketplace apps and integrations',
          icon: <Sparkles className="w-4 h-4 text-pink-400" />,
          onClick: () => { setOpen(false); alert('Marketplace: Lira Offline Edition v2.0.'); },
        },
      ],
    },
    {
      category: 'Atlassian admin settings',
      actions: [
        {
          id: 'users',
          label: 'User management',
          desc: 'Manage users, groups, and access requests',
          icon: <Shield className="w-4 h-4 text-indigo-400" />,
          external: true,
          onClick: () => { setOpen(false); alert('User management: Local Administrator profile active.'); },
        },
        {
          id: 'billing',
          label: 'Billing',
          desc: 'Update your billing details, manage subscriptions, and more',
          icon: <CreditCard className="w-4 h-4 text-teal-400" />,
          external: true,
          onClick: () => { setOpen(false); alert('Billing: Lira Offline Edition is free and open-source.'); },
        },
      ],
    },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`p-1.5 rounded hover:bg-white/10 transition-colors cursor-pointer ${
          open ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white'
        }`}
        title="Settings & Administration"
      >
        <Settings className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-88 bg-white text-jira-text border border-jira-border rounded-xl shadow-2xl z-50 p-3 transition-all duration-150 animate-scale-in max-h-[85vh] overflow-y-auto">
          {/* Search bar inside settings popover */}
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search ( Ctrl + K )"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-50 text-xs rounded-lg pl-8 pr-3 py-1.5 border border-gray-200 focus:outline-none focus:bg-white focus:border-jira-blue transition-all"
            />
          </div>

          <div className="space-y-4">
            {items.map(group => {
              const filteredActions = group.actions.filter(
                a => a.label.toLowerCase().includes(search.toLowerCase()) || a.desc.toLowerCase().includes(search.toLowerCase())
              );
              if (filteredActions.length === 0) return null;

              return (
                <div key={group.category} className="space-y-1">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2">
                    {group.category}
                  </p>
                  {filteredActions.map(action => (
                    <button
                      key={action.id}
                      onClick={action.onClick}
                      className="w-full flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors text-left cursor-pointer group"
                    >
                      <div className="mt-0.5 p-1 rounded bg-gray-100 group-hover:bg-blue-50 transition-colors">
                        {action.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-jira-text group-hover:text-jira-blue">
                            {action.label}
                          </span>
                          {action.external && <ExternalLink className="w-3 h-3 text-gray-400" />}
                        </div>
                        <p className="text-[11px] text-jira-muted leading-tight mt-0.5">
                          {action.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
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
}) => {
  const [showSystemModal, setShowSystemModal] = useState(false);
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
      setImportStatus(`✅ Imported ${result.spaces} spaces and ${result.issues} issues. Refresh to see changes.`);
    } catch (err) {
      setImportStatus(`❌ Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, []);

  const handleExport = useCallback(async () => {
    try {
      await exportBackup();
      setImportStatus('✅ Backup downloaded to your computer & synced to PC disk (data/spaces/*.json)');
    } catch (err) {
      setImportStatus(`❌ Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  return (
    <nav className="h-14 bg-[#1D2125] flex items-center px-3 gap-2 flex-shrink-0 z-40 relative">
      {/* App Launcher with Custom Geometric Logo */}
      <AppLauncher
        onToggleAI={onToggleAI}
        onOpenBackup={() => setShowSystemModal(true)}
      />

      {/* Lira Logo + Brand */}
      <div className="flex items-center gap-2 mr-2 cursor-pointer select-none">
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
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0052CC] hover:bg-[#0065FF] text-white text-sm font-medium rounded transition-colors ml-1 cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">Create</span>
      </button>

      {/* Lira AI Button */}
      <button
        type="button"
        onClick={onToggleAI}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md hover:shadow-purple-500/25 transition-all cursor-pointer ml-1"
        title="Open Lira AI Chatbot & Autonomous Agent"
      >
        <LiraAIAvatar size={18} hasSparkles={false} />
        <span className="hidden sm:inline">Lira AI</span>
      </button>

      {/* Local PC Storage Indicator */}
      <button
        type="button"
        onClick={() => saveToDiskNow()}
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

        <SettingsGearMenu
          onOpenSystemModal={() => setShowSystemModal(true)}
          onOpenProfileModal={() => alert('User Profile: Varun Tej (VY) · Local Administrator')}
        />

        <Avatar initials="VY" size="sm" color="#0052CC" className="cursor-pointer hover:ring-2 hover:ring-white/50 transition-all ml-1" />
      </div>

      {/* Hidden file input for import */}
      <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

      {/* System Settings & Data Backup Modal */}
      <SystemSettingsModal
        isOpen={showSystemModal}
        onClose={() => { setShowSystemModal(false); setImportStatus(null); }}
        importing={importing}
        importStatus={importStatus}
        onExport={handleExport}
        onImportClick={() => fileRef.current?.click()}
      />
    </nav>
  );
};
