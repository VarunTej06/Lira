import { issueLink } from '../../utils/links';
import { statusLabel } from '../../utils/status';
import { ColorDot } from '../common/Icons';
import React, { useMemo } from 'react';
import {
  CheckCircle2, Clock, AlertTriangle, Layers, Tag,
  ArrowUpRight, BarChart2, Zap, TrendingUp
} from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';

interface SummaryViewProps {
  issues: Issue[];
  space: Space | undefined;
  onIssueClick: (issue: Issue) => void;
}

export const SummaryView: React.FC<SummaryViewProps> = ({
  issues,
  space,
  onIssueClick,
}) => {
  const stats = useMemo(() => {
    const total = issues.length;
    const done = issues.filter(i => i.status === 'done').length;
    const inProgress = issues.filter(i => i.status === 'inprogress').length;
    const blocked = issues.filter(i => i.blocked).length;
    const todo = issues.filter(i => i.status === 'todo').length;
    const backlog = issues.filter(i => i.status === 'backlog').length;

    const now = new Date();
    const overdue = issues.filter(i => {
      if (i.status === 'done' || !i.dueDate) return false;
      return new Date(i.dueDate) < now;
    }).length;

    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

    // Priority counts
    const priorityCounts: Record<string, number> = {
      highest: issues.filter(i => i.priority === 'highest').length,
      high: issues.filter(i => i.priority === 'high').length,
      medium: issues.filter(i => i.priority === 'medium').length,
      low: issues.filter(i => i.priority === 'low').length,
      lowest: issues.filter(i => i.priority === 'lowest').length,
    };

    // High priority callouts
    const highPriorityIssues = issues
      .filter(i => (i.priority === 'highest' || i.priority === 'high') && i.status !== 'done')
      .slice(0, 5);

    // Recent updates
    const recentlyUpdated = [...issues]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, 5);

    // Epics with progress
    const epics = issues.filter(i => i.type === 'epic');
    const epicProgress = epics.map(epic => {
      const children = issues.filter(i => i.parentId === epic.id || i.epicId === epic.id);
      const completedChildren = children.filter(i => i.status === 'done').length;
      const progress = children.length > 0 ? Math.round((completedChildren / children.length) * 100) : (epic.status === 'done' ? 100 : 0);
      return { epic, totalChildren: children.length, completedChildren, progress };
    });

    // Top labels
    const labelCounts: Record<string, number> = {};
    issues.forEach(i => {
      i.labels?.forEach(label => {
        labelCounts[label] = (labelCounts[label] || 0) + 1;
      });
    });
    const topLabels = Object.entries(labelCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return {
      total,
      done,
      inProgress,
      blocked,
      todo,
      backlog,
      overdue,
      completionRate,
      priorityCounts,
      highPriorityIssues,
      recentlyUpdated,
      epicProgress,
      topLabels,
    };
  }, [issues]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 p-6 space-y-6">
      {/* Space Hero banner */}
      <div className="flex items-center justify-between bg-white border border-lira-border rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-4">
          {space && (
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold shadow-xs"
              style={{ backgroundColor: (space.color || '#0052CC') + '22', color: space.color || '#0052CC' }}
            >
              {space.icon || '🚀'}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-lira-text flex items-center gap-2">
              {space?.name || 'Workspace'}
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                Summary & Analytics
              </span>
            </h1>
            <p className="text-xs text-lira-muted mt-0.5">
              Live workspace telemetry, sprint velocity, and delivery metrics for {space?.key}
            </p>
          </div>
        </div>

        {/* Global Progress Dial */}
        <div className="flex items-center gap-4 bg-gray-50 px-4 py-2.5 rounded-lg border border-lira-border">
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase text-lira-muted tracking-wider">Completion Rate</div>
            <div className="text-2xl font-extrabold text-lira-text">{stats.completionRate}%</div>
          </div>
          <div className="w-12 h-12 rounded-full border-4 border-emerald-500 flex items-center justify-center font-bold text-xs text-emerald-700 bg-emerald-50">
            {stats.done}/{stats.total}
          </div>
        </div>
      </div>

      {/* Row 1 — 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-lira-border shadow-xs hover:border-lira-blue transition-all">
          <div className="flex items-center justify-between text-lira-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Issues</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-lira-text">{stats.total}</div>
          <div className="text-xs text-lira-muted mt-1">Across all Kanban columns</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-lira-border shadow-xs hover:border-lira-blue transition-all">
          <div className="flex items-center justify-between text-lira-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">In Progress</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{stats.inProgress}</div>
          <div className="text-xs text-lira-muted mt-1">
            {stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}% of active workload
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-lira-border shadow-xs hover:border-lira-blue transition-all">
          <div className="flex items-center justify-between text-lira-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{stats.done}</div>
          <div className="text-xs text-lira-muted mt-1">
            {stats.completionRate}% resolved successfully
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-lira-border shadow-xs hover:border-lira-blue transition-all">
          <div className="flex items-center justify-between text-lira-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Overdue Issues</span>
            <AlertTriangle className={`w-4 h-4 ${stats.overdue > 0 ? 'text-red-500' : 'text-gray-400'}`} />
          </div>
          <div className={`text-2xl font-bold ${stats.overdue > 0 ? 'text-red-600' : 'text-gray-600'}`}>
            {stats.overdue}
          </div>
          <div className="text-xs text-lira-muted mt-1">Requires immediate attention</div>
        </div>
      </div>

      {/* Row 2 — Status Breakdown & Priority Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-lira-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-lira-text flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-lira-blue" />
              Status Breakdown
            </h2>
            <span className="text-xs text-lira-muted font-medium">{stats.total} total</span>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Backlog', count: stats.backlog, color: 'bg-slate-400', textColor: 'text-slate-600' },
              { label: 'To Do', count: stats.todo, color: 'bg-blue-500', textColor: 'text-blue-600' },
              { label: 'In Progress', count: stats.inProgress, color: 'bg-amber-500', textColor: 'text-amber-600' },
              { label: 'Blocked (flagged)', count: stats.blocked, color: 'bg-red-500', textColor: 'text-red-600' },
              { label: 'Done', count: stats.done, color: 'bg-emerald-500', textColor: 'text-emerald-600' },
            ].map(col => {
              const pct = stats.total > 0 ? Math.round((col.count / stats.total) * 100) : 0;
              return (
                <div key={col.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-lira-text">{col.label}</span>
                    <span className={col.textColor}>
                      {col.count} <span className="text-lira-muted">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${col.color} transition-all duration-500 rounded-full`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="bg-white p-5 rounded-xl border border-lira-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-lira-text flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              Priority Distribution
            </h2>
            <span className="text-xs text-lira-muted font-medium">Urgency breakdown</span>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Highest', key: 'highest', color: 'bg-red-500', dot: '#EF4444' },
              { label: 'High', key: 'high', color: 'bg-orange-500', dot: '#F97316' },
              { label: 'Medium', key: 'medium', color: 'bg-amber-400', dot: '#FBBF24' },
              { label: 'Low', key: 'low', color: 'bg-emerald-400', dot: '#34D399' },
              { label: 'Lowest', key: 'lowest', color: 'bg-slate-400', dot: '#94A3B8' },
            ].map(p => {
              const count = stats.priorityCounts[p.key] || 0;
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={p.key} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5 text-lira-text">
                      <ColorDot color={p.dot} /> {p.label}
                    </span>
                    <span className="text-lira-muted">
                      {count} <span className="text-gray-400">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${p.color} transition-all duration-500 rounded-full`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 3 — Epic Roadmap Progress */}
      {stats.epicProgress.length > 0 && (
        <div className="bg-white p-5 rounded-xl border border-lira-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-lira-text flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-600" />
              Epic & Initiative Milestones
            </h2>
            <span className="text-xs text-lira-muted">{stats.epicProgress.length} active epics</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.epicProgress.map(({ epic, totalChildren, completedChildren, progress }) => (
              <div
                key={epic.id}
                onClick={() => onIssueClick(epic)} {...issueLink(epic)}
                className="p-3.5 rounded-lg border border-lira-border hover:border-purple-300 hover:bg-purple-50/30 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded flex items-center gap-1">
                    <Zap className="w-3 h-3" /> {epic.key}
                  </span>
                  <span className="text-xs font-semibold text-lira-muted group-hover:text-purple-700 transition-colors flex items-center gap-0.5">
                    {progress}% <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                  </span>
                </div>
                <div className="text-sm font-semibold text-lira-text truncate mb-2">{epic.title}</div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mb-1.5">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-[11px] text-lira-muted flex justify-between">
                  <span>{completedChildren} of {totalChildren} work items done</span>
                  <span className="capitalize text-gray-500">{epic.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Row 4 — High Priority Callouts & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Urgent Action Callouts */}
        <div className="bg-white p-5 rounded-xl border border-lira-border shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-lira-text flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            High Priority & Urgent Issues
          </h2>
          {stats.highPriorityIssues.length === 0 ? (
            <p className="text-xs text-lira-muted py-6 text-center">No open high-priority issues! All clear.</p>
          ) : (
            <div className="space-y-2">
              {stats.highPriorityIssues.map(issue => (
                <div
                  key={issue.id}
                  onClick={() => onIssueClick(issue)} {...issueLink(issue)}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-lira-border hover:bg-gray-50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 truncate pr-2">
                    <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                      {issue.key}
                    </span>
                    <span className="text-xs font-medium text-lira-text truncate group-hover:text-lira-blue">
                      {issue.title}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap">
                    {statusLabel(issue.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Labels */}
        <div className="bg-white p-5 rounded-xl border border-lira-border shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-lira-text flex items-center gap-2">
            <Tag className="w-4 h-4 text-lira-blue" />
            Top Labels & Domains
          </h2>
          {stats.topLabels.length === 0 ? (
            <p className="text-xs text-lira-muted py-6 text-center">No labels tagged yet on issues.</p>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {stats.topLabels.map(([label, count]) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold"
                >
                  <span>#{label}</span>
                  <span className="bg-blue-200/80 text-blue-900 px-1.5 py-0.2 rounded-full text-[10px]">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
