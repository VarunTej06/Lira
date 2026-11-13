import { describe, expect, it } from 'vitest';
import type { DashboardWidget } from '../../utils/dashboards/types';
import { METRICS, LIST_META } from '../../utils/dashboards/metrics';
import { clampNumber, LIMITED_TYPES, withListKind, withMetric } from './widgetSettingsRules';

const w = (over: Partial<DashboardWidget>) => ({ id: 'w', type: 'stat', title: 'T', config: {}, ...over }) as DashboardWidget;

describe('withMetric', () => {
  it('renames a widget that still has the default name', () => {
    const r = withMetric(w({ title: METRICS.open.label, config: { metric: 'open' } }), 'blocked');
    expect(r.title).toBe(METRICS.blocked.label);
    expect(r.config.metric).toBe('blocked');
  });
  it('treats a widget with no metric as "open"', () => {
    expect(withMetric(w({ title: METRICS.open.label }), 'blocked').title).toBe(METRICS.blocked.label);
  });
  it('keeps a name the person typed, and leaves the original alone', () => {
    const base = w({ title: 'Mine', config: { metric: 'open' } });
    expect(withMetric(base, 'blocked').title).toBe('Mine');
    expect(base.config.metric).toBe('open');
  });
});

describe('withListKind', () => {
  const [a, b] = Object.keys(LIST_META) as (keyof typeof LIST_META)[];
  it('renames when the title is one of the list names', () => {
    expect(withListKind(w({ type: 'list', title: LIST_META[a].label }), b).title).toBe(LIST_META[b].label);
  });
  it('keeps a typed title', () => {
    const r = withListKind(w({ type: 'list', title: 'Custom' }), b);
    expect(r.title).toBe('Custom');
    expect(r.config.list).toBe(b);
  });
});

describe('clampNumber', () => {
  it('keeps a value between the limits', () => {
    expect(clampNumber('10', 3, 30, 8)).toBe(10);
    expect(clampNumber('100', 3, 30, 8)).toBe(30);
    expect(clampNumber('1', 3, 30, 8)).toBe(3);
  });
  it('uses the fallback for blank, zero or text', () => {
    expect(clampNumber('', 3, 30, 8)).toBe(8);
    expect(clampNumber('0', 3, 30, 8)).toBe(8);
    expect(clampNumber('abc', 3, 30, 8)).toBe(8);
  });
});

describe('LIMITED_TYPES', () => {
  it('has a limit box for list, bar, progress, blocked and roadmap', () => {
    expect([...LIMITED_TYPES].sort()).toEqual(['bar', 'blocked', 'list', 'progress', 'roadmap']);
  });
});
