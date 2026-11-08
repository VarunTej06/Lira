import { Clock, AlertTriangle } from 'lucide-react';
import { Avatar } from '../../common/Avatar';
import type { CapacityState } from './useCapacityState';

/** Workload grouped by person. */
export function GroupByAssignee(s: CapacityState) {
  const {  onIssueClick, groupBy, workloads } = s;
  return (
    <>
      {/* ─────────────────── 2. GROUP BY ASSIGNEE ─────────────────── */}
      {groupBy === 'assignee' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {workloads.map(member => {
            const completionPct = member.total > 0 ? Math.round((member.done / member.total) * 100) : 0;
            const inProgressIssues = member.issues.filter(i => i.status === 'inprogress');

            return (
              <div
                key={member.initials}
                className="bg-white rounded-xl border border-lira-border shadow-xs p-5 space-y-4 hover:border-lira-blue transition-all"
              >
                {/* Member Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar initials={member.initials} size="md" color={member.avatarColor} />
                    <div>
                      <h3 className="text-sm font-bold text-lira-text leading-tight">{member.name}</h3>
                      <p className="text-[11px] text-lira-muted font-medium">
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
                    <span className="text-lira-muted">Sprint Delivery Progress</span>
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
                    <div className="bg-gray-50 border border-lira-border rounded p-1.5">
                      <div className="text-[9px] text-lira-muted uppercase font-bold">Backlog</div>
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
                <div className="border-t border-lira-border pt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-lira-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      Active In Progress ({inProgressIssues.length})
                    </span>
                  </div>

                  {inProgressIssues.length === 0 ? (
                    <p className="text-xs text-lira-muted py-2.5 text-center bg-gray-50 rounded-lg">
                      No active tickets in progress.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {inProgressIssues.slice(0, 4).map(task => (
                        <div
                          key={task.id}
                          onClick={() => onIssueClick?.(task)}
                          className="flex items-center justify-between p-2 rounded-lg border border-lira-border bg-gray-50/70 hover:bg-white hover:border-lira-blue transition-all cursor-pointer text-xs group"
                        >
                          <span className="font-bold text-lira-blue truncate mr-2 font-mono group-hover:underline">
                            {task.key}
                          </span>
                          <span className="text-lira-text truncate flex-1">{task.title}</span>
                          <span className="text-[10px] ml-2 font-semibold text-gray-500 uppercase">
                            {task.priority}
                          </span>
                        </div>
                      ))}
                      {inProgressIssues.length > 4 && (
                        <div className="text-[10px] text-lira-muted text-right font-medium">
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
    </>
  );
}
