import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search, Filter, X, FileText, FileJson,
  ArrowUpDown, ChevronDown, Check, Clock, CheckCircle2,
  Zap, Tag, Layers, User as UserIcon
} from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { Avatar } from '../common/Avatar';
import { ISSUE_TYPE_CONFIG } from '../../types/issue';

interface FiltersPageProps {
  issues: Issue[];
  spaces: Space[];
  onSelectIssue: (issue: Issue) => void;
  onSelectSpace?: (spaceId: number) => void;
  onBackToBoard?: () => void;
  initialPreset?: string | null;
  onClearPreset?: () => void;
}

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

export const FiltersPage: React.FC<FiltersPageProps> = ({
  issues,
  spaces,
  onSelectIssue,
  onSelectSpace,
  onBackToBoard,
  initialPreset,
  onClearPreset,
}) => {
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
        const matchesDesc = issue.description?.toLowerCase().includes(q);
        const matchesLabel = issue.labels?.some(l => l.toLowerCase().includes(q));
        if (!matchesKey && !matchesTitle && !matchesDesc && !matchesLabel) return false;
      }

      // Spaces
      if (selectedSpaces.length > 0 && !selectedSpaces.includes(issue.spaceId)) {
        return false;
      }

      // Status
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(issue.status)) {
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
      {/* ── Top Header ── */}
      <div className="bg-white border-b border-jira-border px-6 py-3.5 flex-shrink-0 shadow-2xs">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-jira-text">Filters &amp; Search Explorer</h1>
              {activeFiltersCount > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2.5 py-0.5 rounded-full">
                  {activeFiltersCount} active {activeFiltersCount === 1 ? 'filter' : 'filters'}
                </span>
              )}
            </div>
            <p className="text-xs text-jira-muted mt-0.5">
              Query, facet, and export work items across spaces, assignees, workflows, and priority tiers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onBackToBoard && (
              <button
                onClick={onBackToBoard}
                className="px-3 py-1.5 text-xs font-semibold text-jira-text border border-jira-border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                ← Back to Board
              </button>
            )}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-jira-text border border-jira-border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              title="Download results as CSV"
            >
              <FileText className="w-3.5 h-3.5 text-green-600" />
              Export CSV
            </button>
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-jira-text border border-jira-border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              title="Download results as JSON"
            >
              <FileJson className="w-3.5 h-3.5 text-blue-600" />
              Export JSON
            </button>
          </div>
        </div>

        {exportToast && (
          <div className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-md inline-block font-medium">
            ✓ {exportToast}
          </div>
        )}
      </div>

      {/* ── Redesigned Responsive Two-Row Filter Layout (Tailwind Grid) ── */}
      <div className="px-6 pt-4 pb-2 flex-shrink-0" ref={dropdownRef}>
        <div className="bg-white border border-jira-border rounded-xl shadow-xs overflow-visible">
          {/* ── ROW 1: Search & Preset Pills (Tailwind Grid) ── */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-3.5 border-b border-jira-border">
            {/* Search Input */}
            <div className="md:col-span-5 lg:col-span-5 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jira-muted" />
              <input
                type="text"
                placeholder="Search key (AI-18), title, description, or label…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-gray-50/70 border border-jira-border rounded-lg focus:outline-none focus:bg-white focus:border-jira-blue focus:ring-1 focus:ring-jira-blue transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Preset Filter Segmented Pills */}
            <div className="md:col-span-5 lg:col-span-5 flex items-center gap-1.5 overflow-x-auto py-0.5">
              {[
                { id: 'all', label: 'All Issues', count: presetCounts.all, icon: <Filter className="w-3 h-3" /> },
                { id: 'open', label: 'Open Issues', count: presetCounts.open, icon: <Clock className="w-3 h-3" /> },
                { id: 'completed', label: 'Completed', count: presetCounts.completed, icon: <CheckCircle2 className="w-3 h-3" /> },
                { id: 'recent', label: 'Recently Updated', count: presetCounts.recent, icon: <Zap className="w-3 h-3" /> },
              ].map(preset => {
                const isActive = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-jira-blue text-white shadow-xs'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {preset.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Counter & Quick Reset */}
            <div className="md:col-span-2 lg:col-span-2 flex items-center justify-end gap-2 text-xs">
              <span className="text-jira-muted text-[11px] whitespace-nowrap">
                <strong className="text-jira-text font-bold">{filteredIssues.length}</strong> of {issues.length}
              </span>
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 text-red-600 hover:text-red-700 font-semibold px-2 py-1 hover:bg-red-50 rounded transition-colors cursor-pointer text-xs"
                >
                  <X className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* ── ROW 2: Facet Dropdowns (Tailwind Grid) ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 p-3 bg-gray-50/70 text-xs">
            {/* 1. Space Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'space' ? null : 'space')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedSpaces.length > 0
                    ? 'bg-blue-50/60 border-jira-blue text-jira-blue font-semibold'
                    : 'bg-white border-jira-border text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <Layers className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                  <span className="truncate">
                    {selectedSpaces.length === 0
                      ? 'Space: All'
                      : selectedSpaces.length === 1
                      ? spaceMap[selectedSpaces[0]]?.name || '1 Space'
                      : `${selectedSpaces.length} Spaces`}
                  </span>
                </span>
                <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
              </button>

              {openDropdown === 'space' && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-jira-border rounded-xl shadow-xl z-50 p-2 space-y-1 animate-scale-in max-h-56 overflow-y-auto">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">Filter by Space</div>
                  {spaces.map(s => {
                    const active = selectedSpaces.includes(s.id!);
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedSpaces(prev =>
                            active ? prev.filter(id => id !== s.id) : [...prev, s.id!]
                          );
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                          active ? 'bg-blue-50 text-jira-blue font-semibold' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span>{s.icon}</span>
                          <span className="truncate">{s.name}</span>
                        </span>
                        {active && <Check className="w-3.5 h-3.5 text-jira-blue" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Status Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedStatuses.length > 0
                    ? 'bg-blue-50/60 border-jira-blue text-jira-blue font-semibold'
                    : 'bg-white border-jira-border text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                  <span className="truncate">
                    {selectedStatuses.length === 0
                      ? 'Status: All'
                      : selectedStatuses.length === 1
                      ? selectedStatuses[0].toUpperCase()
                      : `${selectedStatuses.length} Statuses`}
                  </span>
                </span>
                <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
              </button>

              {openDropdown === 'status' && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-jira-border rounded-xl shadow-xl z-50 p-2 space-y-1 animate-scale-in">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">Filter by Status</div>
                  {[
                    { id: 'backlog', label: 'Backlog', color: 'bg-slate-100 text-slate-800' },
                    { id: 'todo', label: 'To Do', color: 'bg-blue-100 text-blue-800' },
                    { id: 'inprogress', label: 'In Progress', color: 'bg-amber-100 text-amber-800' },
                    { id: 'done', label: 'Done', color: 'bg-emerald-100 text-emerald-800' },
                  ].map(st => {
                    const active = selectedStatuses.includes(st.id);
                    return (
                      <button
                        key={st.id}
                        onClick={() => {
                          setSelectedStatuses(prev =>
                            active ? prev.filter(x => x !== st.id) : [...prev, st.id]
                          );
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                          active ? 'bg-blue-50 text-jira-blue font-semibold' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${st.color}`}>
                            {st.label}
                          </span>
                        </span>
                        {active && <Check className="w-3.5 h-3.5 text-jira-blue" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Priority Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedPriorities.length > 0
                    ? 'bg-blue-50/60 border-jira-blue text-jira-blue font-semibold'
                    : 'bg-white border-jira-border text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <span className="truncate">
                    {selectedPriorities.length === 0
                      ? 'Priority: All'
                      : `${selectedPriorities.length} Selected`}
                  </span>
                </span>
                <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
              </button>

              {openDropdown === 'priority' && (
                <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-jira-border rounded-xl shadow-xl z-50 p-2 space-y-1 animate-scale-in">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">Priority Tier</div>
                  {[
                    { id: 'highest', label: '🔴 Highest' },
                    { id: 'high', label: '🟠 High' },
                    { id: 'medium', label: '🟡 Medium' },
                    { id: 'low', label: '🟢 Low' },
                    { id: 'lowest', label: '⚪ Lowest' },
                  ].map(p => {
                    const active = selectedPriorities.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedPriorities(prev =>
                            active ? prev.filter(x => x !== p.id) : [...prev, p.id]
                          );
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                          active ? 'bg-blue-50 text-jira-blue font-semibold' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span>{p.label}</span>
                        {active && <Check className="w-3.5 h-3.5 text-jira-blue" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Issue Type Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedTypes.length > 0
                    ? 'bg-blue-50/60 border-jira-blue text-jira-blue font-semibold'
                    : 'bg-white border-jira-border text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <span className="truncate">
                    {selectedTypes.length === 0
                      ? 'Type: All'
                      : `${selectedTypes.length} Types`}
                  </span>
                </span>
                <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
              </button>

              {openDropdown === 'type' && (
                <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-jira-border rounded-xl shadow-xl z-50 p-2 space-y-1 animate-scale-in">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">Work Item Type</div>
                  {[
                    { id: 'epic', label: '⚡ Epic' },
                    { id: 'task', label: '✅ Task' },
                    { id: 'bug', label: '🐛 Bug' },
                    { id: 'subtask', label: '↳ Subtask' },
                  ].map(t => {
                    const active = selectedTypes.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setSelectedTypes(prev =>
                            active ? prev.filter(x => x !== t.id) : [...prev, t.id]
                          );
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                          active ? 'bg-blue-50 text-jira-blue font-semibold' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span>{t.label}</span>
                        {active && <Check className="w-3.5 h-3.5 text-jira-blue" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 5. Assignee Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'assignee' ? null : 'assignee')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedAssignees.length > 0
                    ? 'bg-blue-50/60 border-jira-blue text-jira-blue font-semibold'
                    : 'bg-white border-jira-border text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <UserIcon className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                  <span className="truncate">
                    {selectedAssignees.length === 0
                      ? 'Assignee: All'
                      : `${selectedAssignees.length} Assignees`}
                  </span>
                </span>
                <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
              </button>

              {openDropdown === 'assignee' && (
                <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-jira-border rounded-xl shadow-xl z-50 p-2 space-y-1 animate-scale-in max-h-56 overflow-y-auto">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">Assignee</div>
                  {allAssignees.map(init => {
                    const active = selectedAssignees.includes(init);
                    return (
                      <button
                        key={init}
                        onClick={() => {
                          setSelectedAssignees(prev =>
                            active ? prev.filter(x => x !== init) : [...prev, init]
                          );
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                          active ? 'bg-blue-50 text-jira-blue font-semibold' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar initials={init} size="xs" color={init === 'VY' ? '#0052CC' : '#6B778C'} />
                          <span>{init === 'VY' ? 'Varun Tej (VY)' : init}</span>
                        </div>
                        {active && <Check className="w-3.5 h-3.5 text-jira-blue" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 6. Tags & Teams Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'tags' ? null : 'tags')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedLabels.length > 0 || selectedTeam !== 'all'
                    ? 'bg-blue-50/60 border-jira-blue text-jira-blue font-semibold'
                    : 'bg-white border-jira-border text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <Tag className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                  <span className="truncate">
                    {selectedLabels.length === 0 && selectedTeam === 'all'
                      ? 'Tags & Team'
                      : `${selectedLabels.length + (selectedTeam !== 'all' ? 1 : 0)} Active`}
                  </span>
                </span>
                <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
              </button>

              {openDropdown === 'tags' && (
                <div className="absolute right-0 top-full mt-1 w-60 bg-white border border-jira-border rounded-xl shadow-xl z-50 p-2.5 space-y-2.5 animate-scale-in max-h-64 overflow-y-auto">
                  {/* Team Filter */}
                  {allTeams.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Team Filter</div>
                      <select
                        value={selectedTeam}
                        onChange={e => setSelectedTeam(e.target.value)}
                        className="w-full bg-gray-50 text-gray-700 rounded-lg p-1.5 text-xs border border-gray-200"
                      >
                        <option value="all">All Teams</option>
                        {allTeams.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Labels Filter */}
                  {allLabels.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Labels / Tags</div>
                      <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                        {allLabels.map(lbl => {
                          const active = selectedLabels.includes(lbl);
                          return (
                            <button
                              key={lbl}
                              type="button"
                              onClick={() => {
                                setSelectedLabels(prev =>
                                  active ? prev.filter(x => x !== lbl) : [...prev, lbl]
                                );
                              }}
                              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                                active ? 'bg-indigo-600 text-white font-bold' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                              }`}
                            >
                              #{lbl}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Filters Removable Chips */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-2.5 px-1">
            <span className="text-[11px] text-jira-muted font-medium">Applied:</span>

            {isRecentOnly && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-[11px] font-medium">
                <Zap className="w-3 h-3 text-amber-600" />
                Updated in last 7 days
                <button onClick={() => setIsRecentOnly(false)} className="hover:text-amber-950 ml-0.5">×</button>
              </span>
            )}

            {selectedSpaces.map(id => (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-md text-[11px] font-medium"
              >
                <button
                  type="button"
                  onClick={() => onSelectSpace?.(id)}
                  className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                  title={`Open ${spaceMap[id]?.name || id} board`}
                >
                  <span>{spaceMap[id]?.icon || '📁'}</span>
                  <span>{spaceMap[id]?.name || id}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSpaces(prev => prev.filter(x => x !== id));
                  }}
                  className="hover:text-blue-950 ml-0.5 text-blue-500 font-bold cursor-pointer"
                  title="Remove filter"
                >
                  ×
                </button>
              </span>
            ))}

            {selectedStatuses.map(st => (
              <span key={st} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-800 border border-gray-300 rounded-md text-[11px] font-medium capitalize">
                Status: {st}
                <button onClick={() => setSelectedStatuses(prev => prev.filter(x => x !== st))} className="hover:text-black ml-0.5">×</button>
              </span>
            ))}

            {selectedPriorities.map(p => (
              <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-800 border border-orange-200 rounded-md text-[11px] font-medium capitalize">
                Priority: {p}
                <button onClick={() => setSelectedPriorities(prev => prev.filter(x => x !== p))} className="hover:text-orange-950 ml-0.5">×</button>
              </span>
            ))}

            {selectedTypes.map(t => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded-md text-[11px] font-medium capitalize">
                Type: {t}
                <button onClick={() => setSelectedTypes(prev => prev.filter(x => x !== t))} className="hover:text-purple-950 ml-0.5">×</button>
              </span>
            ))}

            {selectedAssignees.map(a => (
              <span key={a} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[11px] font-medium">
                Assignee: {a}
                <button onClick={() => setSelectedAssignees(prev => prev.filter(x => x !== a))} className="hover:text-emerald-950 ml-0.5">×</button>
              </span>
            ))}

            {selectedLabels.map(l => (
              <span key={l} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-md text-[11px] font-mono">
                #{l}
                <button onClick={() => setSelectedLabels(prev => prev.filter(x => x !== l))} className="hover:text-indigo-950 ml-0.5">×</button>
              </span>
            ))}

            {selectedTeam !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-md text-[11px] font-medium">
                Team: {selectedTeam}
                <button onClick={() => setSelectedTeam('all')} className="hover:text-teal-950 ml-0.5">×</button>
              </span>
            )}

            <button
              onClick={clearAllFilters}
              className="text-[11px] text-jira-blue hover:underline ml-1 cursor-pointer font-medium"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ── Main Results Table ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="bg-white border border-jira-border rounded-xl shadow-xs overflow-hidden">
          {/* Table Header Bar */}
          <div className="bg-gray-50 border-b border-jira-border px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-jira-muted">
            <span>
              Showing <strong className="text-jira-text">{filteredIssues.length}</strong> of{' '}
              {issues.length} work items
            </span>
            <span className="text-gray-400">Click any ticket to open details</span>
          </div>

          {filteredIssues.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Filter className="w-8 h-8 text-jira-muted mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-jira-text">No work items matched your filters</p>
              <p className="text-xs text-jira-muted mt-1 max-w-sm mx-auto">
                Try widening your search terms or clearing some of your status, priority, or space filters.
              </p>
              <button
                onClick={clearAllFilters}
                className="mt-4 px-4 py-2 bg-jira-blue text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Reset all filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-jira-border bg-gray-50/60 text-jira-muted uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4 w-12">Type</th>
                    <th
                      onClick={() => toggleSort('key')}
                      className="py-2.5 px-4 w-28 cursor-pointer hover:text-jira-text"
                    >
                      <span className="flex items-center gap-1">
                        Key <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th
                      onClick={() => toggleSort('title')}
                      className="py-2.5 px-4 cursor-pointer hover:text-jira-text"
                    >
                      <span className="flex items-center gap-1">
                        Summary <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th className="py-2.5 px-4 w-36">Space</th>
                    <th
                      onClick={() => toggleSort('status')}
                      className="py-2.5 px-4 w-28 cursor-pointer hover:text-jira-text"
                    >
                      <span className="flex items-center gap-1">
                        Status <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th
                      onClick={() => toggleSort('priority')}
                      className="py-2.5 px-4 w-24 cursor-pointer hover:text-jira-text"
                    >
                      <span className="flex items-center gap-1">
                        Priority <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th className="py-2.5 px-4 w-28">Assignee</th>
                    <th
                      onClick={() => toggleSort('updatedAt')}
                      className="py-2.5 px-4 w-28 cursor-pointer hover:text-jira-text text-right"
                    >
                      <span className="flex items-center justify-end gap-1">
                        Updated <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredIssues.map(issue => {
                    const space = spaceMap[issue.spaceId];
                    const typeConfig = ISSUE_TYPE_CONFIG[issue.type] || { symbol: '📋', label: issue.type };

                    return (
                      <tr
                        key={issue.key}
                        onClick={() => onSelectIssue(issue)}
                        className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-4 text-center font-bold text-sm">
                          {typeConfig.symbol}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-jira-blue group-hover:underline">
                          {issue.key}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-jira-text leading-snug group-hover:text-jira-blue transition-colors">
                            {issue.title}
                          </div>
                          {issue.labels && issue.labels.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {issue.labels.slice(0, 3).map(l => (
                                <span
                                  key={l}
                                  className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-mono"
                                >
                                  #{l}
                                </span>
                              ))}
                              {issue.labels.length > 3 && (
                                <span className="text-[9px] text-gray-400">
                                  +{issue.labels.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (issue.spaceId && onSelectSpace) {
                                onSelectSpace(issue.spaceId);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium hover:opacity-80 hover:ring-1 hover:ring-blue-300 transition-all cursor-pointer text-left"
                            style={{
                              backgroundColor: (space?.color || '#0052CC') + '15',
                              color: space?.color || '#0052CC',
                            }}
                            title={`Open ${space?.name || 'Space'} board`}
                          >
                            <span>{space?.icon || '📁'}</span>
                            <span className="truncate max-w-[100px]">{space?.name || 'Space'}</span>
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              issue.status === 'done'
                                ? 'bg-emerald-100 text-emerald-700'
                                : issue.status === 'inprogress'
                                ? 'bg-amber-100 text-amber-700'
                                : issue.status === 'todo'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {issue.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 capitalize font-medium text-gray-600">
                          {issue.priority === 'highest' && '🔴 Highest'}
                          {issue.priority === 'high' && '🟠 High'}
                          {issue.priority === 'medium' && '🟡 Medium'}
                          {issue.priority === 'low' && '🟢 Low'}
                          {issue.priority === 'lowest' && '⚪ Lowest'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <Avatar
                              initials={issue.assigneeInitials || (issue.assignee ? issue.assignee.slice(0, 2) : 'UN')}
                              size="xs"
                              color={issue.assigneeInitials === 'VY' ? '#0052CC' : '#6B778C'}
                            />
                            <span className="truncate max-w-[80px] text-jira-text font-medium">
                              {issue.assignee || 'Unassigned'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-400 font-mono text-[11px]">
                          {new Date(issue.updatedAt || issue.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
