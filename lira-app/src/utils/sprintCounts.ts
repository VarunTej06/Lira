import type { Issue } from '../types/issue';
import { issuesInSprint, sprintStats } from './sprintUtils';

/** For each sprint key, how many of its tickets are done and how many there are (shown next to the sprint in the sidebar). */
export function sprintCounts(issues: Issue[], keys: string[]): Record<string, { done: number; total: number }> {
  const out: Record<string, { done: number; total: number }> = {};
  keys.forEach(k => {
    const s = sprintStats(issuesInSprint(issues, k));
    out[k] = { done: s.done, total: s.total };
  });
  return out;
}
