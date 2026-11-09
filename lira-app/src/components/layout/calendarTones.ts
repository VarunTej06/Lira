import type { Issue } from '../../types/issue';

/** Colour of a ticket chip: done, blocked, in progress, urgent, or the rest. */
export const chipTone = (issue: Issue): string => {
  if (issue.status === 'done') return 'border-l-emerald-500 bg-emerald-500/10';
  if (issue.blocked) return 'border-l-red-600 bg-red-600/15';
  if (issue.status === 'inprogress') return 'border-l-blue-500 bg-blue-500/10';
  if (issue.priority === 'highest' || issue.priority === 'high') return 'border-l-red-500 bg-red-500/10';
  return 'border-l-slate-400 bg-slate-500/10';
};

/** Background of a day cell: a drop target while dragging over it, today, days of other months, weekends, or plain. */
export function dayTone(opts: { dragOver: boolean; today: boolean; inMonth: boolean; weekend: boolean }): string {
  if (opts.dragOver) return 'bg-lira-blue-light ring-2 ring-lira-blue ring-inset z-10';
  if (opts.today) return 'bg-lira-blue-light/50';
  if (!opts.inMonth) return 'bg-gray-50/70';
  return opts.weekend ? 'bg-gray-50/40' : 'bg-white';
}

/** The round number of a day: filled for today, dark in this month, dim outside it. */
export const dayNumberTone = (today: boolean, inMonth: boolean): string =>
  today ? 'bg-lira-blue text-white font-bold shadow-xs' : inMonth ? 'text-lira-text font-semibold' : 'text-lira-muted';
