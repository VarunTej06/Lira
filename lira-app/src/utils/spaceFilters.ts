import type { Issue } from '../types/issue';

/** The filters of a space (Priority, Status and Labels dropdowns). Empty means "no filter". */
export interface SpaceFilters { priorities: string[]; labels: string[]; statuses?: string[] }

export const EMPTY_SPACE_FILTERS: SpaceFilters = { priorities: [], labels: [], statuses: [] };

/**
 * A ticket passes the Status filter when its status is chosen, or when "Blocked" is chosen and the ticket is
 * switched to Blocked (Blocked is a switch on the ticket, not a status).
 */
export function matchesStatusFilter(issue: Pick<Issue, 'status' | 'blocked'>, statuses?: string[]): boolean {
  if (!statuses || statuses.length === 0) return true;
  return statuses.includes(issue.status) || (!!issue.blocked && statuses.includes('blocked'));
}
