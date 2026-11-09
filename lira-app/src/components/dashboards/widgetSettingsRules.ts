import { METRICS, LIST_META } from '../../utils/dashboards/metrics';
import type { DashboardWidget, ListKind, StatMetric } from '../../utils/dashboards/types';

/** Widget types that have a "Show at most" box. */
export const LIMITED_TYPES: DashboardWidget['type'][] = ['list', 'bar', 'progress', 'blocked', 'roadmap'];

/** A stat that still has the name of its old metric takes the name of the new one; a name the person typed is kept. */
export function withMetric(w: DashboardWidget, metric: StatMetric): DashboardWidget {
  const hadDefaultName = w.title === METRICS[w.config.metric ?? 'open'].label;
  return { ...w, title: hadDefaultName ? METRICS[metric].label : w.title, config: { ...w.config, metric } };
}

/** A list whose name is one of the list names takes the name of the new list; a name the person typed is kept. */
export function withListKind(w: DashboardWidget, list: ListKind): DashboardWidget {
  const hadListName = Object.values(LIST_META).some(m => m.label === w.title);
  return { ...w, title: hadListName ? LIST_META[list].label : w.title, config: { ...w.config, list } };
}

/** A number box value kept between the limits; blank or not a number gives the fallback. */
export const clampNumber = (text: string, min: number, max: number, fallback: number): number => Math.max(min, Math.min(max, Number(text) || fallback));
