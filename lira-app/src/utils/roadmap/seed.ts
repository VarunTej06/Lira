import type {  } from '../../types/issue';
import { type RoadmapChild, type RoadmapItem, type Roadmap } from './types';
import { newId } from './dependencies';

/** The built-in Lira roadmap, its one-time schedule upgrade, and creating or copying roadmaps. */
export const LIRA_SCHEDULE_VERSION = 2;

export const child = (id: string, title: string, done = false): RoadmapChild => ({ id, title, done });

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
