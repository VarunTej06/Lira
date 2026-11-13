import { facetOptions, issuesToCsv, presetCounts, searchIssues } from '../../../utils/issueSearch';
import { useState, useMemo, useEffect, useRef } from 'react';
import type { Issue } from '../../../types/issue';
import type { Space } from '../../../types/space';
import { useClickOutside } from '../../../hooks/useClickOutside';
import { useResetWhen } from '../../../hooks/useResetWhen';

export interface FiltersPageProps {
  issues: Issue[];
  spaces: Space[];
  onSelectIssue: (issue: Issue) => void;
  onSelectSpace?: (spaceId: number) => void;
  onBackToBoard?: () => void;
  initialPreset?: string | null;
  onClearPreset?: () => void;
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
  useResetWhen([initialPreset], () => { if (initialPreset) applyPreset(initialPreset); });
  useEffect(() => { if (initialPreset) onClearPreset?.(); }, [initialPreset, onClearPreset]);

  // Space map for quick lookup
  const spaceMap = useMemo(() => {
    const map: Record<number, Space> = {};
    spaces.forEach(s => { if (s.id) map[s.id] = s; });
    return map;
  }, [spaces]);

  const { labels: allLabels, assignees: allAssignees, teams: allTeams } = useMemo(() => facetOptions(issues), [issues]);

  const counts = useMemo(() => presetCounts(issues), [issues]);

  const filteredIssues = useMemo(() => searchIssues(issues, {
    query: searchQuery, spaces: selectedSpaces, statuses: selectedStatuses, priorities: selectedPriorities, types: selectedTypes,
    assignees: selectedAssignees, labels: selectedLabels, team: selectedTeam, recentOnly: isRecentOnly, sort: sortField, ascending: sortAsc,
  }), [issues, isRecentOnly, searchQuery, selectedSpaces, selectedStatuses, selectedPriorities, selectedTypes, selectedAssignees, selectedTeam, selectedLabels, sortField, sortAsc]);

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
    const blob = new Blob([issuesToCsv(filteredIssues, id => spaceMap[id]?.name || String(id))], { type: 'text/csv;charset=utf-8;' });
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
    presetCounts: counts,
    filteredIssues,
    activeFiltersCount,
    handleExportCSV,
    handleExportJSON,
    toggleSort,
  };
}

export type FiltersState = ReturnType<typeof useFiltersState>;
