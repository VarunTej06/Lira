import React, { useMemo } from 'react';
import type { Issue } from '../../types/issue';
import { getIssueSprint, isDone, isSprintWork, sprintLabel, sprintPhase, sprintStart } from '../../utils/sprintUtils';

interface EpicTimelineProps {
  issues: Issue[];
  keys: string[];
  scope: 'all' | number;
  sprint: string;
  onIssueClick: (issue: Issue) => void;
  onPickSprint: (key: string) => void;
}

export interface EpicRow { epic: Issue; cells: Map<string, { total: number; done: number }>; first: number; last: number; total: number; done: number }

/** For each epic, how many of its tickets sit in each sprint. Epics with no tickets are left out. */
export function epicRows(issues: Issue[], keys: string[], scope: 'all' | number): EpicRow[] {
  const inScope = issues.filter(i => scope === 'all' || i.spaceId === scope);
  const order = new Map(keys.map((k, i) => [k, i]));
  const rows: EpicRow[] = [];
  for (const epic of inScope.filter(i => i.type === 'epic')) {
    const kids = inScope.filter(i => isSprintWork(i) && i.id !== epic.id && (i.parentId === epic.id || i.epicId === epic.id));
    if (!kids.length) continue;
    const cells = new Map<string, { total: number; done: number }>();
    for (const k of kids) {
      const key = getIssueSprint(k);
      const c = cells.get(key) ?? { total: 0, done: 0 };
      c.total++;
      if (isDone(k)) c.done++;
      cells.set(key, c);
    }
    const idx = [...cells.keys()].map(k => order.get(k)).filter((n): n is number => n !== undefined);
    if (!idx.length) continue;
    rows.push({ epic, cells, first: Math.min(...idx), last: Math.max(...idx), total: kids.length, done: kids.filter(isDone).length });
  }
  return rows.sort((a, b) => a.first - b.first || a.epic.key.localeCompare(b.epic.key));
}

/** Epics across the sprints: which sprints each epic's tickets are planned in, and how far along they are. */
export const EpicTimeline: React.FC<EpicTimelineProps> = ({ issues, keys, scope, sprint, onIssueClick, onPickSprint }) => {
  const rows = useMemo(() => epicRows(issues, keys, scope), [issues, keys, scope]);
  // only the sprints that matter: those with epic work, plus the one being viewed
  const used = new Set<string>([sprint]);
  rows.forEach(r => r.cells.forEach((_, k) => used.add(k)));
  const cols = keys.filter(k => used.has(k)).sort((a, b) => sprintStart(a).getTime() - sprintStart(b).getTime());

  if (!rows.length) {
    return <p className="bg-white border border-dashed border-jira-border rounded-xl py-12 text-center text-sm text-jira-muted">No epics with tickets yet. Link tickets to an epic and it will show up here.</p>;
  }

  return (
    <div className="bg-white border border-jira-border rounded-xl overflow-x-auto" data-testid="epic-timeline">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-jira-border">
            <th className="text-left text-xs font-semibold text-jira-muted px-3 py-2 sticky left-0 bg-gray-50 min-w-[220px]">Epic</th>
            {cols.map(k => (
              <th key={k} className="px-2 py-2 min-w-[84px]">
                <button onClick={() => onPickSprint(k)} className={`text-xs font-semibold cursor-pointer ${k === sprint ? 'text-jira-blue' : 'text-jira-muted hover:text-jira-text'}`}>
                  {sprintLabel(k, true)}
                </button>
                <div className="text-[9px] text-jira-muted font-normal">{sprintPhase(k) === 'active' ? 'now' : sprintPhase(k)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const pct = Math.round((r.done / r.total) * 100);
            return (
              <tr key={r.epic.id} className="border-b border-jira-border last:border-0">
                <td className="px-3 py-2 sticky left-0 bg-white">
                  <button onClick={() => onIssueClick(r.epic)} className="text-left cursor-pointer hover:underline">
                    <span className="text-xs text-jira-muted mr-1.5">{r.epic.key}</span>
                    <span className="text-jira-text">{r.epic.title}</span>
                  </button>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1 flex-1 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${pct}%` }} /></div>
                    <span className="text-[10px] text-jira-muted">{r.done}/{r.total}</span>
                  </div>
                </td>
                {cols.map(k => {
                  const c = r.cells.get(k);
                  const idx = keys.indexOf(k);
                  const inSpan = idx >= r.first && idx <= r.last;
                  return (
                    <td key={k} className="px-1 py-2 text-center">
                      {c ? (
                        <button
                          onClick={() => onPickSprint(k)}
                          title={`${c.done} of ${c.total} done in ${sprintLabel(k)}`}
                          className={`w-full rounded-md px-2 py-1 text-xs font-medium cursor-pointer ${c.done === c.total ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}
                        >
                          {c.done}/{c.total}
                        </button>
                      ) : inSpan ? <div className="h-1 rounded bg-gray-200 mx-1" aria-hidden /> : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
