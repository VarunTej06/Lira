import { describe, expect, it } from 'vitest';
import { scrollEdge } from './scrollEdge';

describe('scrollEdge', () => {
  it('is at the start before any scrolling', () => {
    expect(scrollEdge(0, 400, 1200)).toBe('start');
    expect(scrollEdge(1, 400, 1200)).toBe('start');
  });

  it('is in the middle between the ends', () => {
    expect(scrollEdge(300, 400, 1200)).toBe('middle');
  });

  it('is at the end when the right edge is reached, even with a fraction of a pixel left', () => {
    expect(scrollEdge(800, 400, 1200)).toBe('end');
    expect(scrollEdge(799, 400, 1200)).toBe('end');
    expect(scrollEdge(790, 400, 1200)).toBe('middle');
  });

  it('counts as the start when everything already fits', () => {
    expect(scrollEdge(0, 400, 400)).toBe('start');
    expect(scrollEdge(0, 400, 401)).toBe('start');
  });
});
