import type { Issue } from '../types/issue';
import { descriptionToText } from './richText';

export type SearchSort = 'key' | 'title' | 'status' | 'priority' | 'updatedAt';

export interface SearchCriteria {
  query: string;
  spaces: number[];
  statuses: string[];
  priorities: string[];
  types: string[];
  assignees: string[];
  labels: string[];
  team: string; // 'all' or a team name
  recentOnly: boolean;
  sort: SearchSort;
  ascending: boolean;
}

const WEEK = 7 * 24 * 60 * 60 * 1000;
const PRIORITY_RANK: Record<string, number> = { highest: 5, high: 4, medium: 3, low: 2, lowest: 1 };
const touched = (i: Issue) => new Date(i.updatedAt || i.createdAt).getTime();
const any = <T,>(chosen: T[], test: (c: T[]) => boolean) => chosen.length === 0 || test(chosen);

/** What each sort option compares (before the ascending or descending switch). */
const SORTS: Record<SearchSort, (a: Issue, b: Issue) => number> = {
  key: (a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }),
  title: (a, b) => a.title.localeCompare(b.title),
  status: (a, b) => a.status.localeCompare(b.status),
  priority: (a, b) => (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0),
  updatedAt: (a, b) => touched(b) - touched(a),
};

/** True when there is no search text, or it appears in the key, title, description or a label. */
const matchesQuery = (i: Issue, q: string) => !q || i.key.toLowerCase().includes(q) || i.title.toLowerCase().includes(q) || descriptionToText(i.description).toLowerCase().includes(q) || !!i.labels?.some(l => l.toLowerCase().includes(q));

/** The tickets matching every chosen filter (a filter with nothing chosen lets everything through), in the chosen order. Blocked matches the flag. */
export function searchIssues(issues: Issue[], c: SearchCriteria, now = Date.now()): Issue[] {
  const q = c.query.trim().toLowerCase();
  return issues.filter(i =>
    (!c.recentOnly || touched(i) >= now - WEEK) &&
    matchesQuery(i, q) &&
    any(c.spaces, s => s.includes(i.spaceId)) &&
    any(c.statuses, s => s.includes(i.status) || (!!i.blocked && s.includes('blocked'))) &&
    any(c.priorities, p => p.includes(i.priority)) &&
    any(c.types, t => t.includes(i.type)) &&
    any(c.assignees, a => a.includes(i.assigneeInitials || i.assignee || 'UN')) &&
    (c.team === 'all' || i.team === c.team) &&
    any(c.labels, l => !!i.labels?.some(x => l.includes(x))),
  ).sort((a, b) => {
    const by = SORTS[c.sort](a, b);
    return c.ascending ? -by : by;
  });
}

/** The counts on the quick-filter buttons. */
export function presetCounts(issues: Issue[], now = Date.now()) {
  return {
    all: issues.length,
    open: issues.filter(i => i.status !== 'done').length,
    completed: issues.filter(i => i.status === 'done').length,
    recent: issues.filter(i => touched(i) >= now - WEEK).length,
  };
}

/** The values to offer in the filter lists: labels sorted, assignee initials (or names), and teams. */
export function facetOptions(issues: Issue[]) {
  return {
    labels: Array.from(new Set(issues.flatMap(i => i.labels ?? []))).sort(),
    assignees: Array.from(new Set(issues.map(i => i.assigneeInitials || i.assignee).filter((a): a is string => !!a))),
    teams: Array.from(new Set(issues.map(i => i.team).filter((t): t is string => !!t))),
  };
}

const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;

/** The filtered tickets as CSV text. */
export function issuesToCsv(issues: Issue[], spaceName: (spaceId: number) => string): string {
  const header = ['Key', 'Title', 'Space', 'Type', 'Status', 'Priority', 'Assignee', 'Labels', 'Updated'];
  const rows = issues.map(i => [
    i.key, i.title, spaceName(i.spaceId), i.type, i.status, i.priority, i.assignee || 'Unassigned', (i.labels || []).join(', '), new Date(i.updatedAt || i.createdAt).toLocaleDateString(),
  ].map(quote).join(','));
  return [header.join(','), ...rows].join('\n');
}
