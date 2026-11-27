import { describe, expect, it } from 'vitest';
import { EMPTY_SPACE_FILTERS, matchesStatusFilter } from './spaceFilters';

describe('filters of a space', () => {
  it('lets every ticket through when no status is chosen', () => {
    expect(matchesStatusFilter({ status: 'todo' })).toBe(true);
    expect(matchesStatusFilter({ status: 'todo' }, [])).toBe(true);
    expect(EMPTY_SPACE_FILTERS).toEqual({ priorities: [], labels: [], statuses: [] });
  });
  it('lets through the tickets whose status is chosen, and no others', () => {
    expect(matchesStatusFilter({ status: 'done' }, ['done', 'todo'])).toBe(true);
    expect(matchesStatusFilter({ status: 'inprogress' }, ['done', 'todo'])).toBe(false);
  });
  it('counts a ticket switched to Blocked when Blocked is chosen, whatever its status, and not otherwise', () => {
    expect(matchesStatusFilter({ status: 'inprogress', blocked: true }, ['blocked'])).toBe(true);
    expect(matchesStatusFilter({ status: 'inprogress', blocked: false }, ['blocked'])).toBe(false);
    expect(matchesStatusFilter({ status: 'inprogress' }, ['blocked'])).toBe(false);
    expect(matchesStatusFilter({ status: 'done', blocked: true }, ['todo'])).toBe(false);
  });
});
