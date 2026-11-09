import { useCallback, useEffect, useState } from 'react';
import type { Dashboard, DashboardFilters, ScenarioId } from './types';
import { DEFAULT_FILTERS } from './types';
import { newId, widgetFromEntry } from './catalog';
import { appStorage } from '../appStorage';

/**
 * Saved dashboards. They live in localStorage under `lira_dashboards` and are mirrored to data/dashboards.json by the
 * disk mirror (services/kvMirror.ts), like projects and roadmaps, so clearing the browser loses nothing.
 */

const KEY = 'lira_dashboards';
const DASHBOARDS_EVENT = 'lira-dashboards-changed';

/** Fills in anything an older or hand-edited file does not have. */
export function normalizeDashboard(raw: Partial<Dashboard>): Dashboard {
  const now = new Date().toISOString();
  return {
    id: raw.id || newId('dash'),
    name: raw.name?.trim() || 'Untitled dashboard',
    description: raw.description,
    scenario: (raw.scenario as ScenarioId) || 'custom',
    filters: { ...DEFAULT_FILTERS, ...(raw.filters ?? {}) },
    widgets: Array.isArray(raw.widgets) ? raw.widgets.filter(w => w && w.type && w.id) : [],
    goals: Array.isArray(raw.goals) ? raw.goals : [],
    snapshot: raw.snapshot,
    starred: !!raw.starred,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
  };
}

export function readDashboards(): Dashboard[] {
  try {
    const raw = appStorage.get(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(normalizeDashboard);
    }
  } catch (e) {
    console.error('Failed to read lira_dashboards', e);
  }
  return [];
}

function writeDashboards(list: Dashboard[]): void {
  try { appStorage.set(KEY, JSON.stringify(list)); } catch (e) { console.error('Failed to save lira_dashboards', e); }
  window.dispatchEvent(new Event(DASHBOARDS_EVENT));
}

interface NewDashboardInput {
  name: string;
  description?: string;
  scenario: ScenarioId;
  filters: DashboardFilters;
  entryIds: string[];
}

/** Builds a dashboard (not saved yet). */
export function buildDashboard(input: NewDashboardInput): Dashboard {
  const now = new Date().toISOString();
  return normalizeDashboard({
    name: input.name,
    description: input.description,
    scenario: input.scenario,
    filters: input.filters,
    widgets: input.entryIds.map(id => widgetFromEntry(id)).filter((w): w is NonNullable<typeof w> => !!w),
    goals: [],
    createdAt: now,
    updatedAt: now,
  });
}

export function addDashboard(d: Dashboard): Dashboard {
  writeDashboards([d, ...readDashboards()]);
  return d;
}

export function updateDashboard(id: string, fn: (d: Dashboard) => Dashboard): void {
  writeDashboards(readDashboards().map(d => (d.id === id ? { ...fn(d), updatedAt: new Date().toISOString() } : d)));
}

export function removeDashboard(id: string): void {
  writeDashboards(readDashboards().filter(d => d.id !== id));
}

export function duplicateDashboard(id: string): Dashboard | undefined {
  const d = readDashboards().find(x => x.id === id);
  if (!d) return undefined;
  const now = new Date().toISOString();
  const copy: Dashboard = { ...d, id: newId('dash'), name: `${d.name} (copy)`, starred: false, snapshot: undefined, widgets: d.widgets.map(w => ({ ...w, id: newId('w') })), createdAt: now, updatedAt: now };
  return addDashboard(copy);
}

/** Live list of saved dashboards. */
export function useDashboards() {
  const [dashboards, setDashboards] = useState<Dashboard[]>(() => readDashboards());
  useEffect(() => {
    const refresh = () => setDashboards(readDashboards());
    window.addEventListener(DASHBOARDS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(DASHBOARDS_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, []);
  const update = useCallback((id: string, fn: (d: Dashboard) => Dashboard) => updateDashboard(id, fn), []);
  return { dashboards, update };
}
