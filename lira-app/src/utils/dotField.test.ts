import { describe, expect, it } from 'vitest';
import { BASE_ALPHA, DOT_GAP, GLOW_RADIUS, PEAK_ALPHA, dotAlpha, dotGrid, dotLight } from './dotField';

describe('dotLight', () => {
  it('is full at the pointer and nothing at or beyond the radius', () => {
    expect(dotLight(0)).toBe(1);
    expect(dotLight(GLOW_RADIUS)).toBe(0);
    expect(dotLight(GLOW_RADIUS * 3)).toBe(0);
  });

  it('only gets dimmer as the distance grows', () => {
    let last = 2;
    for (let d = 0; d <= GLOW_RADIUS; d += 10) {
      const v = dotLight(d);
      expect(v).toBeLessThanOrEqual(last);
      last = v;
    }
  });

  it('stays between 0 and 1 for odd input', () => {
    for (const d of [-50, 0.5, 64, Number.NaN, Infinity]) {
      const v = dotLight(d);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('dotAlpha', () => {
  it('rests at the faint level with no pointer, and peaks under it', () => {
    expect(dotAlpha(10, 10, null)).toBe(BASE_ALPHA);
    expect(dotAlpha(10, 10, { x: 10, y: 10 })).toBeCloseTo(PEAK_ALPHA);
  });

  it('is back to the faint level far from the pointer', () => {
    expect(dotAlpha(0, 0, { x: 1000, y: 1000 })).toBe(BASE_ALPHA);
  });
});

describe('dotGrid', () => {
  it('fits dots across an area, edge to edge', () => {
    expect(dotGrid(DOT_GAP * 10, DOT_GAP * 4)).toEqual({ cols: 11, rows: 5 });
  });

  it('has no dots for an empty or negative area', () => {
    expect(dotGrid(0, 0)).toEqual({ cols: 1, rows: 1 });
    expect(dotGrid(-100, -100)).toEqual({ cols: 0, rows: 0 });
  });
});
