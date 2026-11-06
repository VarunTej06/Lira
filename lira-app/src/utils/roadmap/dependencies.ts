import { type RoadmapItem } from './types';
import { parseDay, fmtDay, addDays } from './dates';

/** Dependencies between items, and moving or resizing an item. */
export interface DepIssue { from: string; to: string; kind: 'conflict' | 'cycle' | 'missing' }

/** Problems in the dependency graph: a dependency that finishes after its dependant starts, cycles, dangling ids. */
export function dependencyIssues(items: RoadmapItem[]): DepIssue[] {
  const byId = new Map(items.map(i => [i.id, i]));
  const out: DepIssue[] = [];
  for (const item of items) {
    for (const d of item.deps) {
      const dep = byId.get(d);
      if (!dep) { out.push({ from: d, to: item.id, kind: 'missing' }); continue; }
      if (dep.end >= item.start) out.push({ from: dep.id, to: item.id, kind: 'conflict' });
    }
  }
  // cycle detection (DFS)
  const state = new Map<string, 1 | 2>();
  const visit = (id: string, path: string[]) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) { out.push({ from: path[path.length - 1], to: id, kind: 'cycle' }); return; }
    state.set(id, 1);
    for (const d of byId.get(id)?.deps || []) if (byId.has(d)) visit(d, [...path, id]);
    state.set(id, 2);
  };
  items.forEach(i => visit(i.id, []));
  return out;
}

export const shiftItem = (item: RoadmapItem, days: number): RoadmapItem => ({
  ...item,
  start: fmtDay(addDays(parseDay(item.start), days)),
  end: fmtDay(addDays(parseDay(item.end), days)),
});

/** Move the start (edge 'start') or end (edge 'end') by days, keeping at least one day. */
export function resizeItem(item: RoadmapItem, edge: 'start' | 'end', days: number): RoadmapItem {
  if (edge === 'start') {
    const ns = addDays(parseDay(item.start), days);
    return { ...item, start: fmtDay(ns > parseDay(item.end) ? parseDay(item.end) : ns) };
  }
  const ne = addDays(parseDay(item.end), days);
  return { ...item, end: fmtDay(ne < parseDay(item.start) ? parseDay(item.start) : ne) };
}

let idCounter = 0;

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(idCounter++).toString(36)}`;
