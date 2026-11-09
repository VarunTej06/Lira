import { describe, expect, it } from 'vitest';
import { isGlobalRoute, parsePath, pathFor, routeForTab, tabOf, titleOf, withIssue } from './routes';

describe('Dashboard addresses', () => {
  it('reads the list, the wizard and one dashboard', () => {
    expect(parsePath('/dashboards')).toEqual({ kind: 'dashboards', dashboardId: undefined });
    expect(parsePath('/dashboards/new')).toEqual({ kind: 'dashboards', dashboardId: 'new' });
    expect(parsePath('/dashboards/dash-abc123')).toEqual({ kind: 'dashboards', dashboardId: 'dash-abc123' });
  });
  it('writes them back the same way, including odd characters', () => {
    expect(pathFor({ kind: 'dashboards' })).toBe('/dashboards');
    expect(pathFor({ kind: 'dashboards', dashboardId: 'dash-1' })).toBe('/dashboards/dash-1');
    expect(parsePath(pathFor({ kind: 'dashboards', dashboardId: 'a b/c' }))).toEqual({ kind: 'dashboards', dashboardId: 'a b/c' });
  });
  it('is a cross-space page with its own name and title (so the sidebar highlights it)', () => {
    const r = parsePath('/dashboards/x');
    expect(isGlobalRoute(r)).toBe(true);
    expect(tabOf(r)).toBe('Dashboards');
    expect(titleOf(r)).toBe('Dashboards');
    expect(routeForTab('Dashboards')).toEqual({ kind: 'dashboards' });
  });
  it('any page can still show a ticket popup', () => {
    expect(withIssue('', 'LIRA-4')).toBe('?issue=LIRA-4');
    expect(withIssue('?issue=LIRA-4', null)).toBe('');
  });
});
