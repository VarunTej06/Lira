import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { projectStructured, syncStructured } from './structuredStore'

const raw = {
  lira_projects: JSON.stringify([{ id: 'p1', key: 'LIRA', name: 'Lira Core' }, { nope: true }]),
  lira_sprint_meta: JSON.stringify({ '1:2026-11': { goal: 'Ship', completedAt: '2026-11-30T00:00:00.000Z' }, 'all:2026-10': { goal: 'Plan' } }),
  lira_planned_sprints: JSON.stringify(['2027-01', 'bad']),
  'lira_scope_team:space:1': JSON.stringify(['AB', 'CD']),
  lira_team_directory: JSON.stringify({ AB: { key: 'AB', name: 'Alex', email: 'a@x.com' } }),
  lira_standups: JSON.stringify([{ id: 's1', scopeId: 'space:1', title: 'Daily' }]),
}

describe('projectStructured', () => {
  it('turns raw keys into table rows', () => {
    const s = projectStructured(raw)
    expect(s.projects).toEqual([{ id: 'p1', key: 'LIRA', name: 'Lira Core' }])
    expect(s.sprints).toContainEqual({ id: '1:2026-11', spaceId: 1, sprint: '2026-11', goal: 'Ship', completedAt: '2026-11-30T00:00:00.000Z', planned: false })
    expect(s.sprints).toContainEqual({ id: 'all:2026-10', spaceId: 'all', sprint: '2026-10', goal: 'Plan', completedAt: undefined, planned: false })
    expect(s.sprints).toContainEqual({ id: 'planned:2027-01', spaceId: 'all', sprint: '2027-01', planned: true })
    expect(s.sprints.some(x => x.sprint === 'bad')).toBe(false)
    expect(s.teams).toContainEqual({ id: 'scope:space:1', kind: 'scope', owner: 'space:1', memberKeys: ['AB', 'CD'] })
    expect(s.teams).toContainEqual({ id: 'member:AB', kind: 'member', name: 'Alex', email: 'a@x.com' })
    expect(s.standups).toHaveLength(1)
  })

  it('survives empty and corrupt input', () => {
    expect(projectStructured({})).toEqual({ projects: [], sprints: [], teams: [], standups: [] })
    expect(projectStructured({ lira_projects: '{bad', lira_standups: 'x' }).projects).toEqual([])
  })
})

describe('syncStructured (Dexie tables)', () => {
  beforeEach(() => localStorage.clear())

  it('fills the tables from localStorage and replaces them on the next sync', async () => {
    for (const [k, v] of Object.entries(raw)) localStorage.setItem(k, v)
    await syncStructured()
    expect(await db.projects.count()).toBe(1)
    expect((await db.sprints.where('sprint').equals('2026-11').toArray())[0].goal).toBe('Ship')
    expect(await db.teams.where('kind').equals('scope').count()).toBe(1)
    expect((await db.standups.get('s1'))?.title).toBe('Daily')

    localStorage.removeItem('lira_standups')
    localStorage.setItem('lira_projects', JSON.stringify([{ id: 'p2', key: 'X', name: 'X' }]))
    await syncStructured()
    expect(await db.standups.count()).toBe(0)
    expect((await db.projects.toArray()).map(p => p.id)).toEqual(['p2'])
  })
})
