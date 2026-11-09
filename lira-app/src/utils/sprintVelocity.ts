import type { Issue } from '../types/issue';
import { issuesInSprint, sprintPhase, sprintStats } from './sprintUtils';

/**
 * The last six sprints that have started, with their ticket counts; the biggest total (at least 1, for bar heights);
 * and the average done per sprint that has ended and had tickets (0 when there is none).
 */
export function sprintVelocity(keys: string[], scoped: Issue[]) {
  const rows = keys.filter(k => sprintPhase(k) !== 'upcoming').slice(-6).map(k => ({ key: k, ...sprintStats(issuesInSprint(scoped, k)) }));
  const closed = rows.filter(r => sprintPhase(r.key) === 'past' && r.total > 0);
  return {
    rows,
    max: Math.max(1, ...rows.map(r => r.total)),
    avg: closed.length ? Math.round(closed.reduce((sum, r) => sum + r.done, 0) / closed.length) : 0,
  };
}
