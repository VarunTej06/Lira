import type { Issue } from '../types/issue';

const percent = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
const count = (issues: Issue[], test: (i: Issue) => boolean) => issues.filter(test).length;
const touched = (i: Issue) => new Date(i.updatedAt || i.createdAt).getTime();

/** The numbers shown on a space's Summary page. */
export function summaryStats(issues: Issue[], now = new Date()) {
  const total = issues.length;
  const done = count(issues, i => i.status === 'done');

  const priorityCounts: Record<string, number> = {};
  for (const i of issues) priorityCounts[i.priority] = (priorityCounts[i.priority] ?? 0) + 1;

  const labelCounts: Record<string, number> = {};
  for (const label of issues.flatMap(i => i.labels ?? [])) labelCounts[label] = (labelCounts[label] ?? 0) + 1;

  const epicProgress = issues.filter(i => i.type === 'epic').map(epic => {
    const children = issues.filter(i => i.parentId === epic.id || i.epicId === epic.id);
    const completedChildren = count(children, i => i.status === 'done');
    const progress = children.length > 0 ? percent(completedChildren, children.length) : (epic.status === 'done' ? 100 : 0);
    return { epic, totalChildren: children.length, completedChildren, progress };
  });

  return {
    total,
    done,
    inProgress: count(issues, i => i.status === 'inprogress'),
    blocked: count(issues, i => !!i.blocked),
    todo: count(issues, i => i.status === 'todo'),
    backlog: count(issues, i => i.status === 'backlog'),
    overdue: count(issues, i => i.status !== 'done' && !!i.dueDate && new Date(i.dueDate) < now),
    completionRate: percent(done, total),
    priorityCounts,
    highPriorityIssues: issues.filter(i => (i.priority === 'highest' || i.priority === 'high') && i.status !== 'done').slice(0, 5),
    recentlyUpdated: [...issues].sort((a, b) => touched(b) - touched(a)).slice(0, 5),
    epicProgress,
    topLabels: Object.entries(labelCounts).sort((a, b) => b[1] - a[1]).slice(0, 8),
  };
}
