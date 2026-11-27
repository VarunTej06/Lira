import type { MindMap } from './mindmap';

export type MindTab = 'all' | 'starred';
export type MindSort = 'updated' | 'name' | 'ideas';
export interface MindStats { maps: number; ideas: number; tickets: number; recent: number }

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The headline numbers: maps, ideas in all of them, ideas linked to a ticket, and maps changed in the last seven days. */
export function mindStats(maps: readonly MindMap[], nowMs: number): MindStats {
  return {
    maps: maps.length, ideas: maps.reduce((sum, m) => sum + m.nodes.length, 0), tickets: maps.reduce((sum, m) => sum + m.nodes.filter(n => !!n.ticketKey).length, 0),
    recent: maps.filter(m => nowMs - Date.parse(m.updatedAt) <= WEEK_MS).length,
  };
}

const SORTS: Record<MindSort, (a: MindMap, b: MindMap) => number> = {
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  name: (a, b) => a.name.localeCompare(b.name),
  ideas: (a, b) => b.nodes.length - a.nodes.length,
};

/** The maps to show: the tab, the words (in the name or in any idea, any case), and the order. */
export function visibleMaps(maps: readonly MindMap[], tab: MindTab, query: string, sort: MindSort): MindMap[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return maps
    .filter(m => tab === 'all' || m.starred)
    .filter(m => { const hay = `${m.name} ${m.nodes.map(n => n.text).join(' ')}`.toLowerCase(); return words.every(w => hay.includes(w)); })
    .sort(SORTS[sort]);
}

/** A copy of a map with new ids all through, so it can be changed without touching the first. */
export function copyOf(map: MindMap, newId: () => string, now: string): MindMap {
  const ids = new Map(map.nodes.map(n => [n.id, newId()]));
  return { ...map, id: newId(), name: `${map.name} (copy)`.slice(0, 100), starred: false, createdAt: now, updatedAt: now, nodes: map.nodes.map(n => ({ ...n, id: ids.get(n.id)!, parentId: n.parentId === null ? null : ids.get(n.parentId)! })) };
}
