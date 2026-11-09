import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_NAV_ORDER, DEFAULT_SECTION_ORDER, DEFAULT_SIDEBAR_CONFIG, loadSidebarConfig, normalizeSidebarConfig } from './sidebarConfig';

describe('sidebar layout config', () => {
  beforeEach(() => localStorage.clear())

  it('defaults: Navigation has the current items plus Roadmaps and Dashboards; sections are Spaces, Projects, Sprints, Hidden spaces', () => {
    expect(DEFAULT_NAV_ORDER).toEqual(['forYou', 'projects', 'sprints', 'allTickets', 'roadmaps', 'dashboards'])
    expect(DEFAULT_SECTION_ORDER).toEqual(['sec_spaces', 'sec_projects', 'sec_sprints', 'sec_hidden'])
    expect(Object.values(DEFAULT_SIDEBAR_CONFIG.visibility).every(Boolean)).toBe(true)
  })

  it('has no pinned views or app shortcuts any more', () => {
    const keys = Object.keys(DEFAULT_SIDEBAR_CONFIG.visibility)
    for (const old of ['list', 'calendar', 'assets', 'teams', 'goals', 'apps', 'recent', 'filters', 'plans']) expect(keys).not.toContain(old)
  })

  it('replaces an old (pre-v2) saved layout with the defaults, so Roadmaps and Dashboards show up', () => {
    const legacy = { navOrder: ['forYou', 'projects', 'list'], appsOrder: ['assets'], visibility: { dashboards: false, roadmaps: false, list: true } }
    localStorage.setItem('lira_sidebar_customization', JSON.stringify(legacy))
    expect(loadSidebarConfig()).toEqual(DEFAULT_SIDEBAR_CONFIG)
  })

  it('keeps a saved v2 layout: order and hidden items', () => {
    const saved = { version: 2, navOrder: ['forYou', 'roadmaps', 'projects'], sectionOrder: ['sec_sprints', 'sec_spaces'], visibility: { dashboards: false, sec_hidden: false } }
    localStorage.setItem('lira_sidebar_customization', JSON.stringify(saved))
    const cfg = loadSidebarConfig()
    expect(cfg.navOrder).toEqual(['forYou', 'roadmaps', 'projects', 'sprints', 'allTickets', 'dashboards']) // missing items appended
    expect(cfg.sectionOrder).toEqual(['sec_sprints', 'sec_spaces', 'sec_projects', 'sec_hidden'])
    expect(cfg.visibility.dashboards).toBe(false)
    expect(cfg.visibility.sec_hidden).toBe(false)
    expect(cfg.visibility.roadmaps).toBe(true)
  })

  it('drops unknown keys and always keeps For you visible', () => {
    const cfg = normalizeSidebarConfig({ version: 2, navOrder: ['bogus', 'forYou'], visibility: { forYou: false } })
    expect(cfg.navOrder).not.toContain('bogus')
    expect(cfg.visibility.forYou).toBe(true)
  })

  it('survives corrupt storage', () => {
    localStorage.setItem('lira_sidebar_customization', '{bad')
    expect(loadSidebarConfig()).toEqual(DEFAULT_SIDEBAR_CONFIG)
  })
})
