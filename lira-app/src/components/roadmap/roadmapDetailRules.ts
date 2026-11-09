import type { Roadmap, RoadmapItem, RoadmapMilestone } from '../../utils/roadmapUtils';
import { fmtDay, newId } from '../../utils/roadmapUtils';
import { appStorage } from '../../utils/appStorage';
import type { RoadmapPrefs } from './RoadmapToolbar';

const PREFS_KEY = 'lira_roadmap_prefs';
const DEFAULT_PREFS: RoadmapPrefs = { view: 'timeline', zoom: 'months', showDeps: true, collapsed: [] };

/** The saved view choices, or the defaults when nothing is saved or the saved text is broken. */
export function loadPrefs(): RoadmapPrefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(appStorage.get(PREFS_KEY) || '{}') };
  } catch { return { ...DEFAULT_PREFS }; }
}

export function savePrefs(prefs: RoadmapPrefs) {
  try { appStorage.set(PREFS_KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
}

/** The collapsed lanes after clicking one: collapsed becomes expanded and the other way round. */
export const toggledLane = (collapsed: string[], lane: string): string[] => (collapsed.includes(lane) ? collapsed.filter(l => l !== lane) : [...collapsed, lane]);

/** Everyone who owns an item, once each, in the order first seen. */
export const uniqueOwners = (items: RoadmapItem[]): string[] => Array.from(new Set(items.map(i => i.owner).filter(Boolean))) as string[];

/** Replaces the item with the same id, or adds it at the end; adds a lane when it is new. */
export function withItem(r: Roadmap, item: RoadmapItem, newLane?: string): Roadmap {
  const lanes = newLane && !r.lanes.includes(newLane) ? [...r.lanes, newLane] : r.lanes;
  const exists = r.items.some(i => i.id === item.id);
  return { ...r, lanes, items: exists ? r.items.map(i => (i.id === item.id ? item : i)) : [...r.items, item] };
}

/** Removes an item and every dependency on it. */
export const withoutItem = (r: Roadmap, id: string): Roadmap => ({ ...r, items: r.items.filter(i => i.id !== id).map(i => ({ ...i, deps: i.deps.filter(d => d !== id) })) });

/** Replaces the milestone with the same id or adds it (with an id if it has none). */
export const withMilestone = (r: Roadmap, m: RoadmapMilestone): Roadmap => ({
  ...r,
  milestones: r.milestones.some(x => x.id === m.id) ? r.milestones.map(x => (x.id === m.id ? m : x)) : [...r.milestones, { ...m, id: m.id || newId('ms') }],
});

/** "my-plan-2026-11-10.csv" */
export const csvFileName = (name: string, day: Date): string => `${name.replace(/\s+/g, '-').toLowerCase()}-${fmtDay(day)}.csv`;

/** Hands a text to the browser as a file download. */
export function downloadCsv(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
