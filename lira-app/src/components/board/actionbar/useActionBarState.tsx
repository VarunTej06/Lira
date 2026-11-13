import type { SpaceFilters } from '../../../utils/spaceFilters';
import { useState, useRef } from 'react';
import type { Space } from '../../../types/space';
import type { Issue } from '../../../types/issue';
import { useClickOutside } from '../../../hooks/useClickOutside';
import { downloadFile } from '../../../utils/download';
import type { GroupBy } from '../boardColumns';
import { useBoardFilters } from './useBoardFilters';
import { PALETTE } from '../../../theme/palette';
import { appStorage } from '../../../utils/appStorage';

// ─── Types ───────────────────────────────────────────────────────────────────

export type { GroupBy };

export interface BoardActionBarProps {
  space: Space | undefined;
  issues?: Issue[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterAssignee: boolean;
  onFilterAssigneeToggle: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onFilterChange?: (filters: SpaceFilters) => void;
  onGroupChange?: (groupBy: GroupBy) => void;
  onClearFilters?: () => void;
  availableLabels?: string[];
  onBulkAction?: () => void;
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
  { label: 'High',    value: 'high',    color: PALETTE.danger },
  { label: 'Medium',  value: 'medium',  color: PALETTE.orangeDeep },
  { label: 'Low',     value: 'low',     color: PALETTE.success },
  { label: 'Lowest',  value: 'lowest',  color: PALETTE.info },
];

export const GROUP_OPTIONS: { label: string; value: GroupBy }[] = [
  { label: 'Status',       value: 'status'   },
  { label: 'Assignee',     value: 'assignee' },
  { label: 'Priority',     value: 'priority' },
  { label: 'Epic / Parent',value: 'epic'     },
];

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

  const filters = useBoardFilters(onFilterChange, onClearFilters);

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
      const raw = appStorage.get('lira_wip_limits');
      if (!raw) return false;
      if (raw === 'true') return true;
      if (raw.startsWith('{')) {
        const obj = JSON.parse(raw);
        return Object.values(obj).some((v: unknown) => typeof v === 'number' && v > 0);
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

  const activeFilterCount = filters.activeCount;

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
        const raw = appStorage.get('lira_wip_config');
        const parsed = raw ? JSON.parse(raw) : null;
        const limits = parsed?.limits || { todo: 5, inprogress: 3 };
        appStorage.set('lira_wip_limits', JSON.stringify(limits));
      } else {
        appStorage.set('lira_wip_limits', JSON.stringify({}));
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
    filterPriorities: filters.priorities,
    filterLabels: filters.labels,
    filterStatuses: filters.statuses,
    handleStatusToggle: (v: string) => filters.toggle('statuses', v),
    handlePriorityToggle: (v: string) => filters.toggle('priorities', v),
    handleLabelToggle: (v: string) => filters.toggle('labels', v),
    handleClearFilters: filters.clearAll,
    handleClearGroup: filters.clearGroup,
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
