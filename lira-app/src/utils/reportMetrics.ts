import type { Issue } from '../types/issue';

/** The share of `total` that `n` is, as a whole percent; 0 when there is no total. */
export const pct = (n: number, total: number): number => (total > 0 ? Math.round((n / total) * 100) : 0);

/** How many times each value appears. */
export const tally = (values: string[]): Record<string, number> => values.reduce<Record<string, number>>((acc, v) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }), {});

const sumPoints = (list: Issue[]): number => list.reduce((sum, i) => sum + (i.storyPoints || 0), 0);

/** The numbers on the Reports screen. `blocked` in byStatus counts the blocked flag, not a status. */
export function reportMetrics(issues: Issue[]) {
  const total = issues.length;
  const byStatus: Record<string, number> = { ...tally(issues.map(i => i.status)), blocked: issues.filter(i => i.blocked).length };
  const byPriority = tally(issues.map(i => i.priority));
  const totalPoints = sumPoints(issues);
  const donePoints = sumPoints(issues.filter(i => i.status === 'done'));
  const done = byStatus.done ?? 0;
  const inProgress = byStatus.inprogress ?? 0;
  return {
    total, byStatus, byPriority, totalPoints, donePoints, done, inProgress,
    completionRate: pct(done, total), inFlightRate: pct(inProgress, total), pointsRate: pct(donePoints, totalPoints),
    critical: (byPriority.highest ?? 0) + (byPriority.high ?? 0),
  };
}

/** One sentence about how far along the work is, by completion rate. */
export function progressNote(completionRate: number): string {
  if (completionRate >= 75) return 'Excellent velocity! Over 75% of scheduled work items have been marked as done.';
  if (completionRate >= 40) return 'Steady progression. Active tasks are transitioning smoothly through development.';
  return 'Early sprint phase. Focus on clearing In Progress bottlenecks to increase velocity.';
}
