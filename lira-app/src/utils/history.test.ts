import { describe, expect, it } from 'vitest';
import { push, redo, start, undo } from './history';

describe('undo and redo', () => {
  it('goes back and forward through what was done', () => {
    let h = start(['a']);
    h = push(h, ['a', 'b']); h = push(h, ['a', 'b', 'c']);
    expect(undo(h).present).toEqual(['a', 'b']);
    expect(undo(undo(h)).present).toEqual(['a']);
    expect(redo(undo(undo(h))).present).toEqual(['a', 'b']);
  });

  it('does nothing at either end', () => {
    const h = start(1);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it('forgets what was undone once something new is done, and ignores a change that changes nothing', () => {
    let h = push(push(start(1), 2), 3);
    h = push(undo(h), 9);
    expect(h.future).toEqual([]);
    expect(h.present).toBe(9);
    expect(push(h, 9)).toBe(h);
    expect(push(start({ a: 1 }), { a: 1 }).past).toEqual([]);
  });

  it('keeps only the newest states', () => {
    let h = start(0);
    for (let i = 1; i <= 10; i++) h = push(h, i, 3);
    expect(h.past).toEqual([7, 8, 9]);
    expect(h.present).toBe(10);
  });
});
