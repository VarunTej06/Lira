/**
 * The URL scheme of Lira, in one place. Pages are addressed by path, so refresh, back/forward and shared links work:
 *
 *   /for-you                      For you
 *   /filters                      Filters
 *   /projects                     all projects          /projects/<projectId>   one project
 *   /sprints                      all sprints           /sprints/2026-11        one sprint
 *   /tickets                      all tickets
 *   /roadmaps                     all roadmaps          /roadmaps/<roadmapId>   one roadmap
 *   /dashboards                   all dashboards        /dashboards/new  the wizard        /dashboards/<id>  one dashboard
 *   /space/<KEY>/<tab>            a space: summary | board | list | calendar | sprints | capacity | forms | ...
 *   ?issue=<KEY-123>              any page can show a ticket popup, e.g. /roadmaps/rm-lira?issue=LIRA-61
 *
 * Everything that needs to know "which page is this" (the sidebar highlight, the global-page checks, links) uses this file,
 * instead of keeping its own list of page names.
 */

export const SPACE_TABS = ['Summary', 'Board', 'List', 'Calendar', 'Sprints', 'Capacity', 'Forms', 'Documents', 'Attachments', 'Reports'] as const;
export const DEFAULT_SPACE_TAB = 'Board';

export type AppRoute =
  | { kind: 'home' }
  | { kind: 'forYou' }
  | { kind: 'filters' }
  | { kind: 'tickets' }
  | { kind: 'projects'; projectId?: string }
  | { kind: 'sprints'; sprintKey?: string }
  | { kind: 'roadmaps'; roadmapId?: string }
  | { kind: 'dashboards'; dashboardId?: string }
  | { kind: 'space'; spaceKey: string; tab: string };

const SPRINT_KEY = /^\d{4}-\d{2}(-\d{2})?$/; // a month, or a weekly / bi-weekly / N-day sprint's start date
const tabFromSlug = (slug?: string) => SPACE_TABS.find(t => t.toLowerCase() === (slug || '').toLowerCase());
const seg = (s: string) => encodeURIComponent(s);

/** The path split into pieces, each decoded; a piece that cannot be decoded is kept as it is. */
const decodedParts = (pathname: string): string[] =>
  pathname.split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch { return p; } });

const sprintRoute = (key?: string): AppRoute => (key && SPRINT_KEY.test(key) ? { kind: 'sprints', sprintKey: key } : { kind: 'sprints' });
const spaceRoute = (key?: string, tabSlug?: string): AppRoute => (key ? { kind: 'space', spaceKey: key.toUpperCase(), tab: tabFromSlug(tabSlug) ?? DEFAULT_SPACE_TAB } : { kind: 'home' });

/** Path to route. Anything unknown goes home (the app then redirects to the last space). */
export function parsePath(pathname: string): AppRoute {
  const [a, b, c] = decodedParts(pathname);
  switch (a) {
    case 'for-you': return { kind: 'forYou' };
    case 'filters': return { kind: 'filters' };
    case 'tickets': return { kind: 'tickets' };
    case 'projects': return { kind: 'projects', projectId: b };
    case 'sprints': return sprintRoute(b);
    case 'roadmaps': return { kind: 'roadmaps', roadmapId: b };
    case 'dashboards': return { kind: 'dashboards', dashboardId: b };
    case 'space': return spaceRoute(b, c);
    default: return { kind: 'home' };
  }
}

/** "/projects/p1" for a page that names one item, "/projects" without one. */
const itemPath = (base: string, id?: string, encode = true): string => (id ? `${base}/${encode ? seg(id) : id}` : base);

/** Route to path. */
export function pathFor(route: AppRoute): string {
  switch (route.kind) {
    case 'home': return '/';
    case 'forYou': return '/for-you';
    case 'filters': return '/filters';
    case 'tickets': return '/tickets';
    case 'projects': return itemPath('/projects', route.projectId);
    case 'sprints': return itemPath('/sprints', route.sprintKey, false);
    case 'roadmaps': return itemPath('/roadmaps', route.roadmapId);
    case 'dashboards': return itemPath('/dashboards', route.dashboardId);
    case 'space': return `/space/${seg(route.spaceKey)}/${route.tab.toLowerCase()}`;
  }
}

export const spacePath = (spaceKey: string, tab: string = DEFAULT_SPACE_TAB) => pathFor({ kind: 'space', spaceKey, tab });

/** The page name used by components that show tabs: space tabs by their name, other pages by these names. */
export function tabOf(route: AppRoute): string {
  switch (route.kind) {
    case 'home': return DEFAULT_SPACE_TAB;
    case 'forYou': return 'ForYou';
    case 'filters': return 'Filters';
    case 'tickets': return 'AllTickets';
    case 'projects': return 'Projects';
    case 'sprints': return route.sprintKey ? 'SprintDetail' : 'SprintsHub';
    case 'roadmaps': return 'Roadmaps';
    case 'dashboards': return 'Dashboards';
    case 'space': return route.tab;
  }
}

/** Cross-space pages. Choosing a space from the sidebar always leaves these. */
export const isGlobalRoute = (route: AppRoute) => route.kind !== 'space' && route.kind !== 'home';
export const isGlobalTab = (tab: string) => !(SPACE_TABS as readonly string[]).includes(tab);

/** Title for the browser tab. */
export function titleOf(route: AppRoute): string {
  switch (route.kind) {
    case 'forYou': return 'For you';
    case 'filters': return 'Filters';
    case 'tickets': return 'All tickets';
    case 'projects': return 'Projects';
    case 'sprints': return route.sprintKey ? `Sprint ${route.sprintKey}` : 'Sprints';
    case 'roadmaps': return 'Roadmaps';
    case 'dashboards': return 'Dashboards';
    case 'space': return `${route.spaceKey} · ${route.tab}`;
    default: return 'Lira';
  }
}

/** Adds or removes the `?issue=` ticket popup parameter. */
export function withIssue(search: string, key: string | null): string {
  const p = new URLSearchParams(search);
  if (key) p.set('issue', key); else p.delete('issue');
  const s = p.toString();
  return s ? `?${s}` : '';
}

interface TabContext { spaceKey?: string; projectId?: string; sprintKey?: string; roadmapId?: string }

/**
 * The route for a page name. Components that still talk in page names (the board tabs, the sidebar) call this through
 * App; `ctx` supplies what the name alone does not say, such as the space the board tabs belong to.
 */
export function routeForTab(tab: string, ctx: TabContext = {}): AppRoute {
  switch (tab) {
    case 'ForYou': return { kind: 'forYou' };
    case 'Filters': return { kind: 'filters' };
    case 'AllTickets': return { kind: 'tickets' };
    case 'Projects': return { kind: 'projects', projectId: ctx.projectId };
    case 'SprintsHub': return { kind: 'sprints' };
    case 'SprintDetail': return ctx.sprintKey ? { kind: 'sprints', sprintKey: ctx.sprintKey } : { kind: 'sprints' };
    case 'Roadmaps': return { kind: 'roadmaps', roadmapId: ctx.roadmapId };
    case 'Dashboards': return { kind: 'dashboards' };
    default: return ctx.spaceKey ? { kind: 'space', spaceKey: ctx.spaceKey.toUpperCase(), tab: SPACE_TABS.find(t => t === tab) ?? DEFAULT_SPACE_TAB } : { kind: 'home' };
  }
}
