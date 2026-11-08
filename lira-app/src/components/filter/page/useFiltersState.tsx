import { descriptionToText } from '../../../utils/richText';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Issue } from '../../../types/issue';
import type { Space } from '../../../types/space';

export interface FiltersPageProps {
  issues: Issue[];
  spaces: Space[];
  onSelectIssue: (issue: Issue) => void;
  onSelectSpace?: (spaceId: number) => void;
  onBackToBoard?: () => void;
  initialPreset?: string | null;
  onClearPreset?: () => void;
}

export function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

/** All the state of the Filters page: the chosen filters, the matching tickets, sorting and exporting. */
export function useFiltersState(props: FiltersPageProps) {
  const {
    issues,
    spaces,
    onSelectIssue,
    onSelectSpace,
    onBackToBoard,
    initialPreset,
    onClearPreset,
  } = props;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpaces, setSelectedSpaces] = useState<number[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [activePreset, setActivePreset] = useState<string>('all');
  const [isRecentOnly, setIsRecentOnly] = useState<boolean>(false);
  const [exportToast, setExportToast] = useState<string | null>(null);

  // Dropdown open states for Row 2 facet filters
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useClickOutside(dropdownRef, () => setOpenDropdown(null));

  // Sorting
  const [sortField, setSortField] = useState<'key' | 'title' | 'status' | 'priority' | 'updatedAt'>('updatedAt');
  const [sortAsc, setSortAsc] = useState(false);

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedSpaces([]);
    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setSelectedTypes([]);
    setSelectedAssignees([]);
    setSelectedLabels([]);
    setSelectedTeam('all');
    setIsRecentOnly(false);
    setActivePreset('all');
  };

  // Preset Application Logic
  const applyPreset = (preset: string) => {
    setActivePreset(preset);
    if (preset === 'all') {
      setIsRecentOnly(false);
      clearAllFilters();
    } else if (preset === 'open') {
      setIsRecentOnly(false);
      setSelectedStatuses(['backlog', 'todo', 'inprogress']);
      setSelectedSpaces([]);
      setSelectedPriorities([]);
      setSelectedTypes([]);
      setSelectedAssignees([]);
      setSelectedLabels([]);
      setSelectedTeam('all');
    } else if (preset === 'completed') {
      setIsRecentOnly(false);
      setSelectedStatuses(['done']);
      setSelectedSpaces([]);
      setSelectedPriorities([]);
      setSelectedTypes([]);
      setSelectedAssignees([]);
      setSelectedLabels([]);
      setSelectedTeam('all');
    } else if (preset === 'recent') {
      setIsRecentOnly(true);
      setSelectedStatuses([]);
      setSortField('updatedAt');
      setSortAsc(false);
    }
  };

  // Automatically apply preset when initialPreset prop changes
  useEffect(() => {
    if (initialPreset) {
      applyPreset(initialPreset);
      onClearPreset?.();
    }
  }, [initialPreset, onClearPreset]);

  // Space map for quick lookup
  const spaceMap = useMemo(() => {
    const map: Record<number, Space> = {};
    spaces.forEach(s => { if (s.id) map[s.id] = s; });
    return map;
  }, [spaces]);

  // Derived metadata options
  const allLabels = useMemo(() => {
    const set = new Set<string>();
    issues.forEach(i => i.labels?.forEach(l => set.add(l)));
    return Array.from(set).sort();
  }, [issues]);

  const allAssignees = useMemo(() => {
    const set = new Set<string>();
    issues.forEach(i => {
      if (i.assigneeInitials) set.add(i.assigneeInitials);
      else if (i.assignee) set.add(i.assignee);
    });
    return Array.from(set);
  }, [issues]);

  const allTeams = useMemo(() => {
    const set = new Set<string>();
    issues.forEach(i => { if (i.team) set.add(i.team); });
    return Array.from(set);
  }, [issues]);

  // Preset Counts
  const presetCounts = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      all: issues.length,
      open: issues.filter(i => i.status !== 'done').length,
      completed: issues.filter(i => i.status === 'done').length,
      recent: issues.filter(i => new Date(i.updatedAt || i.createdAt).getTime() >= sevenDaysAgo).length,
    };
  }, [issues]);

  // Filter evaluation
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      // Recent only preset
      if (isRecentOnly) {
        const date = new Date(issue.updatedAt || issue.createdAt).getTime();
        if (date < Date.now() - 7 * 24 * 60 * 60 * 1000) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesKey = issue.key.toLowerCase().includes(q);
        const matchesTitle = issue.title.toLowerCase().includes(q);
        const matchesDesc = descriptionToText(issue.description).toLowerCase().includes(q);
        const matchesLabel = issue.labels?.some(l => l.toLowerCase().includes(q));
        if (!matchesKey && !matchesTitle && !matchesDesc && !matchesLabel) return false;
      }

      // Spaces
      if (selectedSpaces.length > 0 && !selectedSpaces.includes(issue.spaceId)) {
        return false;
      }

      // Status
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(issue.status) && !(issue.blocked && selectedStatuses.includes('blocked'))) {
        return false;
      }

      // Priority
      if (selectedPriorities.length > 0 && !selectedPriorities.includes(issue.priority)) {
        return false;
      }

      // Type
      if (selectedTypes.length > 0 && !selectedTypes.includes(issue.type)) {
        return false;
      }

      // Assignee
      if (selectedAssignees.length > 0) {
        const init = issue.assigneeInitials || issue.assignee || 'UN';
        if (!selectedAssignees.includes(init)) return false;
      }

      // Team
      if (selectedTeam !== 'all') {
        if (issue.team !== selectedTeam) return false;
      }

      // Labels
      if (selectedLabels.length > 0) {
        if (!issue.labels?.some(l => selectedLabels.includes(l))) return false;
      }

      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortField === 'key') comparison = a.key.localeCompare(b.key, undefined, { numeric: true });
      else if (sortField === 'title') comparison = a.title.localeCompare(b.title);
      else if (sortField === 'status') comparison = a.status.localeCompare(b.status);
      else if (sortField === 'priority') {
        const pOrder: Record<string, number> = { highest: 5, high: 4, medium: 3, low: 2, lowest: 1 };
        comparison = (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0);
      } else {
        const dateA = new Date(a.updatedAt || a.createdAt).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt).getTime();
        comparison = dateB - dateA;
      }
      return sortAsc ? -comparison : comparison;
    });
  }, [
    issues, isRecentOnly, searchQuery, selectedSpaces, selectedStatuses, selectedPriorities,
    selectedTypes, selectedAssignees, selectedTeam, selectedLabels, sortField, sortAsc
  ]);

  const activeFiltersCount =
    (selectedSpaces.length > 0 ? 1 : 0) +
    (selectedStatuses.length > 0 ? 1 : 0) +
    (selectedPriorities.length > 0 ? 1 : 0) +
    (selectedTypes.length > 0 ? 1 : 0) +
    (selectedAssignees.length > 0 ? 1 : 0) +
    (selectedLabels.length > 0 ? 1 : 0) +
    (selectedTeam !== 'all' ? 1 : 0) +
    (isRecentOnly ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  const handleExportCSV = () => {
    const headers = ['Key', 'Title', 'Space', 'Type', 'Status', 'Priority', 'Assignee', 'Labels', 'Updated'];
    const rows = filteredIssues.map(i => [
      `"${i.key}"`,
      `"${i.title.replace(/"/g, '""')}"`,
      `"${spaceMap[i.spaceId]?.name || i.spaceId}"`,
      `"${i.type}"`,
      `"${i.status}"`,
      `"${i.priority}"`,
      `"${i.assignee || 'Unassigned'}"`,
      `"${(i.labels || []).join(', ')}"`,
      `"${new Date(i.updatedAt || i.createdAt).toLocaleDateString()}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lira-filtered-issues-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExportToast('Exported CSV');
    setTimeout(() => setExportToast(null), 2500);
  };

  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(filteredIssues, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lira-filtered-issues-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setExportToast('Exported JSON');
    setTimeout(() => setExportToast(null), 2500);
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return {
    issues,
    spaces,
    onSelectIssue,
    onSelectSpace,
    onBackToBoard,
    initialPreset,
    onClearPreset,
    searchQuery,
    setSearchQuery,
    selectedSpaces,
    setSelectedSpaces,
    selectedStatuses,
    setSelectedStatuses,
    selectedPriorities,
    setSelectedPriorities,
    selectedTypes,
    setSelectedTypes,
    selectedAssignees,
    setSelectedAssignees,
    selectedLabels,
    setSelectedLabels,
    selectedTeam,
    setSelectedTeam,
    activePreset,
    setActivePreset,
    isRecentOnly,
    setIsRecentOnly,
    exportToast,
    setExportToast,
    openDropdown,
    setOpenDropdown,
    dropdownRef,
    sortField,
    setSortField,
    sortAsc,
    setSortAsc,
    clearAllFilters,
    applyPreset,
    spaceMap,
    allLabels,
    allAssignees,
    allTeams,
    presetCounts,
    filteredIssues,
    activeFiltersCount,
    handleExportCSV,
    handleExportJSON,
    toggleSort,
  };
}

export type FiltersState = ReturnType<typeof useFiltersState>;
