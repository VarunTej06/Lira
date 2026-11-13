import type { Issue } from '../../types/issue';
import { STATUS_META, type RoadmapStatus, type RoadmapMilestone, type Roadmap } from './types';
import { parseDay, daysBetween } from './dates';
import { resolveItem } from './progress';

/** Roadmap summary numbers and CSV export. */
interface RoadmapSummary {
  total: number;
  byStatus: Record<RoadmapStatus, number>;
  percent: number;          // average progress, weighted by duration
  nextMilestone?: RoadmapMilestone;
  daysToNextMilestone?: number;
  overdue: number;
}

export function summarize(rm: Roadmap, issues: Issue[] = [], today = new Date()): RoadmapSummary {
  const byStatus: Record<RoadmapStatus, number> = { planned: 0, inprogress: 0, done: 0, atrisk: 0, blocked: 0 };
  let weight = 0;
  let weighted = 0;
  let overdue = 0;
  for (const item of rm.items) {
    const { progress: p, status: s } = resolveItem(item, issues, today);
    byStatus[s]++;
    if (s === 'atrisk') overdue++;
    const w = Math.max(1, daysBetween(parseDay(item.start), parseDay(item.end)) + 1);
    weight += w;
    weighted += w * (s === 'done' ? 100 : p);
  }
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const upcoming = rm.milestones.filter(m => parseDay(m.date) >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
  return {
    total: rm.items.length,
    byStatus,
    percent: weight ? Math.round(weighted / weight) : 0,
    nextMilestone: upcoming,
    daysToNextMilestone: upcoming ? daysBetween(t, parseDay(upcoming.date)) : undefined,
    overdue,
  };
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rm: Roadmap, issues: Issue[] = [], today = new Date()): string {
  const head = ['Lane', 'Title', 'Status', 'Start', 'End', 'Progress %', 'Owner', 'Depends on', 'Epic'];
  const titleOf = new Map(rm.items.map(i => [i.id, i.title]));
  const lines = rm.items
    .slice()
    .sort((a, b) => rm.lanes.indexOf(a.lane) - rm.lanes.indexOf(b.lane) || a.start.localeCompare(b.start))
    .map(i => {
      const r = resolveItem(i, issues, today);
      return [i.lane, i.title, STATUS_META[r.status].label, i.start, i.end, r.progress, i.owner || '',
        i.deps.map(d => titleOf.get(d) || d).join('; '), i.epicKey || ''].map(csvCell).join(',');
    });
  return [head.join(','), ...lines].join('\n');
}
