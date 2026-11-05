import React, { useState, useRef, useEffect } from 'react';
import {
  Share2, Zap, Maximize2, Search, ChevronDown, MoreHorizontal,
  Users, SlidersHorizontal, X, Tag, Download, FileJson, FileText,
  Settings, ToggleLeft, ToggleRight, CheckSquare,
  Eye, EyeOff, Archive, ArchiveRestore, Edit3,
} from 'lucide-react';
import type { Space } from '../../types/space';
import type { Issue } from '../../types/issue';
import { Avatar } from '../common/Avatar';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { BoardSettingsModal, WIPLimitsModal, BulkActionsModal } from './BoardModals';
import { FormsModal } from './FormsModal';
import { DocumentsModal } from './DocumentsModal';
import { AttachmentsModal } from './AttachmentsModal';
import { ReportsModal } from './ReportsModal';

// ─── Types ───────────────────────────────────────────────────────────────────

type GroupBy = 'status' | 'assignee' | 'priority' | 'epic';

interface BoardActionBarProps {
  space: Space | undefined;
  issues?: Issue[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterAssignee: boolean;
  onFilterAssigneeToggle: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onFilterChange?: (filters: { priorities: string[]; labels: string[] }) => void;
  onGroupChange?: (groupBy: GroupBy) => void;
  onClearFilters?: () => void;
  availableLabels?: string[];
  onBulkAction?: () => void;
  onMaximize?: () => void;
  isSpaceHidden?: boolean;
  isSpaceArchived?: boolean;
  onToggleHideSpace?: () => void;
  onToggleArchiveSpace?: () => void;
  onEditSpace?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAIN_TABS = ['Summary', 'Board', 'List', 'Calendar', 'Capacity'];
const MORE_TABS = ['Forms', 'Documents', 'Attachments', 'Reports'];

const PRIORITIES: { label: string; value: string; color: string }[] = [
  { label: 'Highest', value: 'highest', color: '#FF0000' },
  { label: 'High',    value: 'high',    color: '#FF5630' },
  { label: 'Medium',  value: 'medium',  color: '#FF8B00' },
  { label: 'Low',     value: 'low',     color: '#36B37E' },
  { label: 'Lowest',  value: 'lowest',  color: '#00B8D9' },
];

const GROUP_OPTIONS: { label: string; value: GroupBy }[] = [
  { label: 'Status',       value: 'status'   },
  { label: 'Assignee',     value: 'assignee' },
  { label: 'Priority',     value: 'priority' },
  { label: 'Epic / Parent',value: 'epic'     },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handler();
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function issuesToCSV(issues: Issue[]): string {
  const header = ['Key', 'Title', 'Type', 'Status', 'Priority', 'Assignee', 'Labels', 'Due Date'];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = issues.map(i => [
    escape(i.key),
    escape(i.title),
    escape(i.type),
    escape(i.status),
    escape(i.priority),
    escape(i.assignee ?? ''),
    escape((i.labels ?? []).join('; ')),
    escape(i.dueDate ? new Date(i.dueDate).toLocaleDateString() : ''),
  ].join(','));
  return [header.join(','), ...rows].join('\n');
}

// ─── Component ────────────────────────────────────────────────────────────────

export const BoardActionBar: React.FC<BoardActionBarProps> = ({
  space,
  issues = [],
  searchQuery,
  onSearchChange,
  filterAssignee,
  onFilterAssigneeToggle,
  activeTab,
  onTabChange,
  onFilterChange,
  onGroupChange,
  onClearFilters,
  availableLabels = [],
  onBulkAction,
  onMaximize,
  isSpaceHidden = false,
  isSpaceArchived = false,
  onToggleHideSpace,
  onToggleArchiveSpace,
  onEditSpace,
}) => {
  // ── Share modal ──────────────────────────────────────────────────────────────
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportToast, setExportToast] = useState<string | null>(null);

  // ── More tabs dropdown ───────────────────────────────────────────────────────
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  useClickOutside(moreRef, () => setShowMore(false));

  // ── Filter popover ───────────────────────────────────────────────────────────
  const [showFilter, setShowFilter] = useState(false);
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [filterLabels, setFilterLabels] = useState<string[]>([]);
  const filterRef = useRef<HTMLDivElement>(null);
  useClickOutside(filterRef, () => setShowFilter(false));

  // ── Group dropdown ───────────────────────────────────────────────────────────
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  const [showGroup, setShowGroup] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  useClickOutside(groupRef, () => setShowGroup(false));

  // ── Overflow menu ────────────────────────────────────────────────────────────
  const [showOverflow, setShowOverflow] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);
  useClickOutside(overflowRef, () => setShowOverflow(false));
  const [wipEnabled, setWipEnabled] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('lira_wip_limits');
      if (!raw) return false;
      if (raw === 'true') return true;
      if (raw.startsWith('{')) {
        const obj = JSON.parse(raw);
        return Object.values(obj).some((v: any) => typeof v === 'number' && v > 0);
      }
      return false;
    } catch { return false; }
  });
  const [showBoardSettingsModal, setShowBoardSettingsModal] = useState(false);
  const [showWipLimitsModal, setShowWipLimitsModal] = useState(false);
  const [showBulkActionsModal, setShowBulkActionsModal] = useState(false);
  const [showFormsModal, setShowFormsModal] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);

  // ── More option modal launcher ──────────────────────────────────────────────
  const handleMoreOptionClick = (tab: string) => {
    setShowMore(false);
    const normalized = tab.toLowerCase();
    if (normalized === 'forms') {
      setShowFormsModal(true);
    } else if (normalized === 'docs' || normalized === 'documents') {
      setShowDocumentsModal(true);
    } else if (normalized === 'attachments') {
      setShowAttachmentsModal(true);
    } else if (normalized === 'reports') {
      setShowReportsModal(true);
    } else {
      onTabChange(tab);
    }
  };

  // ── Notify parent when filter changes ────────────────────────────────────────
  const handlePriorityToggle = (value: string) => {
    const next = filterPriorities.includes(value)
      ? filterPriorities.filter(p => p !== value)
      : [...filterPriorities, value];
    setFilterPriorities(next);
    onFilterChange?.({ priorities: next, labels: filterLabels });
  };

  const handleLabelToggle = (label: string) => {
    const next = filterLabels.includes(label)
      ? filterLabels.filter(l => l !== label)
      : [...filterLabels, label];
    setFilterLabels(next);
    onFilterChange?.({ priorities: filterPriorities, labels: next });
  };

  const handleClearFilters = () => {
    setFilterPriorities([]);
    setFilterLabels([]);
    onFilterChange?.({ priorities: [], labels: [] });
    onClearFilters?.();
  };

  const activeFilterCount = filterPriorities.length + filterLabels.length;

  // ── Group change ─────────────────────────────────────────────────────────────
  const handleGroupChange = (value: GroupBy) => {
    setGroupBy(value);
    setShowGroup(false);
    onGroupChange?.(value);
  };

  // ── Share / export helpers ───────────────────────────────────────────────────
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const showToast = (msg: string) => {
    setExportToast(msg);
    setTimeout(() => setExportToast(null), 2000);
  };

  const handleExportCSV = () => {
    downloadFile(issuesToCSV(issues), `${space?.name ?? 'board'}-export.csv`, 'text/csv');
    showToast('CSV exported!');
  };

  const handleExportJSON = () => {
    downloadFile(JSON.stringify(issues, null, 2), `${space?.name ?? 'board'}-export.json`, 'application/json');
    showToast('JSON exported!');
  };

  // ── WIP Limits toggle ────────────────────────────────────────────────────────
  const handleWipToggle = () => {
    const next = !wipEnabled;
    setWipEnabled(next);
    try {
      if (next) {
        const raw = localStorage.getItem('lira_wip_config');
        const parsed = raw ? JSON.parse(raw) : null;
        const limits = parsed?.limits || { todo: 5, inprogress: 3 };
        localStorage.setItem('lira_wip_limits', JSON.stringify(limits));
      } else {
        localStorage.setItem('lira_wip_limits', JSON.stringify({}));
      }
      window.dispatchEvent(new Event('lira_wip_limits_changed'));
    } catch { /* ignore */ }
  };

  // ── Overflow menu actions ────────────────────────────────────────────────────
  const handleBoardSettings = () => {
    setShowOverflow(false);
    setShowBoardSettingsModal(true);
  };

  const handleBulkActions = () => {
    setShowOverflow(false);
    if (onBulkAction) {
      onBulkAction();
    } else {
      setShowBulkActionsModal(true);
    }
  };

  const handleExportViewJSON = () => {
    downloadFile(JSON.stringify(issues, null, 2), `${space?.name ?? 'board'}-view.json`, 'application/json');
    setShowOverflow(false);
  };

  const currentGroupLabel = GROUP_OPTIONS.find(o => o.value === groupBy)?.label ?? 'Status';

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-shrink-0 border-b border-jira-border bg-white">
      {/* Space header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-3">
          {space && (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
              style={{ backgroundColor: space.color + '22', color: space.color }}
            >
              {space.icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-jira-text leading-tight">
                {space?.name || 'Select a space'}
              </h1>
              {isSpaceHidden && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold shadow-2xs">
                  <EyeOff className="w-3 h-3 text-amber-600" />
                  Hidden Space
                </span>
              )}
              {isSpaceArchived && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 font-semibold shadow-2xs">
                  <Archive className="w-3 h-3 text-slate-600" />
                  Archived Space
                </span>
              )}
            </div>
            {space?.description && (
              <p className="text-xs text-jira-muted truncate max-w-xs">{space.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShare(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-jira-text border border-jira-border rounded hover:bg-gray-50 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
          <button className="p-1.5 rounded hover:bg-gray-100 text-jira-muted transition-colors" title="Automations">
            <Zap className="w-4 h-4" />
          </button>
          <button
            onClick={onMaximize}
            className="p-1.5 rounded hover:bg-gray-100 text-jira-muted transition-colors cursor-pointer"
            title="Maximize board"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sub-view tabs */}
      <div className="flex items-center border-b border-jira-border px-4">
        {MAIN_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`
              px-3 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px
              ${activeTab === tab
                ? 'text-jira-blue border-jira-blue'
                : 'text-jira-muted border-transparent hover:text-jira-text hover:border-jira-border'
              }
            `}
          >
            {tab}
          </button>
        ))}
        <div className="relative ml-1" ref={moreRef}>
          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex items-center gap-1 px-3 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              MORE_TABS.includes(activeTab)
                ? 'text-jira-blue border-jira-blue'
                : 'text-jira-muted border-transparent hover:text-jira-text'
            }`}
          >
            More <span className="text-xs text-jira-muted">({MORE_TABS.length})</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {showMore && (
            <div className="absolute top-full left-0 z-20 bg-white border border-jira-border rounded-md shadow-dropdown py-1 min-w-[140px]">
              {MORE_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => handleMoreOptionClick(tab)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-jira-text transition-colors cursor-pointer"
                >
                  {tab}
                </button>
              ))}
              <div className="border-t border-jira-border my-1" />
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-jira-muted">
                Archived work items
              </button>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-jira-muted">
                Shortcuts
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search & filter bar */}
      <div className="flex items-center gap-2 px-4 py-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-jira-muted" />
          <input
            type="text"
            placeholder="Search board"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-jira-border rounded bg-white focus:outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue transition-all w-48"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-jira-muted hover:text-jira-text"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Assignee filter */}
        <button
          onClick={onFilterAssigneeToggle}
          className={`flex items-center gap-1 transition-all rounded-full p-0.5 ${filterAssignee ? 'ring-2 ring-jira-blue ring-offset-1' : 'opacity-70 hover:opacity-100'}`}
          title={filterAssignee ? 'Show all assignees' : 'Filter by me (VY)'}
        >
          <Avatar initials="VY" size="sm" color="#0052CC" />
        </button>

        {/* ── Filter popover ── */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded transition-colors ${
              activeFilterCount > 0
                ? 'border-jira-blue text-jira-blue bg-blue-50 hover:bg-blue-100'
                : 'text-jira-muted border-jira-border hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filter
            {activeFilterCount > 0 && (
              <span className="bg-blue-100 text-blue-700 text-xs rounded-full px-1.5 font-semibold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {showFilter && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-jira-border rounded-xl shadow-lg z-30 p-4 min-w-[280px]">
              {/* Priority section */}
              <p className="text-xs font-semibold text-jira-muted uppercase tracking-wide mb-2">Priority</p>
              {PRIORITIES.map(p => (
                <label
                  key={p.value}
                  className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 cursor-pointer text-sm text-jira-text"
                >
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-jira-blue focus:ring-jira-blue"
                    checked={filterPriorities.includes(p.value)}
                    onChange={() => handlePriorityToggle(p.value)}
                  />
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  {p.label}
                </label>
              ))}

              {/* Label section */}
              {availableLabels.length > 0 && (
                <>
                  <div className="border-t border-jira-border my-3" />
                  <p className="text-xs font-semibold text-jira-muted uppercase tracking-wide mb-2">
                    <Tag className="inline w-3 h-3 mr-1" />
                    Labels
                  </p>
                  {availableLabels.map(label => (
                    <label
                      key={label}
                      className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 cursor-pointer text-sm text-jira-text"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-jira-blue focus:ring-jira-blue"
                        checked={filterLabels.includes(label)}
                        onChange={() => handleLabelToggle(label)}
                      />
                      {label}
                    </label>
                  ))}
                </>
              )}

              {/* Clear filters */}
              <div className="border-t border-jira-border mt-3 pt-3">
                <button
                  onClick={handleClearFilters}
                  className="w-full text-center text-xs font-medium text-jira-muted hover:text-red-500 transition-colors py-1"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Group dropdown ── */}
        <div className="relative" ref={groupRef}>
          <button
            onClick={() => setShowGroup(!showGroup)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-jira-muted border border-jira-border rounded hover:bg-gray-50 transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            Group: {currentGroupLabel}
            <ChevronDown className="w-3 h-3" />
          </button>

          {showGroup && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-jira-border rounded-xl shadow-lg z-30 py-1 min-w-[180px]">
              <p className="text-xs font-semibold text-jira-muted uppercase tracking-wide px-3 pt-2 pb-1">Group by</p>
              {GROUP_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleGroupChange(opt.value)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    groupBy === opt.value
                      ? 'text-jira-blue bg-blue-50 font-medium'
                      : 'text-jira-text hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Overflow / … menu ── */}
        <div className="relative ml-auto" ref={overflowRef}>
          <button
            onClick={() => setShowOverflow(!showOverflow)}
            className="p-1.5 rounded hover:bg-gray-100 text-jira-muted transition-colors"
            title="More options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showOverflow && (
            <div className="absolute top-full right-0 mt-1 bg-white border border-jira-border rounded-xl shadow-lg z-30 py-1 min-w-[220px]">
              {/* Board settings */}
              <button
                onClick={handleBoardSettings}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-jira-text hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-jira-muted" />
                Board settings
              </button>

              {/* Space settings & Edit */}
              {onEditSpace && (
                <button
                  onClick={() => {
                    setShowOverflow(false);
                    onEditSpace();
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-jira-text hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-jira-muted" />
                  Space settings
                </button>
              )}

              {/* Hide / Unhide space */}
              {onToggleHideSpace && (
                <button
                  onClick={() => {
                    setShowOverflow(false);
                    onToggleHideSpace();
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-jira-text hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  {isSpaceHidden ? (
                    <>
                      <Eye className="w-3.5 h-3.5 text-jira-blue" />
                      <span>Unhide space</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-jira-muted" />
                      <span>Hide space</span>
                    </>
                  )}
                </button>
              )}

              {/* Archive / Unarchive space */}
              {onToggleArchiveSpace && (
                <button
                  onClick={() => {
                    setShowOverflow(false);
                    onToggleArchiveSpace();
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-jira-text hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  {isSpaceArchived ? (
                    <>
                      <ArchiveRestore className="w-3.5 h-3.5 text-amber-600" />
                      <span>Unarchive space</span>
                    </>
                  ) : (
                    <>
                      <Archive className="w-3.5 h-3.5 text-jira-muted" />
                      <span>Archive space</span>
                    </>
                  )}
                </button>
              )}

              <div className="border-t border-jira-border my-1" />

              {/* WIP Limits */}
              <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors">
                <button
                  type="button"
                  onClick={() => { setShowOverflow(false); setShowWipLimitsModal(true); }}
                  className="text-sm text-jira-text flex items-center gap-2 text-left hover:text-jira-blue cursor-pointer"
                  title="Configure WIP limits per column"
                >
                  {wipEnabled
                    ? <ToggleRight className="w-3.5 h-3.5 text-jira-blue" />
                    : <ToggleLeft className="w-3.5 h-3.5 text-jira-muted" />
                  }
                  WIP limits: {wipEnabled ? 'ON' : 'OFF'}
                </button>
                <button
                  onClick={handleWipToggle}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${wipEnabled ? 'bg-jira-blue' : 'bg-gray-300'}`}
                  aria-label="Toggle WIP limits"
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${wipEnabled ? 'translate-x-4' : 'translate-x-1'}`}
                  />
                </button>
              </div>

              <div className="border-t border-jira-border my-1" />

              {/* Bulk actions */}
              <button
                onClick={handleBulkActions}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-jira-text hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5 text-jira-muted" />
                Bulk actions
              </button>

              <div className="border-t border-jira-border my-1" />

              {/* Export view to JSON */}
              <button
                onClick={handleExportViewJSON}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-jira-text hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <FileJson className="w-3.5 h-3.5 text-jira-muted" />
                Export view to JSON
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Share Modal ── */}
      <Modal isOpen={showShare} onClose={() => setShowShare(false)} title="Share Board" size="sm">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm text-green-700 font-medium">Space access: Open</span>
          </div>
          <p className="text-sm text-jira-muted">
            Anyone with the link can view this board. Since Lira is offline-first, your data never leaves your device.
          </p>

          {/* Copy link */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-jira-border">
            <span className="text-xs text-jira-muted flex-1 truncate font-mono">{window.location.href}</span>
            <Button variant="primary" size="xs" onClick={handleCopyLink}>
              {copied ? '✓ Copied!' : 'Copy link'}
            </Button>
          </div>

          {/* Exports */}
          <div className="border-t border-jira-border pt-4 space-y-2">
            <p className="text-xs font-semibold text-jira-muted uppercase tracking-wide mb-2">Export</p>
            <button
              onClick={handleExportCSV}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-jira-text border border-jira-border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FileText className="w-4 h-4 text-green-600" />
              Export CSV
              <Download className="w-3.5 h-3.5 ml-auto text-jira-muted" />
            </button>
            <button
              onClick={handleExportJSON}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-jira-text border border-jira-border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FileJson className="w-4 h-4 text-blue-600" />
              Export JSON
              <Download className="w-3.5 h-3.5 ml-auto text-jira-muted" />
            </button>
            {exportToast && (
              <p className="text-xs text-green-600 font-medium text-center py-1 bg-green-50 rounded-lg border border-green-200">
                ✓ {exportToast}
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* ── Space Overflow Modals ── */}
      <BoardSettingsModal
        isOpen={showBoardSettingsModal}
        onClose={() => setShowBoardSettingsModal(false)}
        space={space}
      />
      <WIPLimitsModal
        isOpen={showWipLimitsModal}
        onClose={() => setShowWipLimitsModal(false)}
        space={space}
        onConfigSaved={cfg => setWipEnabled(cfg.enabled)}
      />
      <BulkActionsModal
        isOpen={showBulkActionsModal}
        onClose={() => setShowBulkActionsModal(false)}
        space={space}
        issues={issues}
      />
      <FormsModal
        isOpen={showFormsModal}
        onClose={() => setShowFormsModal(false)}
        space={space}
      />
      <DocumentsModal
        isOpen={showDocumentsModal}
        onClose={() => setShowDocumentsModal(false)}
        space={space}
      />
      <AttachmentsModal
        isOpen={showAttachmentsModal}
        onClose={() => setShowAttachmentsModal(false)}
        space={space}
      />
      <ReportsModal
        isOpen={showReportsModal}
        onClose={() => setShowReportsModal(false)}
        space={space}
        issues={issues}
      />
    </div>
  );
};
