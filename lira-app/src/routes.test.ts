import { describe, expect, it } from 'vitest'
import { DEFAULT_SPACE_TAB, SPACE_TABS, routeForTab, isGlobalRoute, isGlobalTab, pathFor, parsePath, spacePath, tabOf, titleOf, withIssue, type AppRoute } from './routes'

describe('route table', () => {
  const cases: [string, AppRoute][] = [
    ['/', { kind: 'home' }],
    ['/for-you', { kind: 'forYou' }],
    ['/filters', { kind: 'filters' }],
    ['/tickets', { kind: 'tickets' }],
    ['/projects', { kind: 'projects' }],
    ['/projects/proj-1793933904652-ewzx7', { kind: 'projects', projectId: 'proj-1793933904652-ewzx7' }],
    ['/sprints', { kind: 'sprints' }],
    ['/sprints/2026-11', { kind: 'sprints', sprintKey: '2026-11' }],
    ['/roadmaps', { kind: 'roadmaps' }],
    ['/roadmaps/rm-lira', { kind: 'roadmaps', roadmapId: 'rm-lira' }],
    ['/space/CERT/board', { kind: 'space', spaceKey: 'CERT', tab: 'Board' }],
    ['/space/AP/capacity', { kind: 'space', spaceKey: 'AP', tab: 'Capacity' }],
  ]

  it.each(cases)('%s round-trips', (path, route) => {
    expect(parsePath(path)).toEqual(route)
    expect(pathFor(route)).toBe(path)
  })

  it('ignores trailing slashes and is case-insensitive for spaces and tabs', () => {
    expect(parsePath('/sprints/')).toEqual({ kind: 'sprints' })
    expect(parsePath('/space/cert/BOARD/')).toEqual({ kind: 'space', spaceKey: 'CERT', tab: 'Board' })
  })

  it('falls back sensibly for unknown or broken paths', () => {
    expect(parsePath('/nope')).toEqual({ kind: 'home' })
    expect(parsePath('/space')).toEqual({ kind: 'home' })
    expect(parsePath('/space/CERT')).toEqual({ kind: 'space', spaceKey: 'CERT', tab: DEFAULT_SPACE_TAB })
    expect(parsePath('/space/CERT/whatever')).toEqual({ kind: 'space', spaceKey: 'CERT', tab: DEFAULT_SPACE_TAB })
    expect(parsePath('/sprints/not-a-month')).toEqual({ kind: 'sprints' })
    expect(parsePath('/projects/%E0%A4%A')).toEqual({ kind: 'projects', projectId: '%E0%A4%A' }) // bad escape: kept as is
  })

  it('every space tab has its own path that comes back as the same tab', () => {
    for (const tab of SPACE_TABS) expect(parsePath(spacePath('LIRA', tab))).toEqual({ kind: 'space', spaceKey: 'LIRA', tab })
  })

  it('escapes ids that contain special characters', () => {
    const r: AppRoute = { kind: 'projects', projectId: 'a b/c' }
    expect(pathFor(r)).toBe('/projects/a%20b%2Fc')
    expect(parsePath(pathFor(r))).toEqual(r)
  })
})

describe('page names and global pages', () => {
  it('maps routes to the names the tab-based components use', () => {
    expect(tabOf({ kind: 'forYou' })).toBe('ForYou')
    expect(tabOf({ kind: 'sprints' })).toBe('SprintsHub')
    expect(tabOf({ kind: 'sprints', sprintKey: '2026-11' })).toBe('SprintDetail')
    expect(tabOf({ kind: 'tickets' })).toBe('AllTickets')
    expect(tabOf({ kind: 'space', spaceKey: 'AP', tab: 'List' })).toBe('List')
    expect(tabOf({ kind: 'home' })).toBe('Board')
  })

  it('knows which pages are cross-space, from one list', () => {
    for (const r of [{ kind: 'forYou' }, { kind: 'filters' }, { kind: 'tickets' }, { kind: 'projects' }, { kind: 'sprints' }, { kind: 'roadmaps' }] as AppRoute[]) expect(isGlobalRoute(r)).toBe(true)
    expect(isGlobalRoute({ kind: 'space', spaceKey: 'AP', tab: 'Board' })).toBe(false)
    expect(isGlobalRoute({ kind: 'home' })).toBe(false)
    expect(isGlobalTab('Roadmaps')).toBe(true)
    expect(isGlobalTab('SprintDetail')).toBe(true)
    expect(isGlobalTab('Board')).toBe(false)
    expect(isGlobalTab('Reports')).toBe(false)
  })

  it('titles the browser tab', () => {
    expect(titleOf({ kind: 'space', spaceKey: 'AP', tab: 'Board' })).toBe('AP · Board')
    expect(titleOf({ kind: 'roadmaps' })).toBe('Roadmaps')
    expect(titleOf({ kind: 'home' })).toBe('Lira')
  })
})

describe('ticket popup parameter', () => {
  it('adds, replaces and removes ?issue= and keeps other parameters', () => {
    expect(withIssue('', 'LIRA-1')).toBe('?issue=LIRA-1')
    expect(withIssue('?issue=LIRA-1', 'LIRA-2')).toBe('?issue=LIRA-2')
    expect(withIssue('?issue=LIRA-1', null)).toBe('')
    expect(withIssue('?x=1&issue=A-1', null)).toBe('?x=1')
  })
})

describe('routeForTab', () => {
  it('turns page names into routes, using the context where the name is not enough', () => {
    expect(pathFor(routeForTab('ForYou'))).toBe('/for-you')
    expect(pathFor(routeForTab('Projects'))).toBe('/projects')
    expect(pathFor(routeForTab('Projects', { projectId: 'p1' }))).toBe('/projects/p1')
    expect(pathFor(routeForTab('SprintsHub'))).toBe('/sprints')
    expect(pathFor(routeForTab('SprintDetail', { sprintKey: '2026-11' }))).toBe('/sprints/2026-11')
    expect(pathFor(routeForTab('SprintDetail'))).toBe('/sprints')
    expect(pathFor(routeForTab('AllTickets'))).toBe('/tickets')
    expect(pathFor(routeForTab('Roadmaps'))).toBe('/roadmaps')
  })
  it('puts space tabs in the current space, and goes home when there is none', () => {
    expect(pathFor(routeForTab('Capacity', { spaceKey: 'ap' }))).toBe('/space/AP/capacity')
    expect(pathFor(routeForTab('Reports', { spaceKey: 'AP' }))).toBe('/space/AP/reports')
    expect(pathFor(routeForTab('Mystery', { spaceKey: 'AP' }))).toBe('/space/AP/board')
    expect(pathFor(routeForTab('Board'))).toBe('/')
  })
  it('round-trips with tabOf', () => {
    for (const r of [{ kind: 'forYou' }, { kind: 'filters' }, { kind: 'tickets' }, { kind: 'projects' }, { kind: 'sprints' }, { kind: 'roadmaps' }] as AppRoute[]) {
      expect(routeForTab(tabOf(r)).kind).toBe(r.kind)
    }
  })
})
