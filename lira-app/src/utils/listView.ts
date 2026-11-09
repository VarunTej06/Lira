import type { Issue } from '../types/issue';
import { matchesStatusFilter, type SpaceFilters } from './spaceFilters';

/** Tickets whose key, title or assignee contain the (lower-case) search text and that pass the priority, status and label filters. */
export function filterListIssues(issues: Issue[], search: string, filters?: SpaceFilters): Issue[] {
  return issues.filter(issue =>
    (!search || [issue.key, issue.title, issue.assignee || ''].some(text => text.toLowerCase().includes(search))) &&
    (!filters?.priorities?.length || filters.priorities.includes(issue.priority)) &&
    matchesStatusFilter(issue, filters?.statuses) &&
    (!filters?.labels?.length || filters.labels.some(l => (issue.labels || []).includes(l))),
  );
}

/** Which rows a page shows: the page is kept between 1 and the last one; `start` and `end` are zero-based slice bounds. */
export function pageWindow(total: number, page: number, size: number) {
  const totalPages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * size;
  return { totalPages, current, start, end: Math.min(start + size, total) };
}
