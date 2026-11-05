import React, { useMemo, useState } from 'react';
import {
  Users, Clock, AlertTriangle
} from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { Avatar } from '../common/Avatar';

interface CapacityViewProps {
  issues: Issue[];
  space: Space | undefined;
  onIssueClick?: (issue: Issue) => void;
  searchQuery?: string;
  filterAssignee?: boolean;
  activeFilters?: { priorities: string[]; labels: string[] };
  groupBy?: 'status' | 'assignee' | 'priority' | 'epic';
}

interface MemberWorkload {
  name: string;
  initials: string;
  avatarColor: string;
  total: number;
  backlog: number;
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
  storyPoints: number;
  issues: Issue[];
}

export const CapacityView: React.FC<CapacityViewProps> = ({
  issues,
  space,
  onIssueClick,
  searchQuery = '',
  filterAssignee = false,
  activeFilters,
  groupBy = 'assignee',
}) => {
  const [localQuickFilter, setLocalQuickFilter] = useState<'all' | 'vy' | 'inprogress' | 'high' | 'overdue'>('all');
  const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState<string | null>(null);

  // 1. Apply Active Filters & Quick Filters
  const filteredIssues = useMemo(() => {
    let list = issues;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.key.toLowerCase().includes(q) ||
        i.labels?.some(l => l.toLowerCase().includes(q))
      );
    }

    // Top-bar Assignee toggle
    if (filterAssignee) {
      list = list.filter(i => i.assigneeInitials === 'VY' || i.assignee === 'Varun Tej');
    }

    // Priority filter from popover
    if (activeFilters?.priorities && activeFilters.priorities.length > 0) {
      list = list.filter(i => activeFilters.priorities.includes(i.priority));
    }

    // Label filter from popover
    if (activeFilters?.labels && activeFilters.labels.length > 0) {
      list = list.filter(i => i.labels?.some(l => activeFilters.labels.includes(l)));
    }

    // In-view member filter
    if (selectedAssigneeFilter) {
      list = list.filter(i => (i.assigneeInitials || i.assignee) === selectedAssigneeFilter);
    }

    // Quick filter chips inside Capacity view
    if (localQuickFilter === 'vy') {
      list = list.filter(i => i.assigneeInitials === 'VY' || i.assignee === 'Varun Tej');
    } else if (localQuickFilter === 'inprogress') {
      list = list.filter(i => i.status === 'inprogress');
    } else if (localQuickFilter === 'high') {
      list = list.filter(i => i.priority === 'high' || i.priority === 'highest');
    } else if (localQuickFilter === 'overdue') {
      const now = new Date();
      list = list.filter(i => i.status !== 'done' && i.dueDate && new Date(i.dueDate) < now);
    }

    return list;
  }, [issues, searchQuery, filterAssignee, activeFilters, selectedAssigneeFilter, localQuickFilter]);

  // 2. Compute Workloads & Metrics
  const { workloads, teamTotal, teamDone, teamInProgress, teamPoints, totalOverdue } = useMemo(() => {
    const memberMap: Record<string, MemberWorkload> = {};
    const now = new Date();
    let totalOverdue = 0;

    filteredIssues.forEach(issue => {
      const initials = issue.assigneeInitials || (issue.assignee ? issue.assignee.slice(0, 2).toUpperCase() : 'UN');
      const name = issue.assignee || 'Unassigned';

      if (!memberMap[initials]) {
        memberMap[initials] = {
          name,
          initials,
          avatarColor: initials === 'VY' ? '#0052CC' : initials === 'UN' ? '#6B778C' : '#00875A',
          total: 0,
          backlog: 0,
          todo: 0,
          inProgress: 0,
          done: 0,
          overdue: 0,
          storyPoints: 0,
          issues: [],
        };
      }

      const m = memberMap[initials];
      m.total += 1;
      m.storyPoints += issue.storyPoints || 1;
      m.issues.push(issue);

      if (issue.status === 'done') m.done += 1;
      else if (issue.status === 'inprogress') m.inProgress += 1;
      else if (issue.status === 'todo') m.todo += 1;
      else m.backlog += 1;

      if (issue.status !== 'done' && issue.dueDate && new Date(issue.dueDate) < now) {
        m.overdue += 1;
        totalOverdue += 1;
      }
    });

    const workloads = Object.values(memberMap).sort((a, b) => b.total - a.total);
    const teamTotal = filteredIssues.length;
    const teamDone = filteredIssues.filter(i => i.status === 'done').length;
    const teamInProgress = filteredIssues.filter(i => i.status === 'inprogress').length;
    const teamPoints = filteredIssues.reduce((acc, i) => acc + (i.storyPoints || 1), 0);

    return { workloads, teamTotal, teamDone, teamInProgress, teamPoints, totalOverdue };
  }, [filteredIssues]);

  // 3. Status Grouping
  const statusGroups = useMemo(() => {
    const statuses = [
      { id: 'backlog', label: 'Backlog Pool', desc: 'Items awaiting refinement & sprint commitment', dot: '#6B778C', color: 'border-slate-200 bg-white' },
      { id: 'todo', label: 'Ready (To Do)', desc: 'Prioritized & groomed items ready for active pickup', dot: '#172B4D', color: 'border-blue-200 bg-white' },
      { id: 'inprogress', label: 'In Flight (In Progress)', desc: 'Active development and implementation', dot: '#FFAB00', color: 'border-amber-200 bg-white' },
      { id: 'done', label: 'Completed (Done)', desc: 'Verified, tested, and resolved work items', dot: '#36B37E', color: 'border-emerald-200 bg-white' },
    ];
    return statuses.map(s => {
      const items = filteredIssues.filter(i => i.status === s.id);
      const points = items.reduce((sum, i) => sum + (i.storyPoints || 1), 0);
      const pct = teamPoints > 0 ? Math.round((points / teamPoints) * 100) : 0;
      return { ...s, items, points, pct };
    });
  }, [filteredIssues, teamPoints]);

  // 4. Priority Grouping
  const priorityGroups = useMemo(() => {
    const groups = [
      { id: 'highest', label: 'Highest Priority', dot: '🔴', color: 'border-red-200 bg-white', badge: 'bg-red-50 text-red-700' },
      { id: 'high', label: 'High Priority', dot: '🟠', color: 'border-orange-200 bg-white', badge: 'bg-orange-50 text-orange-700' },
      { id: 'medium', label: 'Medium Priority', dot: '🟡', color: 'border-amber-200 bg-white', badge: 'bg-amber-50 text-amber-700' },
      { id: 'low', label: 'Low / Lowest Priority', dot: '🟢', color: 'border-emerald-200 bg-white', badge: 'bg-emerald-50 text-emerald-700' },
    ];
    return groups.map(g => {
      const items = filteredIssues.filter(i =>
        g.id === 'low' ? (i.priority === 'low' || i.priority === 'lowest') : i.priority === g.id
      );
      const points = items.reduce((a, b) => a + (b.storyPoints || 1), 0);
      return { ...g, items, points };
    });
  }, [filteredIssues]);

  // 5. Epic Grouping
  const epicGroups = useMemo(() => {
    const epics = issues.filter(i => i.type === 'epic');
    return epics.map(epic => {
      const children = filteredIssues.filter(i => i.parentId === epic.id || i.epicId === epic.id);
      const done = children.filter(c => c.status === 'done').length;
      const progress = children.length > 0 ? Math.round((done / children.length) * 100) : (epic.status === 'done' ? 100 : 0);
      const points = children.reduce((sum, c) => sum + (c.storyPoints || 1), 0);
      return { epic, children, done, progress, points };
    }).filter(eg => eg.children.length > 0 || issues.some(i => i.id === eg.epic.id));
  }, [issues, filteredIssues]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    filterAssignee ||
    (activeFilters?.priorities && activeFilters.priorities.length > 0) ||
    (activeFilters?.labels && activeFilters.labels.length > 0) ||
    selectedAssigneeFilter !== null ||
    localQuickFilter !== 'all';

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 p-6 space-y-6">
      {/* ── Top Analytical Banner ── */}
      <div className="bg-white border border-jira-border rounded-xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200 shadow-2xs flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-jira-text leading-tight">
                Team Capacity &amp; Workload Allocation
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold border border-purple-200">
                Group: {groupBy === 'priority' ? 'Priority' : groupBy === 'epic' ? 'Epic' : groupBy === 'status' ? 'Status' : 'Assignee'}
              </span>
            </div>
            <p className="text-xs text-jira-muted mt-1">
              Bandwidth allocation, sprint delivery distribution, and capacity planning for{' '}
              <strong className="text-jira-text font-semibold">{space?.name || 'Workspace'}</strong>
            </p>
          </div>
        </div>

        {/* Global Metrics Bar */}
        <div className="flex items-center gap-4 bg-gray-50/80 px-4 py-2.5 rounded-xl border border-jira-border flex-shrink-0">
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase text-jira-muted tracking-wider">
              Sprint Story Points
            </div>
            <div className="text-xl font-extrabold text-jira-text">
              {teamPoints} pts <span className="text-xs font-normal text-jira-muted">({teamTotal} items)</span>
            </div>
          </div>

          <div className="h-8 w-px bg-jira-border" />

          <div className="text-right">
            <div className="text-[10px] font-bold uppercase text-jira-muted tracking-wider">
              Sprint Progress
            </div>
            <div className="text-xl font-extrabold text-emerald-600">
              {teamTotal > 0 ? Math.round((teamDone / teamTotal) * 100) : 0}% Done
            </div>
          </div>

          <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center border-2 border-blue-500 shadow-2xs">
            {teamInProgress} In Prog
          </div>
        </div>
      </div>

      {/* ── Quick Filter Chips Row ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-jira-border shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-jira-muted uppercase mr-1">Quick Filter:</span>
          {[
            { id: 'all' as const, label: `All Items (${issues.length})` },
            { id: 'vy' as const, label: 'Assigned to VY' },
            { id: 'inprogress' as const, label: 'In Flight Only' },
            { id: 'high' as const, label: 'High Priority' },
            { id: 'overdue' as const, label: `Overdue (${totalOverdue})` },
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setLocalQuickFilter(chip.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                localQuickFilter === chip.id
                  ? 'bg-jira-blue text-white shadow-2xs'
                  : 'bg-gray-100 text-jira-text hover:bg-gray-200'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => {
              setLocalQuickFilter('all');
              setSelectedAssigneeFilter(null);
            }}
            className="text-xs text-jira-blue font-semibold hover:underline cursor-pointer"
          >
            Clear Capacity Filters
          </button>
        )}
      </div>

      {/* ─────────────────── 1. GROUP BY STATUS ─────────────────── */}
      {groupBy === 'status' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {statusGroups.map(stage => (
            <div
              key={stage.id}
              className={`rounded-xl border ${stage.color} shadow-xs p-5 space-y-4 flex flex-col hover:border-jira-blue transition-all`}
            >
              <div className="flex items-center justify-between border-b border-jira-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.dot }} />
                  <h3 className="text-sm font-bold text-jira-text">{stage.label}</h3>
                </div>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-jira-text">
                  {stage.items.length}
                </span>
              </div>

              {/* Story Point & Velocity Metrics */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-jira-muted">
                  <span>Capacity Load</span>
                  <span className="font-bold text-jira-text">{stage.points} pts ({stage.pct}%)</span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${stage.pct}%`, backgroundColor: stage.dot }}
                  />
                </div>
                <p className="text-[11px] text-jira-muted pt-1">{stage.desc}</p>
              </div>

              {/* Item Cards */}
              <div className="flex-1 space-y-2 overflow-y-auto max-h-96 pr-1">
                {stage.items.length === 0 ? (
                  <p className="text-xs text-jira-muted py-6 text-center bg-gray-50 rounded-lg">
                    No items in {stage.label.toLowerCase()}.
                  </p>
                ) : (
                  stage.items.map(issue => (
                    <div
                      key={issue.id}
                      onClick={() => onIssueClick?.(issue)}
                      className="p-3 rounded-lg border border-jira-border hover:border-jira-blue hover:bg-blue-50/20 transition-all cursor-pointer text-xs space-y-1.5 bg-white group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-jira-blue group-hover:underline">
                          {issue.key}
                        </span>
                        <span className="text-[10px] uppercase font-semibold text-gray-500">
                          {issue.priority}
                        </span>
                      </div>
                      <div className="font-medium text-jira-text line-clamp-2 leading-snug">
                        {issue.title}
                      </div>
                      <div className="flex items-center justify-between pt-1 text-[10px] text-jira-muted border-t border-gray-100">
                        <span>{issue.assignee || 'Unassigned'}</span>
                        <span className="font-bold text-jira-text">{issue.storyPoints || 1} pts</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─────────────────── 2. GROUP BY ASSIGNEE ─────────────────── */}
      {groupBy === 'assignee' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {workloads.map(member => {
            const completionPct = member.total > 0 ? Math.round((member.done / member.total) * 100) : 0;
            const inProgressIssues = member.issues.filter(i => i.status === 'inprogress');

            return (
              <div
                key={member.initials}
                className="bg-white rounded-xl border border-jira-border shadow-xs p-5 space-y-4 hover:border-jira-blue transition-all"
              >
                {/* Member Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar initials={member.initials} size="md" color={member.avatarColor} />
                    <div>
                      <h3 className="text-sm font-bold text-jira-text leading-tight">{member.name}</h3>
                      <p className="text-[11px] text-jira-muted font-medium">
                        {member.storyPoints} Story Points · {member.total} Work Items
                      </p>
                    </div>
                  </div>

                  {member.overdue > 0 && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" />
                      {member.overdue} Overdue
                    </span>
                  )}
                </div>

                {/* Progress Breakdown Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-jira-muted">Sprint Delivery Progress</span>
                    <span className="text-emerald-600">{completionPct}% Done</span>
                  </div>
                  <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${(member.done / member.total) * 100}%` }}
                      title={`Done: ${member.done}`}
                    />
                    <div
                      className="bg-amber-400 h-full transition-all duration-300"
                      style={{ width: `${(member.inProgress / member.total) * 100}%` }}
                      title={`In Progress: ${member.inProgress}`}
                    />
                    <div
                      className="bg-blue-400 h-full transition-all duration-300"
                      style={{ width: `${(member.todo / member.total) * 100}%` }}
                      title={`To Do: ${member.todo}`}
                    />
                  </div>

                  {/* 4 Stage Counters */}
                  <div className="grid grid-cols-4 gap-1.5 text-center pt-2">
                    <div className="bg-gray-50 border border-jira-border rounded p-1.5">
                      <div className="text-[9px] text-jira-muted uppercase font-bold">Backlog</div>
                      <div className="text-xs font-bold text-slate-700">{member.backlog}</div>
                    </div>
                    <div className="bg-blue-50/60 border border-blue-200 rounded p-1.5">
                      <div className="text-[9px] text-blue-600 uppercase font-bold">To Do</div>
                      <div className="text-xs font-bold text-blue-700">{member.todo}</div>
                    </div>
                    <div className="bg-amber-50/60 border border-amber-200 rounded p-1.5">
                      <div className="text-[9px] text-amber-600 uppercase font-bold">In Prog</div>
                      <div className="text-xs font-bold text-amber-700">{member.inProgress}</div>
                    </div>
                    <div className="bg-emerald-50/60 border border-emerald-200 rounded p-1.5">
                      <div className="text-[9px] text-emerald-600 uppercase font-bold">Done</div>
                      <div className="text-xs font-bold text-emerald-700">{member.done}</div>
                    </div>
                  </div>
                </div>

                {/* Active in-progress task list */}
                <div className="border-t border-jira-border pt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-jira-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      Active In Progress ({inProgressIssues.length})
                    </span>
                  </div>

                  {inProgressIssues.length === 0 ? (
                    <p className="text-xs text-jira-muted py-2.5 text-center bg-gray-50 rounded-lg">
                      No active tickets in progress.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {inProgressIssues.slice(0, 4).map(task => (
                        <div
                          key={task.id}
                          onClick={() => onIssueClick?.(task)}
                          className="flex items-center justify-between p-2 rounded-lg border border-jira-border bg-gray-50/70 hover:bg-white hover:border-jira-blue transition-all cursor-pointer text-xs group"
                        >
                          <span className="font-bold text-jira-blue truncate mr-2 font-mono group-hover:underline">
                            {task.key}
                          </span>
                          <span className="text-jira-text truncate flex-1">{task.title}</span>
                          <span className="text-[10px] ml-2 font-semibold text-gray-500 uppercase">
                            {task.priority}
                          </span>
                        </div>
                      ))}
                      {inProgressIssues.length > 4 && (
                        <div className="text-[10px] text-jira-muted text-right font-medium">
                          +{inProgressIssues.length - 4} more active tickets
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─────────────────── 3. GROUP BY PRIORITY ─────────────────── */}
      {groupBy === 'priority' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {priorityGroups.map(group => (
            <div
              key={group.id}
              className={`rounded-xl border ${group.color} shadow-xs p-5 space-y-4 flex flex-col hover:border-jira-blue transition-all`}
            >
              <div className="flex items-center justify-between border-b border-jira-border pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">{group.dot}</span>
                  <h3 className="text-sm font-bold text-jira-text">{group.label}</h3>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${group.badge}`}>
                  {group.items.length}
                </span>
              </div>

              <div className="text-xs text-jira-muted flex justify-between">
                <span>Story Point Load:</span>
                <span className="font-bold text-jira-text">{group.points} pts</span>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-96 pr-1">
                {group.items.length === 0 ? (
                  <p className="text-xs text-jira-muted py-6 text-center bg-gray-50 rounded-lg">
                    No work items in this priority level.
                  </p>
                ) : (
                  group.items.map(issue => (
                    <div
                      key={issue.id}
                      onClick={() => onIssueClick?.(issue)}
                      className="p-2.5 rounded-lg border border-jira-border hover:border-jira-blue hover:bg-blue-50/30 transition-all cursor-pointer text-xs space-y-1 bg-white group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-jira-blue group-hover:underline">{issue.key}</span>
                        <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-gray-100 font-semibold text-gray-600">
                          {issue.status}
                        </span>
                      </div>
                      <div className="font-medium text-jira-text line-clamp-2 leading-snug">
                        {issue.title}
                      </div>
                      <div className="flex items-center justify-between pt-1 text-[10px] text-jira-muted border-t border-gray-100">
                        <span>{issue.assignee || 'Unassigned'}</span>
                        <span className="font-bold text-jira-text">{issue.storyPoints || 1} pts</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─────────────────── 4. GROUP BY EPIC ─────────────────── */}
      {groupBy === 'epic' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {epicGroups.map(({ epic, children, done, progress, points }) => (
            <div
              key={epic.id}
              className="bg-white rounded-xl border border-jira-border shadow-xs p-5 space-y-4 hover:border-jira-blue transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                    ⚡ {epic.key}
                  </span>
                  <h3 className="text-sm font-bold text-jira-text truncate max-w-sm">{epic.title}</h3>
                </div>
                <span className="text-xs font-bold text-purple-700">{progress}%</span>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="text-xs text-jira-muted flex justify-between font-medium">
                <span>{done} of {children.length} child tasks done · {points} pts</span>
                <span className="capitalize">{epic.status}</span>
              </div>

              {/* Child items */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {children.map(child => (
                  <div
                    key={child.id}
                    onClick={() => onIssueClick?.(child)}
                    className="flex items-center justify-between p-2 rounded-lg border border-jira-border hover:bg-gray-50 transition-all cursor-pointer text-xs group"
                  >
                    <span className="font-mono font-bold text-jira-blue mr-2 group-hover:underline">{child.key}</span>
                    <span className="truncate flex-1 text-jira-text">{child.title}</span>
                    <span className="text-[10px] uppercase font-semibold text-gray-500 ml-2">
                      {child.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
