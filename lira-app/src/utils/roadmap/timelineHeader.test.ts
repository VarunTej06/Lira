import { describe, expect, it } from 'vitest';
import { PX_PER_DAY, buildHeader } from './timeline';

const range = (start: Date, end: Date) => ({ start, end, days: Math.round((end.getTime() - start.getTime()) / 86400000) + 1 });

describe('buildHeader', () => {
  describe('weeks', () => {
    const r = range(new Date(2026, 10, 1), new Date(2026, 11, 31)); // 1 Nov to 31 Dec 2026
    const h = buildHeader(r, 'weeks');

    it('shows the months on top', () => {
      expect(h.top.map(c => c.label)).toEqual(['November 2026', 'December 2026']);
      expect(h.top[0].x).toBe(0);
    });

    it('shows each Monday below, by its day of the month', () => {
      expect(h.bottom.map(c => c.label)).toEqual(['2', '9', '16', '23', '30', '7', '14', '21', '28']);
    });

    it('draws each week seven days wide, and the last one cut at the end of the range', () => {
      const ppd = PX_PER_DAY.weeks;
      expect(h.bottom[0].width).toBe(7 * ppd);
      const last = h.bottom[h.bottom.length - 1]; // Monday 28 Dec: only 4 days left in the range
      expect(last.width).toBe(4 * ppd);
    });

    it('lays the cells out left to right without overlap', () => {
      for (let k = 1; k < h.bottom.length; k++) expect(h.bottom[k].x).toBe(h.bottom[k - 1].x + h.bottom[k - 1].width);
    });
  });

  describe('quarters', () => {
    const r = range(new Date(2026, 10, 15), new Date(2027, 4, 10)); // mid Nov 2026 to 10 May 2027
    const h = buildHeader(r, 'quarters');

    it('shows the years on top and the quarters below', () => {
      expect(h.top.map(c => c.label)).toEqual(['2026', '2027']);
      expect(h.bottom.map(c => c.label)).toEqual(['Q4', 'Q1', 'Q2']);
    });

    it('cuts the first quarter at the start of the range and the last at its end', () => {
      const ppd = PX_PER_DAY.quarters;
      expect(h.bottom[0].x).toBe(0);
      expect(h.bottom[0].width).toBe(47 * ppd); // 15 Nov to 31 Dec
      const last = h.bottom[2]; // 1 Apr to 10 May
      expect(last.width).toBe(40 * ppd);
    });

    it('starts in the middle of a year correctly', () => {
      expect(buildHeader(range(new Date(2026, 1, 1), new Date(2026, 1, 28)), 'quarters').bottom.map(c => c.label)).toEqual(['Q1']);
    });
  });

  describe('months', () => {
    it('shows the years on top and the months below', () => {
      const h = buildHeader(range(new Date(2026, 10, 1), new Date(2027, 0, 31)), 'months');
      expect(h.top.map(c => c.label)).toEqual(['2026', '2027']);
      expect(h.bottom.map(c => c.label)).toEqual(['Nov', 'Dec', 'Jan']);
    });
  });
});
