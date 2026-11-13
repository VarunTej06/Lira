import { appStorage } from '../../utils/appStorage';
export interface SidebarConfig {
  version?: number;
  /** Items of the Navigation block at the top of the sidebar, in order. */
  navOrder: string[];
  /** Collapsible blocks below it (Spaces, Projects, Sprints, Hidden spaces), in order. */
  sectionOrder: string[];
  visibility: Record<string, boolean>;
}

export const CONFIG_VERSION = 2;

export const DEFAULT_NAV_ORDER = ['forYou', 'projects', 'sprints', 'allTickets', 'roadmaps', 'dashboards'];
export const DEFAULT_SECTION_ORDER = ['sec_spaces', 'sec_projects', 'sec_sprints', 'sec_hidden'];

export const DEFAULT_VISIBILITY: Record<string, boolean> = Object.fromEntries(
  [...DEFAULT_NAV_ORDER, ...DEFAULT_SECTION_ORDER].map(k => [k, true]),
);

export const DEFAULT_SIDEBAR_CONFIG: SidebarConfig = {
  version: CONFIG_VERSION,
  navOrder: DEFAULT_NAV_ORDER,
  sectionOrder: DEFAULT_SECTION_ORDER,
  visibility: DEFAULT_VISIBILITY,
};

/** Keeps only known items, appends any that are missing, and fills in visibility. Older saved layouts are replaced by the defaults. */
export function normalizeSidebarConfig(raw: unknown): SidebarConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<SidebarConfig>;
  if (r.version !== CONFIG_VERSION) return DEFAULT_SIDEBAR_CONFIG;
  const fix = (saved: unknown, defaults: string[]) => {
    const list = Array.isArray(saved) ? (saved as string[]).filter(k => defaults.includes(k)) : [];
    return [...list, ...defaults.filter(k => !list.includes(k))];
  };
  return {
    version: CONFIG_VERSION,
    navOrder: fix(r.navOrder, DEFAULT_NAV_ORDER),
    sectionOrder: fix(r.sectionOrder, DEFAULT_SECTION_ORDER),
    visibility: { ...DEFAULT_VISIBILITY, ...(r.visibility || {}), forYou: true },
  };
}

export function loadSidebarConfig(): SidebarConfig {
  try {
    const saved = appStorage.get('lira_sidebar_customization');
    return normalizeSidebarConfig(saved ? JSON.parse(saved) : undefined);
  } catch {
    return DEFAULT_SIDEBAR_CONFIG;
  }
}
