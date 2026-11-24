import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { cleanup, mount, q } from '../../test/render';
import { addDashboard, buildDashboard, duplicateDashboard, normalizeDashboard, readDashboards, removeDashboard, updateDashboard, useDashboards } from './store';
import { DEFAULT_FILTERS } from './types';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const make = (name = 'Board') => buildDashboard({ name, scenario: 'custom', filters: DEFAULT_FILTERS, entryIds: ['stat-open', 'nope'] });

describe('normalising a saved dashboard', () => {
  it('fills what is missing and drops widgets that are not whole', () => {
    const d = normalizeDashboard({ name: '  ', widgets: [{ id: 'a', type: 'stat' } as never, { id: '', type: 'stat' } as never, null as never] });
    expect(d.name).toBe('Untitled dashboard');
    expect(d.scenario).toBe('custom');
    expect(d.widgets).toHaveLength(1);
    expect(d.goals).toEqual([]);
    expect(d.starred).toBe(false);
    expect(d.id).toBeTruthy();
    expect(d.filters.range).toBe('all');
  });
  it('keeps what is there', () => {
    expect(normalizeDashboard({ id: 'x', name: ' Mine ', starred: true, filters: { range: '7d' } as never })).toMatchObject({ id: 'x', name: 'Mine', starred: true, filters: { range: '7d', sprint: 'all' } });
  });
});

describe('building one', () => {
  it('makes a widget for every known entry and skips unknown ones', () => {
    expect(make().widgets).toHaveLength(1);
  });
});

describe('the saved list', () => {
  it('adds new ones first, updates by id, and removes', () => {
    const a = addDashboard(make('A')); const b = addDashboard(make('B'));
    expect(readDashboards().map(d => d.name)).toEqual(['B', 'A']);
    updateDashboard(a.id, d => ({ ...d, name: 'A2' }));
    expect(readDashboards().find(d => d.id === a.id)!.name).toBe('A2');
    removeDashboard(b.id);
    expect(readDashboards().map(d => d.id)).toEqual([a.id]);
  });
  it('copies one with new ids and no star, and says nothing for an unknown one', () => {
    const a = addDashboard({ ...make('A'), starred: true });
    const copy = duplicateDashboard(a.id)!;
    expect(copy.name).toBe('A (copy)');
    expect(copy.starred).toBe(false);
    expect(copy.id).not.toBe(a.id);
    expect(copy.widgets[0].id).not.toBe(a.widgets[0].id);
    expect(duplicateDashboard('zzz')).toBeUndefined();
  });
  it('reads as empty when the saved value is damaged', () => {
    localStorage.setItem('lira_dashboards', '{not json');
    expect(readDashboards()).toEqual([]);
    localStorage.setItem('lira_dashboards', '{"a":1}');
    expect(readDashboards()).toEqual([]);
  });
});

describe('the live list', () => {
  it('follows changes made anywhere', async () => {
    function Probe() { const { dashboards } = useDashboards(); return <p id="n">{dashboards.length}</p>; }
    mount(<Probe />);
    expect(q('#n')!.textContent).toBe('0');
    await act(async () => { addDashboard(make()); });
    expect(q('#n')!.textContent).toBe('1');
  });
});
