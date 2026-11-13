import type { Issue } from '../types/issue';
import { daysElapsed, getSprintMeta, isDone, issuesInSprint, sprintDays, sprintEnd, sprintKindLabel, sprintName, sprintPhase, sprintStart, sprintStats, type SprintMeta } from './sprintUtils';

/**
 * Sprint reports: burnup, cumulative flow, scope changes, cycle and lead time, and a Markdown / print export.
 * Everything here is pure: tickets in, numbers out.
 */

type FlowStatus = 'backlog' | 'todo' | 'inprogress' | 'done';
const FLOW_STATUSES: FlowStatus[] = ['backlog', 'todo', 'inprogress', 'done'];
/** A change made in the first day of a sprint is planning, not scope creep. */
const GRACE_DAYS = 1;

const toDate = (v: unknown): Date | undefined => {
  if (!v) return undefined;
  const d = v instanceof Date ? v : new Date(v as string);
  return Number.isNaN(d.getTime()) ? undefined : d;
};
const normStatus = (s: string | undefined): FlowStatus => {
  const v = (s || '').toLowerCase();
  return (FLOW_STATUSES as string[]).includes(v) ? (v as FlowStatus) : 'todo';
};
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const dayEnd = (key: string, n: number) => { const s = sprintStart(key); return new Date(s.getFullYear(), s.getMonth(), s.getDate() + n - 1, 23, 59, 59, 999); };

/** The date a ticket joined a sprint: when it was moved in, otherwise when it was created. */
export function joinedSprintAt(issue: Issue, key: string): Date {
  const name = sprintName(key);
  const moves = (issue.activity || []).filter(a => a.type === 'field_change' && a.newValue === name);
  const last = moves.map(a => toDate(a.createdAt)).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime()).pop();
  return last ?? toDate(issue.createdAt) ?? sprintStart(key);
}

/** What status a ticket had at the end of a given moment; null when it did not exist yet. */
export function statusAt(issue: Issue, t: Date): FlowStatus | null {
  const created = toDate(issue.createdAt);
  if (created && created > t) return null;
  const log = (issue.statusLog || []).map(e => ({ from: e.from, to: e.to, at: toDate(e.at) })).filter(e => e.at) as { from: string; to: string; at: Date }[];
  if (log.length) {
    const upTo = log.filter(e => e.at <= t);
    return normStatus(upTo.length ? upTo[upTo.length - 1].to : log[0].from);
  }
  // no recorded history (older tickets): done once resolved, otherwise the status it has now
  const resolved = toDate(issue.resolvedAt) ?? (isDone(issue) ? toDate(issue.updatedAt) : undefined);
  if (isDone(issue)) return resolved && resolved <= t ? 'done' : 'inprogress';
  return normStatus(issue.status);
}

export interface FlowPoint { day: number; date: Date; backlog: number; todo: number; inprogress: number; done: number }

/** Cumulative flow: how many tickets were in each status at the end of every day of the sprint, up to today. */
export function cumulativeFlow(list: Issue[], key: string): FlowPoint[] {
  const last = daysElapsed(key);
  const out: FlowPoint[] = [];
  for (let d = 1; d <= last; d++) {
    const t = dayEnd(key, d);
    const row: FlowPoint = { day: d, date: t, backlog: 0, todo: 0, inprogress: 0, done: 0 };
    for (const i of list) {
      if (joinedSprintAt(i, key) > t) continue; // not in the sprint yet
      const s = statusAt(i, t);
      if (s) row[s]++;
    }
    out.push(row);
  }
  return out;
}

export interface BurnupPoint { day: number; scope: number; done: number; scopePoints: number; donePoints: number }

/** Burnup: total scope (which can grow) against work completed, per day up to today. */
export function burnup(list: Issue[], key: string): BurnupPoint[] {
  const last = daysElapsed(key);
  const pts = (i: Issue) => i.storyPoints || 0;
  const out: BurnupPoint[] = [];
  for (let d = 1; d <= last; d++) {
    const t = dayEnd(key, d);
    const inScope = list.filter(i => joinedSprintAt(i, key) <= t);
    const done = inScope.filter(i => statusAt(i, t) === 'done');
    out.push({
      day: d, scope: inScope.length, done: done.length,
      scopePoints: inScope.reduce((a, i) => a + pts(i), 0), donePoints: done.reduce((a, i) => a + pts(i), 0),
    });
  }
  return out;
}

export interface ScopeChange { issue: Issue; kind: 'added' | 'removed' | 'carried'; at: Date }

/** The ticket joined the sprint after its first days: it was added. */
function addedChange(issue: Issue, key: string, grace: Date): ScopeChange | null {
  if ((issue.sprint || '') !== key) return null;
  const at = joinedSprintAt(issue, key);
  return at > grace && at <= sprintEnd(key) ? { issue, kind: 'added', at } : null;
}

/** The ticket's history says it left the sprint after its first days: it was removed, or carried over when the sprint closed. */
function leftChanges(issue: Issue, key: string, grace: Date, closed: Date | undefined): ScopeChange[] {
  const name = sprintName(key);
  const out: ScopeChange[] = [];
  for (const a of issue.activity || []) {
    if (a.type !== 'field_change' || a.oldValue !== name) continue;
    const at = toDate(a.createdAt);
    if (!at || at <= grace) continue;
    const carried = (!!closed && Math.abs(at.getTime() - closed.getTime()) < 60_000) || at > sprintEnd(key);
    out.push({ issue, kind: carried ? 'carried' : 'removed', at });
  }
  return out;
}

/** Tickets added after the first day of the sprint, and tickets taken out of it (or carried over when it closed). */
export function scopeChanges(all: Issue[], key: string, completedAt?: string): ScopeChange[] {
  const start = sprintStart(key);
  const grace = endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + GRACE_DAYS - 1));
  const closed = toDate(completedAt);
  return all
    .filter(i => i.type !== 'epic')
    .flatMap(i => [addedChange(i, key, grace), ...leftChanges(i, key, grace, closed)])
    .filter((c): c is ScopeChange => c !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

interface TimeStat { n: number; avg: number; median: number; max: number }
const stat = (xs: number[]): TimeStat => {
  if (!xs.length) return { n: 0, avg: 0, median: 0, max: 0 };
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  const round = (x: number) => Math.round(x * 10) / 10;
  return { n: s.length, avg: round(s.reduce((a, b) => a + b, 0) / s.length), median: round(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2), max: round(s[s.length - 1]) };
};

/** Average points finished per closed sprint over the last three that had points; null when there is no history. */
export function suggestedCapacity(scoped: Issue[], keys: string[]): number | null {
  const past = keys.filter(k => sprintPhase(k) === 'past').slice(-3)
    .map(k => sprintStats(issuesInSprint(scoped, k)).donePoints).filter(p => p > 0);
  return past.length ? Math.round(past.reduce((a, b) => a + b, 0) / past.length) : null;
}

const DAY = 86_400_000;
/** When work on a ticket started: the first move to In Progress. */
export function startedAt(issue: Issue): Date | undefined {
  const fromLog = (issue.statusLog || []).find(e => normStatus(e.to) === 'inprogress');
  if (fromLog) return toDate(fromLog.at);
  return (issue.activity || []).filter(a => a.type === 'status_change' && /in\s*progress/i.test(a.newValue || '')).map(a => toDate(a.createdAt)).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0];
}

/** Lead time = created → done. Cycle time = started → done. Both in days, for the done tickets only. */
export function leadAndCycle(list: Issue[]): { lead: TimeStat; cycle: TimeStat } {
  const lead: number[] = [], cycle: number[] = [];
  for (const i of list) {
    if (!isDone(i)) continue;
    const done = toDate(i.resolvedAt);
    const created = toDate(i.createdAt);
    if (!done || !created) continue;
    lead.push(Math.max(0, (done.getTime() - created.getTime()) / DAY));
    const started = startedAt(i);
    if (started && started <= done) cycle.push((done.getTime() - started.getTime()) / DAY);
  }
  return { lead: stat(lead), cycle: stat(cycle) };
}

export interface SprintReport {
  key: string;
  name: string;
  kind: string;
  start: Date;
  end: Date;
  days: number;
  stats: ReturnType<typeof sprintStats>;
  meta: SprintMeta;
  flow: FlowPoint[];
  burnup: BurnupPoint[];
  changes: ScopeChange[];
  times: ReturnType<typeof leadAndCycle>;
}

export function buildReport(list: Issue[], all: Issue[], key: string, spaceId: number | 'all'): SprintReport {
  const meta = getSprintMeta(spaceId, key);
  return {
    key, name: sprintName(key), kind: sprintKindLabel(key), start: sprintStart(key), end: sprintEnd(key), days: sprintDays(key),
    stats: sprintStats(list), meta, flow: cumulativeFlow(list, key), burnup: burnup(list, key),
    changes: scopeChanges(all.filter(i => spaceId === 'all' || i.spaceId === spaceId), key, meta.completedAt),
    times: leadAndCycle(list),
  };
}

const d = (x: Date) => x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function reportMarkdown(r: SprintReport): string {
  const L: string[] = [];
  const s = r.stats;
  L.push(`# ${r.name}`, '', `${r.kind} sprint · ${d(r.start)} – ${d(r.end)} · ${r.days} days · ${sprintPhase(r.key)}`);
  if (r.meta.goal) L.push('', `**Goal:** ${r.meta.goal}`);
  L.push('', '## Summary', '',
    `- Tickets: ${s.done} of ${s.total} done (${s.percent}%)`,
    `- Points: ${s.donePoints} of ${s.points} done`,
    `- Carried in from earlier sprints: ${s.carriedIn}`,
    `- Lead time: ${r.times.lead.n ? `${r.times.lead.avg} days average, ${r.times.lead.median} median (${r.times.lead.n} tickets)` : 'no finished tickets yet'}`,
    `- Cycle time: ${r.times.cycle.n ? `${r.times.cycle.avg} days average, ${r.times.cycle.median} median (${r.times.cycle.n} tickets)` : 'no data yet'}`);
  const bu = r.burnup[r.burnup.length - 1];
  if (bu) L.push('', '## Burnup', '', `On day ${bu.day}: ${bu.done} done of ${bu.scope} in scope (${bu.donePoints} of ${bu.scopePoints} points).`);
  const cf = r.flow[r.flow.length - 1];
  if (cf) L.push('', '## Cumulative flow (latest day)', '', '| Backlog | To Do | In Progress | Done |', '| --- | --- | --- | --- |', `| ${cf.backlog} | ${cf.todo} | ${cf.inprogress} | ${cf.done} |`);
  L.push('', '## Scope changes', '');
  if (!r.changes.length) L.push('No tickets were added or removed after the first day.');
  else for (const c of r.changes) L.push(`- ${d(c.at)} · ${c.kind === 'added' ? 'Added' : c.kind === 'carried' ? 'Carried over' : 'Removed'} · ${c.issue.key} ${c.issue.title}`);
  const retro = r.meta.retro;
  if (retro) {
    const list = (title: string, xs: string[]) => {
      L.push('', `### ${title}`, '');
      if (xs.length) xs.forEach(x => L.push(`- ${x}`));
      else L.push('_Nothing recorded._');
    };
    L.push('', '## Retrospective');
    list('What went well', retro.wentWell);
    list("What didn't", retro.didnt);
    L.push('', '### Actions', '');
    if (retro.actions.length) retro.actions.forEach(a => L.push(`- [${a.done ? 'x' : ' '}] ${a.text}`));
    else L.push('_No actions._');
  }
  return L.join('\n') + '\n';
}

const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A self-contained printable page (the browser's "Save as PDF" turns it into a PDF). */
export function reportHtml(r: SprintReport): string {
  const md = reportMarkdown(r).split('\n');
  const body: string[] = [];
  let inList = false;
  const close = () => { if (inList) { body.push('</ul>'); inList = false; } };
  let inTable = false;
  for (const line of md) {
    if (line.startsWith('| ')) {
      if (/^\| ---/.test(line)) continue;
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (!inTable) { close(); body.push('<table>'); inTable = true; body.push(`<tr>${cells.map(c => `<th>${esc(c)}</th>`).join('')}</tr>`); } else body.push(`<tr>${cells.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`);
      continue;
    }
    if (inTable) { body.push('</table>'); inTable = false; }
    if (line.startsWith('# ')) { close(); body.push(`<h1>${esc(line.slice(2))}</h1>`); }
    else if (line.startsWith('## ')) { close(); body.push(`<h2>${esc(line.slice(3))}</h2>`); }
    else if (line.startsWith('### ')) { close(); body.push(`<h3>${esc(line.slice(4))}</h3>`); }
    else if (line.startsWith('- ')) { if (!inList) { body.push('<ul>'); inList = true; } body.push(`<li>${esc(line.slice(2)).replace(/^\[( |x)\]/, m => (m === '[x]' ? '&#9745;' : '&#9744;'))}</li>`); }
    else if (line.trim()) { close(); body.push(`<p>${esc(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/_(.+?)_/g, '<em>$1</em>')}</p>`); }
  }
  close();
  if (inTable) body.push('</table>');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.name)} report</title><style>
body{font:14px/1.5 system-ui,sans-serif;color:#172b4d;max-width:760px;margin:32px auto;padding:0 20px}
h1{font-size:24px;margin-bottom:4px}h2{font-size:17px;margin-top:24px;border-bottom:1px solid #dfe1e6;padding-bottom:4px}h3{font-size:14px}
table{border-collapse:collapse}th,td{border:1px solid #dfe1e6;padding:4px 12px;text-align:center}ul{padding-left:20px}
@media print{body{margin:0}}</style></head><body>${body.join('\n')}</body></html>`;
}
