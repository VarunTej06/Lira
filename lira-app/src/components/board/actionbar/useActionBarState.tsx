import React, { useState, useRef, useEffect } from 'react';
import type { Space } from '../../../types/space';
import type { Issue } from '../../../types/issue';

// ─── Types ───────────────────────────────────────────────────────────────────

export type GroupBy = 'status' | 'assignee' | 'priority' | 'epic';

export interface BoardActionBarProps {
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

export const MAIN_TABS = ['Summary', 'Board', 'List', 'Calendar', 'Sprints', 'Capacity'];
export const MORE_TABS = ['Forms', 'Documents', 'Attachments', 'Reports'];

export const PRIORITIES: { label: string; value: string; color: string }[] = [
  { label: 'Highest', value: 'highest', color: '#FF0000' },
  { label: 'High',    value: 'high',    color: '#FF5630' },
  { label: 'Medium',  value: 'medium',  color: '#FF8B00' },
  { label: 'Low',     value: 'low',     color: '#36B37E' },
  { label: 'Lowest',  value: 'lowest',  color: '#00B8D9' },
];

export const GROUP_OPTIONS: { label: string; value: GroupBy }[] = [
  { label: 'Status',       value: 'status'   },
  { label: 'Assignee',     value: 'assignee' },
  { label: 'Priority',     value: 'priority' },
  { label: 'Epic / Parent',value: 'epic'     },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handler();
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function issuesToCSV(issues: Issue[]): string {
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

/** All the state of the space header: menus, filters, sharing and the modals opened from the ... menu. */
export function useActionBarState(props: BoardActionBarProps) {
  const {
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
  } = props;
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

  return {
    space,
    issues,
    searchQuery,
    onSearchChange,
    filterAssignee,
    onFilterAssigneeToggle,
    activeTab,
    onTabChange,
    onFilterChange,
    onGroupChange,
    onClearFilters,
    availableLabels,
    onBulkAction,
    onMaximize,
    isSpaceHidden,
    isSpaceArchived,
    onToggleHideSpace,
    onToggleArchiveSpace,
    onEditSpace,
    showShare,
    setShowShare,
    copied,
    setCopied,
    exportToast,
    setExportToast,
    showMore,
    setShowMore,
    moreRef,
    showFilter,
    setShowFilter,
    filterPriorities,
    setFilterPriorities,
    filterLabels,
    setFilterLabels,
    filterRef,
    groupBy,
    setGroupBy,
    showGroup,
    setShowGroup,
    groupRef,
    showOverflow,
    setShowOverflow,
    overflowRef,
    wipEnabled,
    setWipEnabled,
    showBoardSettingsModal,
    setShowBoardSettingsModal,
    showWipLimitsModal,
    setShowWipLimitsModal,
    showBulkActionsModal,
    setShowBulkActionsModal,
    showFormsModal,
    setShowFormsModal,
    showDocumentsModal,
    setShowDocumentsModal,
    showAttachmentsModal,
    setShowAttachmentsModal,
    showReportsModal,
    setShowReportsModal,
    handleMoreOptionClick,
    handlePriorityToggle,
    handleLabelToggle,
    handleClearFilters,
    activeFilterCount,
    handleGroupChange,
    handleCopyLink,
    showToast,
    handleExportCSV,
    handleExportJSON,
    handleWipToggle,
    handleBoardSettings,
    handleBulkActions,
    handleExportViewJSON,
    currentGroupLabel,
  };
}

export type ActionBarState = ReturnType<typeof useActionBarState>;
