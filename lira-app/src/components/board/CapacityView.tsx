import React, { useMemo } from 'react';
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
}) => {
  const { workloads, teamTotal, teamDone, teamInProgress } = useMemo(() => {
    const memberMap: Record<string, MemberWorkload> = {};

    const now = new Date();

    issues.forEach(issue => {
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
      }
    });

    const workloads = Object.values(memberMap).sort((a, b) => b.total - a.total);
    const teamTotal = issues.length;
    const teamDone = issues.filter(i => i.status === 'done').length;
    const teamInProgress = issues.filter(i => i.status === 'inprogress').length;

    return { workloads, teamTotal, teamDone, teamInProgress };
  }, [issues]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white border border-jira-border rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-jira-text flex items-center gap-2">
              Team Capacity & Workload Allocation
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold border border-purple-200">
                {space?.key} Sprint Allocation
              </span>
            </h1>
            <p className="text-xs text-jira-muted mt-0.5">
              Inspect developer bandwidth, active work-in-progress, and individual task distributions.
            </p>
          </div>
        </div>

        {/* Global Team Utilization Bar */}
        <div className="flex items-center gap-3 bg-gray-50 px-4 py-2.5 rounded-lg border border-jira-border">
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase text-jira-muted tracking-wider">Team Utilization</div>
            <div className="text-lg font-bold text-jira-text">
              {teamInProgress} In Progress · {teamDone} Resolved
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
            {teamTotal > 0 ? Math.round(((teamInProgress + teamDone) / teamTotal) * 100) : 0}%
          </div>
        </div>
      </div>

      {/* Member Capacity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {workloads.map(member => {
          const completionPct = member.total > 0 ? Math.round((member.done / member.total) * 100) : 0;
          const inProgressIssues = member.issues.filter(i => i.status === 'inprogress');

          return (
            <div
              key={member.initials}
              className="bg-white rounded-xl border border-jira-border shadow-xs p-5 space-y-4 hover:border-jira-blue transition-all"
            >
              {/* Member Card Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar initials={member.initials} size="md" color={member.avatarColor} />
                  <div>
                    <h3 className="text-sm font-bold text-jira-text leading-tight">{member.name}</h3>
                    <p className="text-[11px] text-jira-muted">
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

              {/* Progress & Work Breakdown Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-jira-muted">Sprint Delivery Progress</span>
                  <span className="text-emerald-600">{completionPct}% Done</span>
                </div>
                <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden flex">
                  {/* Done */}
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{ width: `${(member.done / member.total) * 100}%` }}
                    title={`Done: ${member.done}`}
                  />
                  {/* In Progress */}
                  <div
                    className="bg-amber-400 h-full transition-all"
                    style={{ width: `${(member.inProgress / member.total) * 100}%` }}
                    title={`In Progress: ${member.inProgress}`}
                  />
                  {/* To Do */}
                  <div
                    className="bg-blue-400 h-full transition-all"
                    style={{ width: `${(member.todo / member.total) * 100}%` }}
                    title={`To Do: ${member.todo}`}
                  />
                </div>

                {/* Legend badges */}
                <div className="grid grid-cols-4 gap-1 text-center pt-2">
                  <div className="bg-gray-50 border border-jira-border rounded p-1.5">
                    <div className="text-[10px] text-jira-muted uppercase">Backlog</div>
                    <div className="text-xs font-bold text-slate-700">{member.backlog}</div>
                  </div>
                  <div className="bg-blue-50/60 border border-blue-200 rounded p-1.5">
                    <div className="text-[10px] text-blue-600 uppercase">To Do</div>
                    <div className="text-xs font-bold text-blue-700">{member.todo}</div>
                  </div>
                  <div className="bg-amber-50/60 border border-amber-200 rounded p-1.5">
                    <div className="text-[10px] text-amber-600 uppercase">In Prog</div>
                    <div className="text-xs font-bold text-amber-700">{member.inProgress}</div>
                  </div>
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded p-1.5">
                    <div className="text-[10px] text-emerald-600 uppercase">Done</div>
                    <div className="text-xs font-bold text-emerald-700">{member.done}</div>
                  </div>
                </div>
              </div>

              {/* Active In-Progress Tasks List */}
              <div className="border-t border-jira-border pt-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-jira-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    Active Tasks ({inProgressIssues.length})
                  </span>
                </div>

                {inProgressIssues.length === 0 ? (
                  <p className="text-xs text-jira-muted py-2 text-center bg-gray-50 rounded-lg">
                    No tasks currently in progress. Ready for new allocation!
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {inProgressIssues.slice(0, 3).map(task => (
                      <div
                        key={task.id}
                        onClick={() => onIssueClick?.(task)}
                        className="flex items-center justify-between p-2 rounded-lg border border-jira-border bg-gray-50/70 hover:bg-white hover:border-jira-blue transition-all cursor-pointer text-xs"
                      >
                        <span className="font-bold text-jira-blue truncate mr-2">{task.key}</span>
                        <span className="text-jira-text truncate flex-1">{task.title}</span>
                      </div>
                    ))}
                    {inProgressIssues.length > 3 && (
                      <div className="text-[11px] text-jira-muted text-right pr-1">
                        +{inProgressIssues.length - 3} more tasks in flight
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
