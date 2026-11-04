import React, { useState, useMemo } from 'react';
import {
  Search, Filter, X, FileText, FileJson,
  ArrowUpDown
} from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { Avatar } from '../common/Avatar';
import { ISSUE_TYPE_CONFIG } from '../../types/issue';

interface FiltersPageProps {
  issues: Issue[];
  spaces: Space[];
  onSelectIssue: (issue: Issue) => void;
  onBackToBoard?: () => void;
}

export const FiltersPage: React.FC<FiltersPageProps> = ({
  issues,
  spaces,
  onSelectIssue,
  onBackToBoard,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpaces, setSelectedSpaces] = useState<number[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [exportToast, setExportToast] = useState<string | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<'key' | 'title' | 'status' | 'priority' | 'updatedAt'>('updatedAt');
  const [sortAsc, setSortAsc] = useState(false);

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

  // Filter evaluation
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesKey = issue.key.toLowerCase().includes(q);
        const matchesTitle = issue.title.toLowerCase().includes(q);
        const matchesDesc = issue.description?.toLowerCase().includes(q);
        const matchesLabel = issue.labels?.some(l => l.toLowerCase().includes(q));
        if (!matchesKey && !matchesTitle && !matchesDesc && !matchesLabel) return false;
      }

      // Space
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
    issues, searchQuery, selectedSpaces, selectedStatuses, selectedPriorities,
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
    (searchQuery.trim() ? 1 : 0);

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedSpaces([]);
    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setSelectedTypes([]);
    setSelectedAssignees([]);
    setSelectedLabels([]);
    setSelectedTeam('all');
  };

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
      {/* Top Header */}
      <div className="bg-white border-b border-jira-border px-6 py-4 flex-shrink-0 shadow-2xs">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-jira-text">Filters & Work Item Search</h1>
              {activeFiltersCount > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                  {activeFiltersCount} active {activeFiltersCount === 1 ? 'filter' : 'filters'}
                </span>
              )}
            </div>
            <p className="text-xs text-jira-muted mt-0.5">
              Slice, query, and export work items across all spaces, assignees, workflows, and priority tiers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onBackToBoard && (
              <button
                onClick={onBackToBoard}
                className="px-3 py-1.5 text-xs font-semibold text-jira-text border border-jira-border rounded-lg hover:bg-gray-50 transition-colors"
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

        {/* Global Search Bar */}
        <div className="mt-3 relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jira-muted" />
          <input
            type="text"
            placeholder="Search work items by key (AI-18), summary title, description, or label..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50/70 border border-jira-border rounded-lg focus:outline-none focus:bg-white focus:border-jira-blue focus:ring-1 focus:ring-jira-blue transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Multi-Dimensional Filter Bar */}
      <div className="bg-white border-b border-jira-border px-6 py-2.5 flex-shrink-0 flex items-center gap-2 overflow-x-auto text-xs">
        {/* Spaces Filter */}
        <div className="flex items-center gap-1.5 border-r border-jira-border pr-3">
          <span className="font-semibold text-jira-muted uppercase text-[10px]">Space:</span>
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
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {s.icon} {s.name}
              </button>
            );
          })}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 border-r border-jira-border pr-3">
          <span className="font-semibold text-jira-muted uppercase text-[10px]">Status:</span>
          {[
            { id: 'backlog', label: 'Backlog', color: 'bg-slate-100 text-slate-700' },
            { id: 'todo', label: 'To Do', color: 'bg-blue-100 text-blue-700' },
            { id: 'inprogress', label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
            { id: 'done', label: 'Done', color: 'bg-emerald-100 text-emerald-700' },
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
                className={`px-2 py-1 rounded font-medium transition-all ${
                  active ? 'bg-gray-900 text-white ring-1 ring-black' : `${st.color} hover:opacity-80`
                }`}
              >
                {st.label}
              </button>
            );
          })}
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-1.5 border-r border-jira-border pr-3">
          <span className="font-semibold text-jira-muted uppercase text-[10px]">Priority:</span>
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
                className={`px-2 py-1 rounded font-medium transition-all ${
                  active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Assignee Filter */}
        <div className="flex items-center gap-1.5 border-r border-jira-border pr-3">
          <span className="font-semibold text-jira-muted uppercase text-[10px]">Assignee:</span>
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
                className={`flex items-center gap-1 px-2 py-1 rounded font-medium transition-all ${
                  active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Avatar initials={init} size="xs" color={init === 'VY' ? '#0052CC' : '#6B778C'} />
                {init}
              </button>
            );
          })}
        </div>

        {/* Tags / Labels Filter */}
        {allLabels.length > 0 && (
          <div className="flex items-center gap-1.5 border-r border-jira-border pr-3">
            <span className="font-semibold text-jira-muted uppercase text-[10px]">Tags:</span>
            {allLabels.slice(0, 6).map(lbl => {
              const active = selectedLabels.includes(lbl);
              return (
                <button
                  key={lbl}
                  onClick={() => {
                    setSelectedLabels(prev =>
                      active ? prev.filter(x => x !== lbl) : [...prev, lbl]
                    );
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                    active ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  }`}
                >
                  #{lbl}
                </button>
              );
            })}
          </div>
        )}

        {/* Teams Filter */}
        {allTeams.length > 0 && (
          <div className="flex items-center gap-1.5 border-r border-jira-border pr-3">
            <span className="font-semibold text-jira-muted uppercase text-[10px]">Team:</span>
            <select
              value={selectedTeam}
              onChange={e => setSelectedTeam(e.target.value)}
              className="bg-gray-100 text-gray-700 rounded px-2 py-1 text-xs border-0 font-medium"
            >
              <option value="all">All Teams</option>
              {allTeams.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}

        {/* Clear All */}
        {activeFiltersCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 text-red-600 hover:text-red-700 font-semibold px-2 py-1 hover:bg-red-50 rounded transition-colors ml-auto"
          >
            <X className="w-3.5 h-3.5" />
            Reset all
          </button>
        )}
      </div>

      {/* Main Content Area — Results Table */}
      <div className="flex-1 overflow-y-auto p-6">
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
                Try widening your search terms or clearing some of your status and space filters.
              </p>
              <button
                onClick={clearAllFilters}
                className="mt-4 px-4 py-2 bg-jira-blue text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
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
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium"
                            style={{
                              backgroundColor: (space?.color || '#0052CC') + '15',
                              color: space?.color || '#0052CC',
                            }}
                          >
                            <span>{space?.icon || '📁'}</span>
                            <span className="truncate max-w-[100px]">{space?.name || 'Space'}</span>
                          </span>
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
