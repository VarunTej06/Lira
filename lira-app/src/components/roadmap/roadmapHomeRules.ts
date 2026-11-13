import type { Roadmap, roadmapSpan, summarize } from '../../utils/roadmapUtils';

export type Tab = 'active' | 'starred' | 'archived';
export type Sort = 'updated' | 'name' | 'progress';
export interface HomeCard { rm: Roadmap; summary: ReturnType<typeof summarize>; span: ReturnType<typeof roadmapSpan> }

const inTab = (rm: Roadmap, tab: Tab): boolean => (tab === 'archived' ? !!rm.archived : !rm.archived && (tab === 'starred' ? !!rm.starred : true));

const matches = (rm: Roadmap, query: string): boolean => !query || `${rm.name} ${rm.description || ''} ${rm.spaceKey || ''}`.toLowerCase().includes(query);

const SORTS: Record<Sort, (a: HomeCard, b: HomeCard) => number> = {
  name: (a, b) => a.rm.name.localeCompare(b.rm.name),
  progress: (a, b) => b.summary.percent - a.summary.percent,
  updated: (a, b) => (b.rm.updatedAt || b.rm.createdAt).localeCompare(a.rm.updatedAt || a.rm.createdAt),
};

/** The cards of the chosen tab that match the search (name, description or space key), in the chosen order. */
export function visibleCards(cards: HomeCard[], tab: Tab, sort: Sort, search: string): HomeCard[] {
  const q = search.trim().toLowerCase();
  return cards.filter(c => inTab(c.rm, tab)).filter(c => matches(c.rm, q)).sort(SORTS[sort]);
}

/** The four numbers above the cards, over roadmaps that are not archived. */
export function homeTotals(cards: HomeCard[]) {
  const active = cards.filter(c => !c.rm.archived);
  return {
    roadmaps: active.length,
    items: active.reduce((a, c) => a + c.summary.total, 0),
    percent: active.length ? Math.round(active.reduce((a, c) => a + c.summary.percent, 0) / active.length) : 0,
    attention: active.reduce((a, c) => a + c.summary.overdue + c.summary.byStatus.blocked, 0),
    counts: { active: active.length, starred: active.filter(c => c.rm.starred).length, archived: cards.length - active.length },
  };
}
