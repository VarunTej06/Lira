import { describe, expect, it } from 'vitest';
import { NO_ISSUES } from './emptyLists';

describe('the shared empty list of tickets', () => {
  it('is one list that stays the same list, and is empty', () => {
    expect(NO_ISSUES).toEqual([]);
    expect(NO_ISSUES).toBe(NO_ISSUES);
  });
});
