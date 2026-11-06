import type { Issue } from '../types/issue';

// ─── Types ───────────────────────────────────────────────────────────────────

export type RoadmapStatus = 'planned' | 'inprogress' | 'done' | 'atrisk' | 'blocked';
export type Horizon = 'done' | 'now' | 'next' | 'later';
export type Zoom = 'weeks' | 'months' | 'quarters';
export type MilestoneKind = 'milestone' | 'release';

export interface RoadmapChild { id: string; title: string; done: boolean }

export interface RoadmapItem {
  id: string;
  title: string;
  lane: string;            // swimlane / theme name
  status: RoadmapStatus;
  start: string;           // YYYY-MM-DD
  end: string;             // YYYY-MM-DD (inclusive)
  progress: number;        // 0-100, used when there are no children / linked tickets
  owner?: string;
  description?: string;
  deps: string[];          // ids of items that must finish first
  children: RoadmapChild[];
  /** Every roadmap item is backed by a Lira epic (e.g. "LIRA-12"), created in the Backlog when the item is added. */
  epicKey?: string;
  /** The single task under that epic that carries this item's checklist (each checklist entry is one of its subtasks). */
  taskKey?: string;
}

export interface RoadmapMilestone { id: string; title: string; date: string; kind: MilestoneKind }

export interface Roadmap {
  id: string;
  name: string;
  description?: string;
  projectKey?: string;
  /** Key of the space where this roadmap's epics are created, e.g. "LIRA". */
  spaceKey?: string;
  starred?: boolean;
  archived?: boolean;
  updatedAt?: string;
  /** Which schedule of the built-in Lira roadmap this copy has (see migrateLiraSchedule). */
  scheduleVersion?: number;
  /** Set when dates changed and the roadmap's epics and tasks still need to follow. */
  pendingTicketSync?: boolean;
  lanes: string[];
  items: RoadmapItem[];
  milestones: RoadmapMilestone[];
  createdAt: string;
}

export const STATUS_META: Record<RoadmapStatus, { label: string; color: string }> = {
  planned:    { label: 'Planned',     color: '#6B778C' },
  inprogress: { label: 'In progress', color: '#0C66E4' },
  done:       { label: 'Done',        color: '#22A06B' },
  atrisk:     { label: 'At risk',     color: '#E2740B' },
  blocked:    { label: 'Blocked',     color: '#C9372C' },
};

export const LANE_COLORS = ['#0C66E4', '#6554C0', '#22A06B', '#E2740B', '#00B8D9', '#C9372C', '#8F7EE7', '#B38600'];
export const laneColor = (rm: Roadmap, lane: string) => LANE_COLORS[Math.max(0, rm.lanes.indexOf(lane)) % LANE_COLORS.length];

// ─── Dates ───────────────────────────────────────────────────────────────────

const DAY = 86_400_000;

export function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function fmtDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Whole days from a to b (b later => positive). Ignores time of day and DST. */
export function daysBetween(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / DAY);
}

export const todayStr = (now = new Date()) => fmtDay(now);

export function fmtShort(s: string): string {
  return parseDay(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Timeline scale ──────────────────────────────────────────────────────────

export const PX_PER_DAY: Record<Zoom, number> = { weeks: 22, months: 9, quarters: 3 };

export interface TimeRange { start: Date; end: Date; days: number }

/** Visible range: covers every item and milestone, padded, snapped to whole months. */
export function computeRange(rm: Roadmap, today = new Date(), extra: Date[] = []): TimeRange {
  const dates: Date[] = [today, ...extra];
  rm.items.forEach(i => { dates.push(parseDay(i.start), parseDay(i.end)); });
  rm.milestones.forEach(m => dates.push(parseDay(m.date)));
  const min = new Date(Math.min(...dates.map(d => d.getTime())));
  const max = new Date(Math.max(...dates.map(d => d.getTime())));
  const start = new Date(min.getFullYear(), min.getMonth(), 1);
  const end = new Date(max.getFullYear(), max.getMonth() + 2, 0); // end of the month after the last date
  return { start, end, days: daysBetween(start, end) + 1 };
}

export const xOf = (range: TimeRange, d: Date, ppd: number) => daysBetween(range.start, d) * ppd;

export interface HeaderCell { label: string; x: number; width: number }

/** Two header rows: bigger periods on top (year / quarter), finer below (month / week). */
export function buildHeader(range: TimeRange, zoom: Zoom): { top: HeaderCell[]; bottom: HeaderCell[] } {
  const ppd = PX_PER_DAY[zoom];
  const top: HeaderCell[] = [];
  const bottom: HeaderCell[] = [];
  const cell = (label: string, from: Date, to: Date): HeaderCell => ({
    label, x: xOf(range, from, ppd), width: (daysBetween(from, to) + 1) * ppd,
  });
  const clampEnd = (d: Date) => (d > range.end ? range.end : d);

  if (zoom === 'weeks') {
    // top = months, bottom = weeks (Mondays)
    for (let m = new Date(range.start); m <= range.end; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      top.push(cell(m.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), m, clampEnd(new Date(m.getFullYear(), m.getMonth() + 1, 0))));
    }
    let w = new Date(range.start);
    while (w.getDay() !== 1) w = addDays(w, 1);
    for (; w <= range.end; w = addDays(w, 7)) bottom.push(cell(String(w.getDate()), w, clampEnd(addDays(w, 6))));
  } else if (zoom === 'months') {
    // top = years, bottom = months
    for (let y = range.start.getFullYear(); y <= range.end.getFullYear(); y++) {
      const from = y === range.start.getFullYear() ? range.start : new Date(y, 0, 1);
      const to = clampEnd(new Date(y, 11, 31));
      top.push(cell(String(y), from, to));
    }
    for (let m = new Date(range.start); m <= range.end; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      bottom.push(cell(m.toLocaleDateString('en-US', { month: 'short' }), m, clampEnd(new Date(m.getFullYear(), m.getMonth() + 1, 0))));
    }
  } else {
    // top = years, bottom = quarters
    for (let y = range.start.getFullYear(); y <= range.end.getFullYear(); y++) {
      const from = y === range.start.getFullYear() ? range.start : new Date(y, 0, 1);
      top.push(cell(String(y), from, clampEnd(new Date(y, 11, 31))));
    }
    for (let q = Math.floor(range.start.getMonth() / 3), y = range.start.getFullYear(); ; q++) {
      if (q === 4) { q = 0; y++; }
      const from = new Date(y, q * 3, 1);
      if (from > range.end) break;
      const clampedFrom = from < range.start ? range.start : from;
      bottom.push(cell(`Q${q + 1}`, clampedFrom, clampEnd(new Date(y, q * 3 + 3, 0))));
    }
  }
  return { top, bottom };
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export const LANE_H = 34;
export const ROW_H = 40;

export type LayoutRow =
  | { kind: 'lane'; lane: string; y: number; h: number; count: number }
  | { kind: 'item'; item: RoadmapItem; y: number; h: number };

/** Rows top to bottom: a header per swimlane, then its items by start date. Collapsed lanes hide their items. */
export function layoutRows(items: RoadmapItem[], lanes: string[], collapsed: string[] = []): { rows: LayoutRow[]; height: number; yOf: Map<string, number> } {
  const rows: LayoutRow[] = [];
  const yOf = new Map<string, number>();
  let y = 0;
  const allLanes = [...lanes, ...Array.from(new Set(items.map(i => i.lane))).filter(l => !lanes.includes(l))];
  for (const lane of allLanes) {
    const inLane = items.filter(i => i.lane === lane).sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
    if (inLane.length === 0 && !lanes.includes(lane)) continue;
    rows.push({ kind: 'lane', lane, y, h: LANE_H, count: inLane.length });
    y += LANE_H;
    if (collapsed.includes(lane)) continue;
    for (const item of inLane) {
      rows.push({ kind: 'item', item, y, h: ROW_H });
      yOf.set(item.id, y);
      y += ROW_H;
    }
  }
  return { rows, height: y, yOf };
}

// ─── Progress, status, horizon ───────────────────────────────────────────────

/** Roadmap status that matches an epic's board status. */
export function statusFromEpic(status?: string): RoadmapStatus {
  const s = (status || '').toLowerCase();
  if (s === 'done') return 'done';
  if (s === 'inprogress') return 'inprogress';
  return 'planned';
}

/** The board status a new epic gets for a roadmap status: Backlog, unless the work is already running or finished. */
export function epicStatusFor(status: RoadmapStatus): 'backlog' | 'inprogress' | 'done' {
  if (status === 'done') return 'done';
  if (status === 'inprogress') return 'inprogress';
  return 'backlog';
}

export const epicFor = (item: RoadmapItem, issues: Issue[]): Issue | undefined =>
  item.epicKey ? issues.find(i => i.type === 'epic' && i.key === item.epicKey) : undefined;

/** Tickets that belong to an epic (tasks and bugs; subtasks are counted through their parent). */
export const epicTickets = (epic: Issue | undefined, issues: Issue[]): Issue[] =>
  epic ? issues.filter(i => i.type !== 'epic' && i.type !== 'subtask' && (i.parentId === epic.id || i.epicId === epic.id)) : [];

/** The task that carries an item's checklist. */
export const taskFor = (item: RoadmapItem, issues: Issue[]): Issue | undefined =>
  item.taskKey ? issues.find(i => i.key === item.taskKey && i.type !== 'epic') : undefined;

/** The checklist to show: the linked task's subtasks when there is a task (so ticking one on the ticket shows here), else the saved list. */
export function itemChecklist(item: RoadmapItem, issues: Issue[] = []): RoadmapChild[] {
  const task = taskFor(item, issues);
  return task ? (task.subtasks || []).map(s => ({ id: s.id, title: s.title, done: s.completed })) : item.children;
}

/**
 * Progress 0-100. With tickets under the epic, each ticket counts as done (1), or for the checklist task as the share of its
 * subtasks that are ticked. Then a finished epic, then the saved checklist, then the manual value.
 */
export function itemProgress(item: RoadmapItem, issues: Issue[] = []): number {
  const epic = epicFor(item, issues);
  const tickets = epicTickets(epic, issues);
  if (tickets.length > 0) {
    const share = (t: Issue) => {
      if (t.status?.toLowerCase() === 'done') return 1;
      if (t.key === item.taskKey && t.subtasks?.length) return t.subtasks.filter(s => s.completed).length / t.subtasks.length;
      return 0;
    };
    return Math.round((tickets.reduce((a, t) => a + share(t), 0) / tickets.length) * 100);
  }
  if (epic && epic.status?.toLowerCase() === 'done') return 100;
  const list = itemChecklist(item, issues);
  if (list.length > 0) return Math.round((list.filter(c => c.done).length / list.length) * 100);
  return Math.max(0, Math.min(100, item.progress));
}

/**
 * The status to show. With a linked epic, the epic's board status decides (Backlog/To do = Planned). Finished work is Done,
 * work past its end date that is not finished is At risk, and a manual Blocked / At risk flag is kept.
 */
export function effectiveStatus(item: RoadmapItem, progress: number, today = new Date(), epicStatus?: string): RoadmapStatus {
  const manual = item.status === 'blocked' || item.status === 'atrisk';
  const base = epicStatus !== undefined && !manual ? statusFromEpic(epicStatus) : item.status;
  if (base === 'done' || progress >= 100) return 'done';
  if (item.status === 'blocked') return 'blocked';
  if (parseDay(item.end) < new Date(today.getFullYear(), today.getMonth(), today.getDate())) return 'atrisk';
  return base;
}

/** Everything the views need about one item: its epic, progress and the status to show. */
export function resolveItem(item: RoadmapItem, issues: Issue[], today = new Date()) {
  const epic = epicFor(item, issues);
  const progress = itemProgress(item, issues);
  return { epic, progress, status: effectiveStatus(item, progress, today, epic?.status) };
}

export function horizonOf(item: RoadmapItem, status: RoadmapStatus, today = new Date()): Horizon {
  if (status === 'done') return 'done';
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = parseDay(item.start);
  if (status === 'inprogress' || daysBetween(t, start) <= 7) return 'now'; // started, or starting this week
  return daysBetween(t, start) <= 62 ? 'next' : 'later';
}

/** Where a ticket sits on a calendar: its due date, else the first day of its sprint month (unscheduled). */
export function ticketDate(i: Issue): { date: Date; scheduled: boolean } {
  if (i.dueDate) { const d = new Date(i.dueDate); return { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), scheduled: true }; }
  if (i.sprint) return { date: parseDay(`${i.sprint}-01`), scheduled: false };
  const c = new Date(i.createdAt);
  return { date: new Date(c.getFullYear(), c.getMonth(), 1), scheduled: false };
}

// ─── Dependencies ────────────────────────────────────────────────────────────

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

// ─── Editing helpers ─────────────────────────────────────────────────────────

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

// ─── Summary and export ──────────────────────────────────────────────────────

export interface RoadmapSummary {
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

export const LIRA_SCHEDULE_VERSION = 2;

// ─── Seed: the Lira product roadmap (from ROADMAP.md) ────────────────────────

const child = (id: string, title: string, done = false): RoadmapChild => ({ id, title, done });

export function seedLiraRoadmap(): Roadmap {
  const item = (o: Partial<RoadmapItem> & Pick<RoadmapItem, 'id' | 'title' | 'lane' | 'start' | 'end'>): RoadmapItem => ({
    status: 'planned', progress: 0, owner: 'VY', description: '', deps: [], children: [], ...o,
  });
  return {
    id: 'rm-lira',
    name: 'Lira Platform Roadmap',
    description: 'The November plan for Lira, taken from ROADMAP.md: each item takes about two days and everything finishes in November. December gets its own roadmap.',
    projectKey: 'LIRA',
    spaceKey: 'LIRA',
    lanes: ['Foundation', 'Quality', 'Architecture', 'Collaboration', 'Agile', 'Productivity', 'AI'],
    createdAt: '2026-11-06T00:00:00.000Z',
    scheduleVersion: LIRA_SCHEDULE_VERSION,
    milestones: [
      { id: 'ms-p1', title: 'Phase 1 complete', date: '2026-11-03', kind: 'milestone' },
      { id: 'ms-decision', title: 'Decision: single-user vs backend', date: '2026-11-14', kind: 'milestone' },
      { id: 'ms-v31', title: 'v3.1 Routing and structure', date: '2026-11-08', kind: 'release' },
      { id: 'ms-v32', title: 'v3.2 Teams and invites', date: '2026-11-16', kind: 'release' },
      { id: 'ms-v33', title: 'v3.3 Sprint planning', date: '2026-11-18', kind: 'release' },
      { id: 'ms-v34', title: 'v3.4 Productivity', date: '2026-11-20', kind: 'release' },
      { id: 'ms-v35', title: 'v3.5 Viva AI upgrades', date: '2026-11-22', kind: 'release' },
      { id: 'ms-dec', title: 'Plan the December roadmap', date: '2026-11-30', kind: 'milestone' },
    ],
    items: [
      item({
        id: 'p1', title: 'Phase 1: Persistence cleanup and core tests', lane: 'Foundation', start: '2026-11-02', end: '2026-11-03',
        status: 'done', progress: 100,
        description: 'Projects, sprints, teams, standups and settings saved to JSON in data/. Structured Dexie tables. Vitest suite.',
        children: [
          child('p1a', 'Mirror all lira_* data to data/*.json', true),
          child('p1b', 'Dexie tables for projects, sprints, teams, standups', true),
          child('p1c', 'Only rewrite changed space files', true),
          child('p1d', 'Include new data in export/import', true),
          child('p1e', 'Vitest suite for sprint, standup, AI and persistence logic', true),
        ],
      }),
      item({
        id: 'p2', title: 'Phase 2: Routing and file splitting', lane: 'Foundation', start: '2026-11-07', end: '2026-11-08',
        deps: ['p1'],
        description: 'Real URLs, back/forward and deep links. Split the very large components so later work is cheaper.',
        children: [
          child('p2a', 'Add a router with real paths (/sprints/2026-11, /space/CERT/board)'),
          child('p2b', 'Remove the duplicated global-tab lists; derive sidebar highlight from the route'),
          child('p2c', 'Split ProjectDetailView, TopNavigation and aiAgentService (under ~500 lines each)'),
          child('p2d', 'Fix the nested <button> DOM warning'),
          child('p2e', 'Add an error boundary per page'),
        ],
      }),
      item({
        id: 'q1', title: 'Browser smoke tests (Playwright) for unverified pages', lane: 'Quality', start: '2026-11-09', end: '2026-11-10',
        deps: ['p1'],
        description: 'Light mode, hover menus, Viva AI open/close, standup popup, For you, Sprints overview, Create Issue rules.',
        children: [
          child('q1a', 'Set up Playwright against npm run dev'),
          child('q1b', 'Create Issue hierarchy rules (task/bug/epic/subtask)'),
          child('q1c', 'Sidebar navigation and highlight'),
          child('q1d', 'Light and dark theme screenshots'),
        ],
      }),
      item({
        id: 'q2', title: 'Accessibility pass', lane: 'Quality', start: '2026-11-11', end: '2026-11-12',
        description: 'Focus rings, aria labels on icon buttons, dark-mode contrast, reduced-motion everywhere.',
        children: [
          child('q2a', 'Focus rings on all interactive elements'),
          child('q2b', 'aria-labels for icon-only buttons'),
          child('q2c', 'Contrast review of both themes'),
          child('q2d', 'prefers-reduced-motion support'),
        ],
      }),
      item({
        id: 'a1', title: 'Phase 7: Decide on multi-user', lane: 'Architecture', start: '2026-11-13', end: '2026-11-14',
        deps: [],
        description: 'Stay local and single-user, or add a backend (accounts, database, realtime). Must be decided before real invites in Phase 3.',
        children: [
          child('a1a', 'List what the team actually needs shared'),
          child('a1b', 'Compare local + git sharing vs hosted backend'),
          child('a1c', 'Record the decision'),
        ],
      }),
      item({
        id: 'p3', title: 'Phase 3: Teams, real standup and invites', lane: 'Collaboration', start: '2026-11-15', end: '2026-11-16',
        deps: ['p2', 'a1'],
        description: 'Named teams assigned to spaces and projects. Standup history, async standup, real calendar invites.',
        children: [
          child('p3a', 'Team entity: members, roles, capacity'),
          child('p3b', 'Assign teams to spaces and projects'),
          child('p3c', 'Standup history and async updates'),
          child('p3d', 'Real Google / Teams invites (depends on the decision)'),
        ],
      }),
      item({
        id: 'p4', title: 'Phase 4: Sprint planning, rollover, retros, reports', lane: 'Agile', start: '2026-11-17', end: '2026-11-18',
        deps: ['p3'],
        description: 'Two-column planning view, automatic month-end rollover, retrospectives, burnup, cumulative flow, scope change log.',
        children: [
          child('p4a', 'Sprint planning view with capacity'),
          child('p4b', 'Automatic month-end rollover prompt'),
          child('p4c', 'Retrospective at sprint close'),
          child('p4d', 'Reports: burnup, CFD, cycle and lead time'),
          child('p4e', 'Set resolvedAt when a ticket moves to Done'),
        ],
      }),
      item({
        id: 'p5', title: 'Phase 5: Command palette, bulk edit, saved filters', lane: 'Productivity', start: '2026-11-19', end: '2026-11-20',
        deps: ['p4'],
        description: 'Ctrl+K palette, keyboard shortcuts, bulk edit, saved filters, templates and recurring tickets.',
        children: [
          child('p5a', 'Ctrl+K command palette'),
          child('p5b', 'Keyboard shortcuts and help sheet'),
          child('p5c', 'Bulk edit on board and list'),
          child('p5d', 'Saved filters pinned to the sidebar'),
        ],
      }),
      item({
        id: 'p6', title: 'Phase 6: Viva AI confirm-and-undo, sprint-aware prompts', lane: 'AI', start: '2026-11-21', end: '2026-11-22',
        deps: ['p5'],
        description: 'Preview and undo for every AI write, sprint planning suggestions, standup digest, risk radar.',
        children: [
          child('p6a', 'Preview, confirm and undo for writes'),
          child('p6b', 'Sprint-aware prompts'),
          child('p6c', 'Standup digest'),
          child('p6d', 'Risk radar for sprints'),
        ],
      }),
    ],
  };
}

// ─── Roadmap collection helpers ──────────────────────────────────────────────

export function blankRoadmap(o: { name: string; description?: string; spaceKey?: string; lanes?: string[] }, now = new Date()): Roadmap {
  return {
    id: newId('rm'),
    name: o.name.trim(),
    description: (o.description || '').trim(),
    spaceKey: o.spaceKey,
    projectKey: o.spaceKey,
    lanes: o.lanes && o.lanes.length ? o.lanes : ['Product', 'Engineering', 'Design'],
    items: [],
    milestones: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/** A copy with new ids. Epics are not copied: each copied item gets its own new epic when the copy is opened. */
export function duplicateRoadmap(rm: Roadmap, now = new Date()): Roadmap {
  const idMap = new Map(rm.items.map(i => [i.id, newId('item')]));
  return {
    ...rm,
    id: newId('rm'),
    name: `Copy of ${rm.name}`,
    starred: false,
    archived: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    items: rm.items.map(i => ({
      ...i,
      id: idMap.get(i.id)!,
      epicKey: undefined,
      taskKey: undefined,
      deps: i.deps.map(d => idMap.get(d)).filter((d): d is string => !!d),
      children: i.children.map(c => ({ ...c, id: newId('c') })),
    })),
    milestones: rm.milestones.map(m => ({ ...m, id: newId('ms') })),
  };
}

/** First start and last end across the items, for the roadmap cards. */
export function roadmapSpan(rm: Roadmap): { start?: string; end?: string } {
  if (rm.items.length === 0) return {};
  return { start: rm.items.map(i => i.start).sort()[0], end: rm.items.map(i => i.end).sort().slice(-1)[0] };
}

// ─── Planner (lane > epic > tickets) ─────────────────────────────────────────

export const PLANNER_LANE_H = 34;
export const PLANNER_EPIC_H = 42;
export const PLANNER_TICKET_H = 32;

export type PlannerRow =
  | { kind: 'lane'; lane: string; y: number; h: number; count: number }
  | { kind: 'epic'; item: RoadmapItem; epic?: Issue; tickets: Issue[]; expanded: boolean; y: number; h: number }
  | { kind: 'ticket'; issue: Issue; item: RoadmapItem; y: number; h: number };

/** Rows for the planner: a header per lane, each item's epic, then that epic's tickets (unless collapsed). */
export function buildPlannerRows(
  items: RoadmapItem[], lanes: string[], issues: Issue[], collapsedLanes: string[] = [], collapsedEpics: string[] = [],
): { rows: PlannerRow[]; height: number } {
  const rows: PlannerRow[] = [];
  let y = 0;
  const allLanes = [...lanes, ...Array.from(new Set(items.map(i => i.lane))).filter(l => !lanes.includes(l))];
  for (const lane of allLanes) {
    const inLane = items.filter(i => i.lane === lane).sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
    if (inLane.length === 0 && !lanes.includes(lane)) continue;
    rows.push({ kind: 'lane', lane, y, h: PLANNER_LANE_H, count: inLane.length });
    y += PLANNER_LANE_H;
    if (collapsedLanes.includes(lane)) continue;
    for (const item of inLane) {
      const epic = epicFor(item, issues);
      const tickets = epicTickets(epic, issues).sort((a, b) => ticketDate(a).date.getTime() - ticketDate(b).date.getTime() || a.key.localeCompare(b.key, undefined, { numeric: true }));
      const expanded = !collapsedEpics.includes(item.id);
      rows.push({ kind: 'epic', item, epic, tickets, expanded, y, h: PLANNER_EPIC_H });
      y += PLANNER_EPIC_H;
      if (!expanded) continue;
      for (const issue of tickets) {
        rows.push({ kind: 'ticket', issue, item, y, h: PLANNER_TICKET_H });
        y += PLANNER_TICKET_H;
      }
    }
  }
  return { rows, height: y };
}

/** Date a drag lands on: the original date moved by a whole number of days. */
export const movedDate = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

/**
 * One-time upgrade of the built-in Lira roadmap saved by an earlier version: version 2 is the November plan (two days per
 * item, everything inside November). Dates of the known items and milestones are replaced; anything you added is kept.
 * The roadmap is flagged so its epics and tasks get the new dates too.
 */
export function migrateLiraSchedule(rm: Roadmap): Roadmap {
  if (rm.id !== 'rm-lira' || (rm.scheduleVersion ?? 1) >= LIRA_SCHEDULE_VERSION) return rm;
  const fresh = seedLiraRoadmap();
  const dates = new Map(fresh.items.map(i => [i.id, i]));
  const ms = new Map(fresh.milestones.map(m => [m.id, m]));
  const milestones = rm.milestones.map(m => (ms.has(m.id) ? { ...m, date: ms.get(m.id)!.date } : m));
  for (const m of fresh.milestones) if (!milestones.some(x => x.id === m.id)) milestones.push(m);
  return {
    ...rm,
    description: fresh.description,
    scheduleVersion: LIRA_SCHEDULE_VERSION,
    pendingTicketSync: true,
    items: rm.items.map(i => (dates.has(i.id) ? { ...i, start: dates.get(i.id)!.start, end: dates.get(i.id)!.end } : i)),
    milestones,
  };
}
