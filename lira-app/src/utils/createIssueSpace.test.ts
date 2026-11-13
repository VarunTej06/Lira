import { describe, expect, it } from 'vitest';
import type { Space } from '../types/space';
import { spaceForCreate } from './createIssueSpace';

const sp = (id: number) => ({ id, key: `S${id}`, name: `S${id}` }) as Space;
const spaces = [sp(1), sp(2), sp(3)];

describe('spaceForCreate', () => {
  it('uses the space on screen when nothing else is asked', () => {
    expect(spaceForCreate(spaces, spaces[0])).toBe(spaces[0]);
  });
  it('prefers the space the caller asked for', () => {
    expect(spaceForCreate(spaces, spaces[0], 2, 3)).toBe(spaces[1]);
  });
  it('uses the space of the project on screen otherwise', () => {
    expect(spaceForCreate(spaces, spaces[0], undefined, 3)).toBe(spaces[2]);
  });
  it('falls back to the space on screen when the named space is gone', () => {
    expect(spaceForCreate(spaces, spaces[0], 99)).toBe(spaces[0]);
    expect(spaceForCreate(spaces, spaces[0], undefined, 99)).toBe(spaces[0]);
  });
  it('is undefined when there is nothing to choose', () => {
    expect(spaceForCreate([], undefined)).toBeUndefined();
  });
});
