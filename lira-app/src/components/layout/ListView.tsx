import { issueLink } from '../../utils/links';
import { matchesStatusFilter, type SpaceFilters } from '../../utils/spaceFilters';
import { statusLabel } from '../../utils/status';
import { TypeIcon, PriorityLabel } from '../common/Icons';
import React, { useState, useMemo } from 'react';
import {
  ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
  Search, CheckSquare, Clock
} from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { Avatar } from '../common/Avatar';
import { ISSUE_TYPE_CONFIG } from '../../types/issue';

interface ListViewProps {
  issues: Issue[];
  space: Space | undefined;
  onSelectIssue: (issue: Issue) => void;
  searchQuery?: string;
  activeFilters?: SpaceFilters;
}

type SortField = 'key' | 'title' | 'type' | 'status' | 'priority' | 'assignee' | 'dueDate' | 'createdAt';

const PRIORITY_ORDER: Record<string, number> = {
  highest: 5,
  high: 4,
  medium: 3,
  low: 2,
  lowest: 1,
};

export const ListView: React.FC<ListViewProps> = ({
  issues,
  space,
  onSelectIssue,
  searchQuery = '',
  activeFilters,
}) => {
  const [internalSearch, setInternalSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('key');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  const effectiveSearch = (searchQuery || internalSearch).trim().toLowerCase();

  // Filter issues
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      // Search filter
      if (effectiveSearch) {
        const matchesKey = issue.key.toLowerCase().includes(effectiveSearch);
        const matchesTitle = issue.title.toLowerCase().includes(effectiveSearch);
        const matchesAssignee = (issue.assignee || '').toLowerCase().includes(effectiveSearch);
        if (!matchesKey && !matchesTitle && !matchesAssignee) return false;
      }

      // Priority filter
      if (activeFilters?.priorities && activeFilters.priorities.length > 0) {
        if (!activeFilters.priorities.includes(issue.priority)) return false;
      }

      if (!matchesStatusFilter(issue, activeFilters?.statuses)) return false;

      // Labels filter
      if (activeFilters?.labels && activeFilters.labels.length > 0) {
        const issueLabels = issue.labels || [];
        if (!activeFilters.labels.some(l => issueLabels.includes(l))) return false;
      }

      return true;
    });
  }, [issues, effectiveSearch, activeFilters]);

  // Sort issues
  const sortedIssues = useMemo(() => {
    const list = [...filteredIssues];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'key':
          cmp = a.key.localeCompare(b.key, undefined, { numeric: true });
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'type':
          cmp = a.type.localeCompare(b.type);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'priority':
          cmp = (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0);
          break;
        case 'assignee': {
          const aName = a.assignee || a.assigneeInitials || '';
          const bName = b.assignee || b.assigneeInitials || '';
          cmp = aName.localeCompare(bName);
          break;
        }
        case 'dueDate': {
          const aTime = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          const bTime = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          cmp = aTime - bTime;
          break;
        }
        case 'createdAt': {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          cmp = aTime - bTime;
          break;
        }
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [filteredIssues, sortField, sortAsc]);

  // Pagination
  const totalItems = sortedIssues.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pagedIssues = sortedIssues.slice(startIndex, endIndex);

  const handleToggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(prev => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setPage(1);
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortAsc ? (
      <ArrowUp className="w-3.5 h-3.5 text-lira-blue" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-lira-blue" />
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'inprogress':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'todo':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'highest':
      case 'high':
      case 'medium':
      case 'low':
      case 'lowest':
        return <PriorityLabel priority={priority} />;
      default:
        return <span className="text-gray-500 capitalize">{priority}</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      {/* Top action / search bar if no global search provided */}
      {!searchQuery && (
        <div className="p-3 border-b border-gray-200 flex items-center justify-between gap-4 bg-gray-50/50">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter list by key, title, assignee..."
              value={internalSearch}
              onChange={e => {
                setInternalSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lira-blue focus:border-lira-blue"
            />
          </div>
          <div className="text-xs text-gray-500 font-medium">
            {totalItems} {totalItems === 1 ? 'issue' : 'issues'} {space ? `in ${space.name}` : ''}
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-[#F4F5F7] sticky top-0 z-10 border-b border-gray-300">
            <tr>
              <th
                onClick={() => handleToggleSort('type')}
                className="py-2.5 px-3 font-semibold text-gray-700 cursor-pointer select-none group w-12 text-center"
                title="Sort by type"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Type</span>
                  {renderSortIndicator('type')}
                </div>
              </th>
              <th
                onClick={() => handleToggleSort('key')}
                className="py-2.5 px-3 font-semibold text-gray-700 cursor-pointer select-none group w-28"
                title="Sort by key"
              >
                <div className="flex items-center gap-1">
                  <span>Key</span>
                  {renderSortIndicator('key')}
                </div>
              </th>
              <th
                onClick={() => handleToggleSort('title')}
                className="py-2.5 px-3 font-semibold text-gray-700 cursor-pointer select-none group min-w-[200px]"
                title="Sort by title"
              >
                <div className="flex items-center gap-1">
                  <span>Title</span>
                  {renderSortIndicator('title')}
                </div>
              </th>
              <th
                onClick={() => handleToggleSort('status')}
                className="py-2.5 px-3 font-semibold text-gray-700 cursor-pointer select-none group w-28"
                title="Sort by status"
              >
                <div className="flex items-center gap-1">
                  <span>Status</span>
                  {renderSortIndicator('status')}
                </div>
              </th>
              <th
                onClick={() => handleToggleSort('priority')}
                className="py-2.5 px-3 font-semibold text-gray-700 cursor-pointer select-none group w-28"
                title="Sort by priority"
              >
                <div className="flex items-center gap-1">
                  <span>Priority</span>
                  {renderSortIndicator('priority')}
                </div>
              </th>
              <th
                onClick={() => handleToggleSort('assignee')}
                className="py-2.5 px-3 font-semibold text-gray-700 cursor-pointer select-none group w-36"
                title="Sort by assignee"
              >
                <div className="flex items-center gap-1">
                  <span>Assignee</span>
                  {renderSortIndicator('assignee')}
                </div>
              </th>
              <th
                onClick={() => handleToggleSort('dueDate')}
                className="py-2.5 px-3 font-semibold text-gray-700 cursor-pointer select-none group w-32"
                title="Sort by due date"
              >
                <div className="flex items-center gap-1">
                  <span>Due Date</span>
                  {renderSortIndicator('dueDate')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {pagedIssues.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <CheckSquare className="w-8 h-8 text-gray-300" />
                    <p className="text-sm font-medium text-gray-600">No issues found</p>
                    <p className="text-xs text-gray-400">
                      {effectiveSearch ? 'Try adjusting your search criteria' : 'Create an issue to get started'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              pagedIssues.map(issue => {
                const typeConfig = ISSUE_TYPE_CONFIG[issue.type] || { label: issue.type, color: '#6B778C', bg: '#F4F5F7' };
                return (
                  <tr
                    key={issue.id || issue.key}
                    onClick={() => onSelectIssue(issue)} {...issueLink(issue)}
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 px-3 text-center text-sm">
                      <span title={typeConfig.label} className="inline-flex"><TypeIcon type={issue.type} className="w-4 h-4" /></span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-lira-blue group-hover:underline whitespace-nowrap">
                      {issue.key}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-gray-900 group-hover:text-lira-blue transition-colors line-clamp-1">
                        {issue.title}
                      </div>
                      {issue.labels && issue.labels.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          {issue.labels.slice(0, 3).map(l => (
                            <span key={l} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-mono">
                              #{l}
                            </span>
                          ))}
                          {issue.labels.length > 3 && (
                            <span className="text-[10px] text-gray-400">+{issue.labels.length - 3}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border capitalize ${getStatusBadge(issue.status)}`}>
                        {statusLabel(issue.status)}
                      </span>
                      {issue.blocked && <span className="ml-1 inline-block px-2 py-0.5 rounded text-[11px] font-semibold border bg-red-100 text-red-800 border-red-200">Blocked</span>}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {getPriorityBadge(issue.priority)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Avatar
                          initials={issue.assigneeInitials || (issue.assignee ? issue.assignee.slice(0, 2).toUpperCase() : 'UN')}
                          size="xs"
                        />
                        <span className="truncate max-w-[100px] text-gray-700">
                          {issue.assignee || 'Unassigned'}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-gray-600">
                      {issue.dueDate ? (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {new Date(issue.dueDate).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">None</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-4 text-xs select-none">
        <div className="flex items-center gap-2 text-gray-600">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="border border-gray-300 rounded px-2 py-1 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-lira-blue cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span className="ml-2 text-gray-500">
            {totalItems > 0 ? (
              <>Showing <span className="font-semibold text-gray-800">{startIndex + 1}</span>–<span className="font-semibold text-gray-800">{endIndex}</span> of <span className="font-semibold text-gray-800">{totalItems}</span></>
            ) : (
              '0 issues'
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer text-gray-700"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </button>
          <span className="px-2 text-gray-600 font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer text-gray-700"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
