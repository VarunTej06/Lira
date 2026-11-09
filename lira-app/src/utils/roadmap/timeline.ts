import { type Zoom, type RoadmapItem, type Roadmap } from './types';
import { parseDay, addDays, daysBetween } from './dates';

/** Timeline scale, header cells and swimlane layout. */
export const PX_PER_DAY: Record<Zoom, number> = { weeks: 22, months: 9, quarters: 3 };

interface TimeRange { start: Date; end: Date; days: number }

/** Visible range: covers every item and milestone, padded, snapped to whole months. */
export function computeRange(rm: Roadmap, today = new Date(), extra: Date[] = []): TimeRange {
  const dates: Date[] = [today, ...extra];
  rm.items.forEach(i => { dates.push(parseDay(i.start), parseDay(i.end)); });
  rm.milestones.forEach(m => dates.push(parseDay(m.date)));
  const min = new Date(Math.min(...dates.map(d => d.getTime())));
  const max = new Date(Math.max(...dates.map(d => d.getTime())));
  const start = new Date(min.getFullYear(), min.getMonth(), 1);
  const end = new Date(max.getFullYear(), max.getMonth() + 2, 0); // end of the month after the last date
  return { start, end, days: daysBetween(start, end) + 1 };
}

export const xOf = (range: TimeRange, d: Date, ppd: number) => daysBetween(range.start, d) * ppd;

interface HeaderCell { label: string; x: number; width: number }

/** Two header rows: bigger periods on top (year / quarter), finer below (month / week). */
export function buildHeader(range: TimeRange, zoom: Zoom): { top: HeaderCell[]; bottom: HeaderCell[] } {
  const ppd = PX_PER_DAY[zoom];
  const top: HeaderCell[] = [];
  const bottom: HeaderCell[] = [];
  const cell = (label: string, from: Date, to: Date): HeaderCell => ({
    label, x: xOf(range, from, ppd), width: (daysBetween(from, to) + 1) * ppd,
  });
  const clampEnd = (d: Date) => (d > range.end ? range.end : d);

  if (zoom === 'weeks') {
    // top = months, bottom = weeks (Mondays)
    for (let m = new Date(range.start); m <= range.end; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      top.push(cell(m.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), m, clampEnd(new Date(m.getFullYear(), m.getMonth() + 1, 0))));
    }
    let w = new Date(range.start);
    while (w.getDay() !== 1) w = addDays(w, 1);
    for (; w <= range.end; w = addDays(w, 7)) bottom.push(cell(String(w.getDate()), w, clampEnd(addDays(w, 6))));
  } else if (zoom === 'months') {
    // top = years, bottom = months
    for (let y = range.start.getFullYear(); y <= range.end.getFullYear(); y++) {
      const from = y === range.start.getFullYear() ? range.start : new Date(y, 0, 1);
      const to = clampEnd(new Date(y, 11, 31));
      top.push(cell(String(y), from, to));
    }
    for (let m = new Date(range.start); m <= range.end; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      bottom.push(cell(m.toLocaleDateString('en-US', { month: 'short' }), m, clampEnd(new Date(m.getFullYear(), m.getMonth() + 1, 0))));
    }
  } else {
    // top = years, bottom = quarters
    for (let y = range.start.getFullYear(); y <= range.end.getFullYear(); y++) {
      const from = y === range.start.getFullYear() ? range.start : new Date(y, 0, 1);
      top.push(cell(String(y), from, clampEnd(new Date(y, 11, 31))));
    }
    for (let q = Math.floor(range.start.getMonth() / 3), y = range.start.getFullYear(); ; q++) {
      if (q === 4) { q = 0; y++; }
      const from = new Date(y, q * 3, 1);
      if (from > range.end) break;
      const clampedFrom = from < range.start ? range.start : from;
      bottom.push(cell(`Q${q + 1}`, clampedFrom, clampEnd(new Date(y, q * 3 + 3, 0))));
    }
  }
  return { top, bottom };
}

const LANE_H = 34;

const ROW_H = 40;

type LayoutRow =
  | { kind: 'lane'; lane: string; y: number; h: number; count: number }
  | { kind: 'item'; item: RoadmapItem; y: number; h: number };

/** Rows top to bottom: a header per swimlane, then its items by start date. Collapsed lanes hide their items. */
export function layoutRows(items: RoadmapItem[], lanes: string[], collapsed: string[] = []): { rows: LayoutRow[]; height: number; yOf: Map<string, number> } {
  const rows: LayoutRow[] = [];
  const yOf = new Map<string, number>();
  let y = 0;
  const allLanes = [...lanes, ...Array.from(new Set(items.map(i => i.lane))).filter(l => !lanes.includes(l))];
  for (const lane of allLanes) {
    const inLane = items.filter(i => i.lane === lane).sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
    if (inLane.length === 0 && !lanes.includes(lane)) continue;
    rows.push({ kind: 'lane', lane, y, h: LANE_H, count: inLane.length });
    y += LANE_H;
    if (collapsed.includes(lane)) continue;
    for (const item of inLane) {
      rows.push({ kind: 'item', item, y, h: ROW_H });
      yOf.set(item.id, y);
      y += ROW_H;
    }
  }
  return { rows, height: y, yOf };
}
