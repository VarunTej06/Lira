import { describe, expect, it } from 'vitest';
import { assigneeSummary, prioritySummary, spaceSummary, statusSummary, tagCount, tagSummary, typeSummary } from './facetSummaries';

describe('facet summaries', () => {
  it('say "All" with nothing chosen', () => {
    expect([spaceSummary([], {}), statusSummary([]), prioritySummary([]), typeSummary([]), assigneeSummary([]), tagSummary(0)])
      .toEqual(['Space: All', 'Status: All', 'Priority: All', 'Type: All', 'Assignee: All', 'Tags & Team']);
  });
  it('show the name of one space, a fallback when unknown, and a count for several', () => {
    expect(spaceSummary([1], { 1: { name: 'Alpha' } })).toBe('Alpha');
    expect(spaceSummary([9], {})).toBe('1 Space');
    expect(spaceSummary([1, 2], {})).toBe('2 Spaces');
  });
  it('show one status in capitals and several as a count', () => {
    expect(statusSummary(['todo'])).toBe('TODO');
    expect(statusSummary(['todo', 'done'])).toBe('2 Statuses');
  });
  it('count chosen priorities, types and assignees', () => {
    expect(prioritySummary(['a', 'b'])).toBe('2 Selected');
    expect(typeSummary(['bug'])).toBe('1 Types');
    expect(assigneeSummary(['VY', 'AB', 'CD'])).toBe('3 Assignees');
  });
  it('count labels plus the team', () => {
    expect(tagCount([], 'all')).toBe(0);
    expect(tagCount(['a'], 'Core')).toBe(2);
    expect(tagSummary(2)).toBe('2 Active');
  });
});
