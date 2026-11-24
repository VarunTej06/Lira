import type { Issue } from '../types/issue';
import { ticketsInScope, type StoryBox } from './storybox';

/** What a box has produced: how many tickets it sized and their points together. */
export interface BoxSummary { sized: number; points: number }

export interface BoxRow { box: StoryBox; total: number; sized: number; points: number; percent: number }
export interface Headline { open: number; closed: number; sized: number; points: number }

/** The local edition keeps its rounds in the box, so what it sized is read from there. */
export function localSummary(box: StoryBox): BoxSummary {
  const done = Object.values(box.localRounds ?? {}).filter(r => r.finalPoints !== undefined);
  return { sized: done.length, points: done.reduce((sum, r) => sum + (r.finalPoints ?? 0), 0) };
}

/** One line for each box with the tickets it is about, what it has sized, and how far along it is (never above 100). */
export function boxRows(boxes: readonly StoryBox[], issues: readonly Issue[], summaries: ReadonlyMap<string, BoxSummary>): BoxRow[] {
  return boxes.map(box => {
    const total = ticketsInScope(issues, box.scope).length;
    const { sized, points } = summaries.get(box.id) ?? { sized: 0, points: 0 };
    return { box, total, sized, points, percent: total === 0 ? 0 : Math.min(100, Math.round((sized / total) * 100)) };
  });
}

export function headline(rows: readonly BoxRow[]): Headline {
  return {
    open: rows.filter(r => r.box.status === 'open').length, closed: rows.filter(r => r.box.status === 'closed').length,
    sized: rows.reduce((sum, r) => sum + r.sized, 0), points: rows.reduce((sum, r) => sum + r.points, 0),
  };
}

/** The boxes that have sized something, oldest first, up to six, for the chart of points per box. */
export const chartRows = (rows: readonly BoxRow[]): BoxRow[] =>
  rows.filter(r => r.points > 0).sort((a, b) => a.box.createdAt.localeCompare(b.box.createdAt)).slice(-6);
