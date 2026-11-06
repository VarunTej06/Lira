import { KanbanSquare, Settings, Plus, Layers, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { Button } from '../../common/Button';
import { ISSUE_TYPE_CONFIG } from '../../../types/issue';
import { formatRelativeDate } from '../../../utils/dateUtils';
import { getStatusBadgeClass } from './badges';
import type { DetailCtx } from './types';

export function OverviewTab(ctx: DetailCtx) {
  const { onIssueClick, onAddIssue, stats, priorityCounts, recentIssues, setActiveTab } = ctx;
  return (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
            {/* Quick Actions Row */}
            <div className="bg-white rounded-xl border border-jira-border p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-jira-muted">Project Workspace Actions</h3>
                <p className="text-xs text-jira-text mt-0.5">Jump directly to issue authoring, Kanban execution, or project schema settings.</p>
              </div>
              <div className="flex items-center gap-2.5">
                {onAddIssue && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onAddIssue('todo')}
                    icon={<Plus className="w-4 h-4" />}
                  >
                    Create Issue
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveTab('board')}
                  icon={<KanbanSquare className="w-4 h-4" />}
                >
                  View Board
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('settings')}
                  icon={<Settings className="w-4 h-4" />}
                >
                  Open Settings
                </Button>
              </div>
            </div>

            {/* At-a-Glance Metrics Row (4 Stat Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Stat 1: Total Issues */}
              <div className="bg-white rounded-xl border border-jira-border p-5 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-jira-muted uppercase tracking-wider">Total Issues</p>
                  <h4 className="text-2xl font-black text-jira-text mt-1">{stats.total}</h4>
                  <p className="text-[11px] text-jira-muted mt-0.5">In this project scope</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-jira-blue flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
              </div>

              {/* Stat 2: Open Issues */}
              <div className="bg-white rounded-xl border border-jira-border p-5 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-jira-muted uppercase tracking-wider">Open Issues</p>
                  <h4 className="text-2xl font-black text-amber-600 mt-1">{stats.open}</h4>
                  <p className="text-[11px] text-jira-muted mt-0.5">Backlog + Todo + In Progress</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>

              {/* Stat 3: Completed Issues */}
              <div className="bg-white rounded-xl border border-jira-border p-5 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-jira-muted uppercase tracking-wider">Completed Issues</p>
                  <h4 className="text-2xl font-black text-emerald-600 mt-1">{stats.done}</h4>
                  <p className="text-[11px] text-jira-muted mt-0.5">Done & verified</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              {/* Stat 4: Completion % */}
              <div className="bg-white rounded-xl border border-jira-border p-5 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-jira-muted uppercase tracking-wider">Completion %</p>
                  <h4 className="text-2xl font-black text-purple-600 mt-1">{stats.percent}%</h4>
                  <p className="text-[11px] text-jira-muted mt-0.5">{stats.done} of {stats.total} resolved</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Status Distribution Chart (Pure Tailwind / SVG Stacked Bar) */}
            <div className="bg-white rounded-xl border border-jira-border p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-jira-text">Status Distribution</h3>
                  <p className="text-xs text-jira-muted mt-0.5">
                    Proportional workflow breakdown across Backlog, To Do, In Progress, and Done stages.
                  </p>
                </div>
                <span className="text-xs font-semibold text-jira-muted">{stats.total} Items</span>
              </div>

              {stats.total === 0 ? (
                <div className="py-8 text-center text-xs text-jira-muted bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  No issues recorded yet for this project. Click <strong>Create Issue</strong> above to start.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* Horizontal Stacked Bar */}
                  <div className="h-7 w-full bg-gray-100 rounded-xl overflow-hidden flex shadow-inner border border-gray-200/80">
                    {stats.backlog > 0 && (
                      <div
                        style={{ width: `${(stats.backlog / stats.total) * 100}%` }}
                        className="bg-slate-400 hover:bg-slate-500 transition-all flex items-center justify-center text-white text-[11px] font-bold px-1 relative group cursor-pointer"
                        title={`Backlog: ${stats.backlog} (${Math.round((stats.backlog / stats.total) * 100)}%)`}
                      >
                        {stats.backlog / stats.total >= 0.1 && (
                          <span>{Math.round((stats.backlog / stats.total) * 100)}%</span>
                        )}
                      </div>
                    )}

                    {stats.todo > 0 && (
                      <div
                        style={{ width: `${(stats.todo / stats.total) * 100}%` }}
                        className="bg-blue-500 hover:bg-blue-600 transition-all flex items-center justify-center text-white text-[11px] font-bold px-1 relative group cursor-pointer"
                        title={`To Do: ${stats.todo} (${Math.round((stats.todo / stats.total) * 100)}%)`}
                      >
                        {stats.todo / stats.total >= 0.1 && (
                          <span>{Math.round((stats.todo / stats.total) * 100)}%</span>
                        )}
                      </div>
                    )}

                    {stats.inProgress > 0 && (
                      <div
                        style={{ width: `${(stats.inProgress / stats.total) * 100}%` }}
                        className="bg-amber-500 hover:bg-amber-600 transition-all flex items-center justify-center text-white text-[11px] font-bold px-1 relative group cursor-pointer"
                        title={`In Progress: ${stats.inProgress} (${Math.round((stats.inProgress / stats.total) * 100)}%)`}
                      >
                        {stats.inProgress / stats.total >= 0.1 && (
                          <span>{Math.round((stats.inProgress / stats.total) * 100)}%</span>
                        )}
                      </div>
                    )}

                    {stats.done > 0 && (
                      <div
                        style={{ width: `${(stats.done / stats.total) * 100}%` }}
                        className="bg-emerald-500 hover:bg-emerald-600 transition-all flex items-center justify-center text-white text-[11px] font-bold px-1 relative group cursor-pointer"
                        title={`Done: ${stats.done} (${Math.round((stats.done / stats.total) * 100)}%)`}
                      >
                        {stats.done / stats.total >= 0.1 && (
                          <span>{Math.round((stats.done / stats.total) * 100)}%</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Legend Row with Counts & Percentages */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <span className="w-3 h-3 rounded-full bg-slate-400 flex-shrink-0" />
                      <div className="text-xs">
                        <span className="text-jira-muted font-medium">Backlog: </span>
                        <span className="font-bold text-jira-text">{stats.backlog}</span>
                        <span className="text-[10px] text-jira-muted ml-1">
                          ({stats.total > 0 ? Math.round((stats.backlog / stats.total) * 100) : 0}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50/60 border border-blue-100">
                      <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
                      <div className="text-xs">
                        <span className="text-jira-muted font-medium">To Do: </span>
                        <span className="font-bold text-jira-blue">{stats.todo}</span>
                        <span className="text-[10px] text-jira-muted ml-1">
                          ({stats.total > 0 ? Math.round((stats.todo / stats.total) * 100) : 0}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50/60 border border-amber-100">
                      <span className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0" />
                      <div className="text-xs">
                        <span className="text-jira-muted font-medium">In Progress: </span>
                        <span className="font-bold text-amber-700">{stats.inProgress}</span>
                        <span className="text-[10px] text-jira-muted ml-1">
                          ({stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />
                      <div className="text-xs">
                        <span className="text-jira-muted font-medium">Done: </span>
                        <span className="font-bold text-emerald-700">{stats.done}</span>
                        <span className="text-[10px] text-jira-muted ml-1">
                          ({stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Priority Breakdown (Grid of 5 Priority Chips) */}
            <div className="bg-white rounded-xl border border-jira-border p-6 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-jira-text">Priority Breakdown</h3>
                  <p className="text-xs text-jira-muted mt-0.5">Issue volume classified by operational severity</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {/* Highest */}
                <div className="p-3 rounded-xl border border-red-200 bg-red-50/50 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-red-700 flex items-center gap-1">
                      <span>🔴</span> Highest
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-bold text-red-800">{priorityCounts.highest}</span>
                    <span className="text-[10px] text-red-600 font-medium">
                      {stats.total > 0 ? Math.round((priorityCounts.highest / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* High */}
                <div className="p-3 rounded-xl border border-orange-200 bg-orange-50/50 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-orange-700 flex items-center gap-1">
                      <span>🟠</span> High
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-bold text-orange-800">{priorityCounts.high}</span>
                    <span className="text-[10px] text-orange-600 font-medium">
                      {stats.total > 0 ? Math.round((priorityCounts.high / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* Medium */}
                <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                      <span>🟡</span> Medium
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-bold text-amber-800">{priorityCounts.medium}</span>
                    <span className="text-[10px] text-amber-600 font-medium">
                      {stats.total > 0 ? Math.round((priorityCounts.medium / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* Low */}
                <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      <span>🟢</span> Low
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-bold text-emerald-800">{priorityCounts.low}</span>
                    <span className="text-[10px] text-emerald-600 font-medium">
                      {stats.total > 0 ? Math.round((priorityCounts.low / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* Lowest */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <span>⚪</span> Lowest
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-bold text-slate-800">{priorityCounts.lowest}</span>
                    <span className="text-[10px] text-slate-600 font-medium">
                      {stats.total > 0 ? Math.round((priorityCounts.lowest / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity (Last 5 Updated Issues) */}
            <div className="bg-white rounded-xl border border-jira-border p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-jira-text">Recent Activity</h3>
                  <p className="text-xs text-jira-muted mt-0.5">Last 5 recently modified issues in this project</p>
                </div>
                <button
                  onClick={() => setActiveTab('tickets')}
                  className="text-xs font-semibold text-jira-blue hover:underline cursor-pointer"
                >
                  View all ({stats.total}) →
                </button>
              </div>

              {recentIssues.length === 0 ? (
                <div className="py-8 text-center text-xs text-jira-muted bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  No issues available to display.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 border border-jira-border rounded-xl overflow-hidden">
                  {recentIssues.map(issue => (
                    <div
                      key={issue.id || issue.key}
                      onClick={() => onIssueClick?.(issue)}
                      className="p-3.5 hover:bg-blue-50/50 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-base" title={ISSUE_TYPE_CONFIG[issue.type]?.label || issue.type}>
                          {ISSUE_TYPE_CONFIG[issue.type]?.symbol || '📋'}
                        </span>
                        <span className="font-mono text-xs font-bold text-jira-blue group-hover:underline whitespace-nowrap">
                          {issue.key}
                        </span>
                        <span className="text-xs text-jira-text font-medium truncate group-hover:text-jira-blue transition-colors">
                          {issue.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border capitalize ${getStatusBadgeClass(issue.status)}`}>
                          {issue.status}
                        </span>
                        <span className="text-xs text-jira-muted whitespace-nowrap">
                          {formatRelativeDate(issue.updatedAt || issue.createdAt) || 'Recently'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
  );
}
