import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeIssue, makeSpace } from '../test/factories';
import { canEditSpace, splitByAccess } from './spaceAccess';

const edition = vi.hoisted(() => ({ hosted: true }));
vi.mock('./edition', () => ({ isHosted: () => edition.hosted }));
afterEach(() => { edition.hosted = true; });

describe('who may change tickets of a space', () => {
  it('allows edit and manage, refuses view, and refuses when the level is not known', () => {
    expect(canEditSpace(makeSpace({ myLevel: 'edit' }))).toBe(true);
    expect(canEditSpace(makeSpace({ myLevel: 'manage' }))).toBe(true);
    expect(canEditSpace(makeSpace({ myLevel: 'view' }))).toBe(false);
    expect(canEditSpace(makeSpace({}))).toBe(false);
    expect(canEditSpace(undefined)).toBe(false);
  });
  it('allows everything in the local edition, which has one person', () => {
    edition.hosted = false;
    expect(canEditSpace(makeSpace({}))).toBe(true);
    expect(canEditSpace(undefined)).toBe(true);
  });
  it('splits tickets by the space they are in', () => {
    const spaces = [makeSpace({ id: 1, myLevel: 'edit' }), makeSpace({ id: 2, myLevel: 'view' })];
    const a = makeIssue({ id: 1, spaceId: 1 }); const b = makeIssue({ id: 2, spaceId: 2 }); const c = makeIssue({ id: 3, spaceId: 9 });
    expect(splitByAccess([a, b, c], spaces)).toEqual({ editable: [a], locked: [b, c] });
  });
});
