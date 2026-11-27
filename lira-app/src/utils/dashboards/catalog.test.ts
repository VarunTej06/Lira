import { describe, expect, it } from 'vitest';
import { CATALOG, CATEGORY_ORDER, SCENARIOS, entryById, newId, scenarioById, scenarioFilters, widgetFromEntry } from './catalog';
import { DEFAULT_FILTERS } from './types';

describe('the widget catalog', () => {
  it('has unique ids and puts every entry in a known category', () => {
    const ids = CATALOG.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    CATALOG.forEach(c => expect(CATEGORY_ORDER, c.id).toContain(c.category));
  });
  it('finds an entry by id and says nothing for an unknown one', () => {
    expect(entryById('stat-open')?.id).toBe('stat-open');
    expect(entryById('nope')).toBeUndefined();
  });
  it('makes a widget with its own fresh id, and lets the caller override fields', () => {
    const a = widgetFromEntry('stat-open')!;
    const b = widgetFromEntry('stat-open', { title: 'Mine' })!;
    expect(a.id).not.toBe(b.id);
    expect(b.title).toBe('Mine');
    expect(widgetFromEntry('nope')).toBeUndefined();
  });
});

describe('scenarios', () => {
  it('falls back to the last one (custom) for an id it does not know', () => {
    expect(scenarioById('executive').id).toBe('executive');
    expect(scenarioById('zzz' as never)).toBe(SCENARIOS[SCENARIOS.length - 1]);
  });
  it('gives filters for every scenario, and the plain defaults for custom', () => {
    SCENARIOS.forEach(s => expect(scenarioFilters(s), s.id).toMatchObject({ spaceIds: [] }));
    expect(scenarioFilters(scenarioById('custom'))).toEqual(DEFAULT_FILTERS);
  });
});

describe('new ids', () => {
  it('are prefixed and never repeat', () => {
    const ids = Array.from({ length: 50 }, () => newId('w'));
    expect(new Set(ids).size).toBe(50);
    ids.forEach(id => expect(id.startsWith('w-')).toBe(true));
  });
});
