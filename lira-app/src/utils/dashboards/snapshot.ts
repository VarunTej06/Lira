import { evaluateGoal, METRICS, scopeIssues, type DataCtx } from './metrics';
import { widgetData, widgetFilters, widgetScope, type WidgetData } from './data';
import type { Dashboard, SnapshotSchedule } from './types';
import { sprintName } from '../sprintUtils';

/**
 * The weekly snapshot: the dashboard written as a Markdown file in data/snapshots/.
 * "Scheduled" means: while Lira is open, when the chosen day and hour have passed and no snapshot was taken since,
 * one is taken (so a snapshot missed because Lira was closed is taken the next time it opens).
 */

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DEFAULT_SCHEDULE: SnapshotSchedule = { enabled: false, day: 1, hour: 9 };

/** The most recent moment the schedule says a snapshot should have been taken. */
export function lastScheduledMoment(s: SnapshotSchedule, now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), s.hour, 0, 0, 0);
  d.setDate(d.getDate() - ((now.getDay() - s.day + 7) % 7));
  if (d.getTime() > now.getTime()) d.setDate(d.getDate() - 7);
  return d;
}

export function nextScheduledMoment(s: SnapshotSchedule, now: Date): Date {
  const last = lastScheduledMoment(s, now);
  const next = new Date(last);
  next.setDate(next.getDate() + 7);
  return next;
}

/** A snapshot is due when the schedule is on and the latest scheduled moment has passed without one. */
export function snapshotDue(s: SnapshotSchedule | undefined, now: Date): boolean {
  if (!s?.enabled) return false;
  const last = lastScheduledMoment(s, now).getTime();
  const ran = s.lastRun ? new Date(s.lastRun).getTime() : 0;
  return ran < last;
}

export function snapshotFileName(d: Pick<Dashboard, 'id' | 'name'>, now: Date): string {
  const slug = d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'dashboard';
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `${slug}-${day}.md`;
}

const esc = (s: string) => s.replace(/\|/g, '\\|');

function dataMarkdown(w: { title: string }, data: WidgetData): string[] {
  const out: string[] = [`### ${w.title}`, ''];
  switch (data.kind) {
    case 'stat': {
      const r = data.result;
      const t = r.trend === undefined || r.trend === 0 ? '' : ` (${r.trend > 0 ? '+' : ''}${r.trend} vs 7 days ago)`;
      out.push(`**${r.value}${r.suffix}**${t}`);
      break;
    }
    case 'groups': data.groups.forEach(g => out.push(`- ${g.label}: ${g.value}${data.measure === 'points' ? ' points' : ''}`)); if (!data.groups.length) out.push('_Nothing to show._'); break;
    case 'series': out.push('| Week ending | Created | Finished | Open |', '| --- | --- | --- | --- |', ...data.points.map(p => `| ${p.label} | ${p.created} | ${p.done} | ${p.open} |`)); break;
    case 'burn': {
      const last = data.points[data.points.length - 1];
      out.push(last ? `${sprintName(data.sprint)}: ${last.donePoints} of ${last.scopePoints} points done (${last.done} of ${last.scope} tickets).` : `${sprintName(data.sprint)} has not started.`);
      break;
    }
    case 'cfd': {
      const last = data.points[data.points.length - 1];
      out.push(last ? `${sprintName(data.sprint)} today: backlog ${last.backlog}, to do ${last.todo}, in progress ${last.inprogress}, done ${last.done}.` : `${sprintName(data.sprint)} has not started.`);
      break;
    }
    case 'rows': data.rows.forEach(r => out.push(`- ${r.issue.key} ${r.issue.title} (${r.note})`)); if (!data.rows.length) out.push('_Nothing here._'); else if (data.total > data.rows.length) out.push(`- ...and ${data.total - data.rows.length} more`); break;
    case 'blocked': data.rows.forEach(r => out.push(`- ${r.issue.key} ${r.issue.title}: blocked by ${r.blockers.map(b => b.key).join(', ') || 'unknown'} for ${r.days}d`)); if (!data.rows.length) out.push('_Nothing is blocked._'); break;
    case 'progress': data.rows.forEach(r => out.push(`- ${r.label}: ${r.done}/${r.total} (${r.percent}%)`)); if (!data.rows.length) out.push('_Nothing to show._'); break;
    case 'workload': out.push('| Person | Open | Points | In progress | Blocked | Overdue |', '| --- | --- | --- | --- | --- | --- |', ...data.rows.map(r => `| ${esc(r.name)}${r.overloaded ? ' (overloaded)' : ''} | ${r.open} | ${r.points} | ${r.inProgress} | ${r.blocked} | ${r.overdue} |`)); break;
    case 'due': data.days.filter(d => d.count).forEach(d => out.push(`- ${d.date.toDateString()}: ${d.count} due`)); if (!data.days.some(d => d.count)) out.push('_Nothing due in the next 14 days._'); break;
    case 'roadmap': data.rows.forEach(r => out.push(`- ${r.roadmap}: ${r.title} is ${r.status} (${r.progress}%, ends ${r.end})`)); if (!data.rows.length) out.push('_No roadmap items._'); break;
    case 'summary': data.lines.forEach(l => out.push(`- ${l}`)); break;
  }
  out.push('');
  return out;
}

export function describeFilters(d: Pick<Dashboard, 'filters'>, ctx: Pick<DataCtx, 'spaces'>): string {
  const f = d.filters;
  const parts: string[] = [];
  parts.push(f.spaceIds.length ? `spaces: ${f.spaceIds.map(id => ctx.spaces.find(s => s.id === id)?.name ?? id).join(', ')}` : 'all spaces');
  if (f.sprint !== 'all') parts.push(f.sprint === 'current' ? 'current sprint' : `sprint ${f.sprint}`);
  if (f.range !== 'all') parts.push(`finished work from the last ${f.range.replace('d', ' days')}`);
  if (f.assignee !== 'all') parts.push(f.assignee === 'me' ? 'assigned to me' : f.assignee === 'unassigned' ? 'unassigned' : `assigned to ${f.assignee}`);
  if (f.types.length) parts.push(`types: ${f.types.join(', ')}`);
  if (f.priorities.length) parts.push(`priority: ${f.priorities.join(', ')}`);
  if (f.labels.length) parts.push(`labels: ${f.labels.join(', ')}`);
  return parts.join(' · ');
}

export function snapshotMarkdown(d: Dashboard, ctx: DataCtx): string {
  const lines: string[] = [`# ${d.name}`, '', `Snapshot taken ${ctx.now.toLocaleString()}`, '', `Scope: ${describeFilters(d, ctx)}`, ''];
  const breached = d.goals.map(g => evaluateGoal(g, scopeIssues(ctx.issues, d.filters, ctx), ctx.now));
  if (breached.length) {
    lines.push('## Alerts', '');
    breached.forEach(b => lines.push(`- ${b.breached ? 'ALERT' : 'ok'}: ${b.text}`));
    lines.push('');
  }
  lines.push('## Widgets', '');
  d.widgets.forEach(w => lines.push(...dataMarkdown(w, widgetData(d, w, ctx))));
  return lines.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

export async function saveSnapshotFile(name: string, markdown: string): Promise<{ ok: boolean; file?: string }> {
  try {
    const res = await fetch('/api/snapshot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, markdown }) });
    if (!res.ok) return { ok: false };
    const j = await res.json();
    return { ok: true, file: j.file };
  } catch { return { ok: false }; }
}

export async function listSnapshotFiles(): Promise<{ file: string; size: number; modified: string }[]> {
  try {
    const res = await fetch('/api/snapshots');
    if (!res.ok) return [];
    return (await res.json()).files ?? [];
  } catch { return []; }
}

/** Downloads text as a file (works without the server). */
export function downloadText(name: string, text: string, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export { widgetFilters, widgetScope, METRICS };
