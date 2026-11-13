import type { Issue } from '../types/issue';
import { parseDay, resolveItem, type Roadmap, type RoadmapItem, type RoadmapStatus } from './roadmapUtils';

export interface RoadmapFilter {
  search: string;
  status: 'all' | RoadmapStatus;
  lane: string;
  owner: string;
  period: 'all' | 'month' | 'quarter';
}

/** First and last day of this month, or of this three-month quarter. */
function periodRange(period: 'month' | 'quarter', today: Date): [Date, Date] {
  const y = today.getFullYear();
  const m = today.getMonth();
  if (period === 'month') return [new Date(y, m, 1), new Date(y, m + 1, 0)];
  const q = Math.floor(m / 3) * 3;
  return [new Date(y, q, 1), new Date(y, q + 3, 0)];
}

/** The roadmap items that match the search words, lane, owner, status and period (an item overlapping the period counts). */
export function filterRoadmapItems(roadmap: Roadmap, issues: Issue[], today: Date, f: RoadmapFilter): RoadmapItem[] {
  const q = f.search.trim().toLowerCase();
  const range = f.period === 'all' ? null : periodRange(f.period, today);
  return roadmap.items.filter(i =>
    (!q || `${i.title} ${i.description || ''} ${i.lane} ${i.epicKey || ''}`.toLowerCase().includes(q)) &&
    (f.lane === 'all' || i.lane === f.lane) &&
    (f.owner === 'all' || (i.owner || '') === f.owner) &&
    (f.status === 'all' || resolveItem(i, issues, today).status === f.status) &&
    (!range || (parseDay(i.end) >= range[0] && parseDay(i.start) <= range[1])),
  );
}
