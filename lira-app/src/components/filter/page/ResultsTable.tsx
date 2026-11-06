import { Filter, ArrowUpDown } from 'lucide-react';
import type {  } from '../../../types/space';
import { Avatar } from '../../common/Avatar';
import { ISSUE_TYPE_CONFIG } from '../../../types/issue';
import type { FiltersState } from './useFiltersState';

/** The matching tickets. */
export function ResultsTable(s: FiltersState) {
  const { issues, onSelectIssue, onSelectSpace, clearAllFilters, spaceMap, filteredIssues, toggleSort } = s;
  return (
    <>
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
    </>
  );
}
