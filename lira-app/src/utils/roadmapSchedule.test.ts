import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/db'
import { makeSpace } from '../test/factories'
import { readRoadmaps, writeRoadmaps } from '../hooks/useRoadmaps'
import { ensureEpics, syncPendingRoadmaps } from '../services/roadmapEpics'
import { allSprintKeys } from './sprintUtils'
import {
  LIRA_SCHEDULE_VERSION, daysBetween, dependencyIssues, migrateLiraSchedule, parseDay, seedLiraRoadmap, type Roadmap,
} from './roadmapUtils'

describe('the November plan (built-in Lira roadmap)', () => {
  const rm = seedLiraRoadmap()

  it('every item takes two days and everything is inside November 2026', () => {
    for (const i of rm.items) {
      expect(daysBetween(parseDay(i.start), parseDay(i.end)) + 1, i.title).toBe(2)
      expect(i.start.startsWith('2026-11'), i.title).toBe(true)
      expect(i.end.startsWith('2026-11'), i.title).toBe(true)
    }
    for (const m of rm.milestones) expect(m.date.startsWith('2026-11'), m.title).toBe(true)
  })

  it('keeps every dependency in order, and one person is never double-booked', () => {
    expect(dependencyIssues(rm.items)).toEqual([])
    const sorted = [...rm.items].sort((a, b) => a.start.localeCompare(b.start))
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].start > sorted[i - 1].end).toBe(true)
  })

  it('does not create any sprint beyond the next month', () => {
    // a ticket for each item, filed in the month of its end date
    const issues = rm.items.map((i, n) => ({ type: 'task', sprint: i.end.slice(0, 7), id: n + 1 })) as never[]
    const cur = '2026-11'
    expect(allSprintKeys(issues).filter(k => k > '2026-12')).toEqual([])
    expect(allSprintKeys(issues)).toContain(cur)
  })
})

describe('upgrading a roadmap saved with the old long schedule', () => {
  const old = (): Roadmap => {
    const r = seedLiraRoadmap()
    return {
      ...r, scheduleVersion: undefined, description: 'old',
      items: r.items.map(i => (i.id === 'p4' ? { ...i, start: '2027-01-04', end: '2027-02-12' } : i.id === 'p2' ? { ...i, start: '2026-11-09', end: '2026-11-30' } : i)),
      milestones: [
        ...r.milestones.filter(m => m.id !== 'ms-dec').map(m => (m.id === 'ms-v33' ? { ...m, date: '2027-02-12' } : m)),
        { id: 'mine', title: 'My own milestone', date: '2026-12-24', kind: 'milestone' as const },
      ],
    }
  }

  it('moves the known items and milestones into November, keeps what the user added, and flags the tickets for syncing', () => {
    const up = migrateLiraSchedule(old())
    expect(up.scheduleVersion).toBe(LIRA_SCHEDULE_VERSION)
    expect(up.pendingTicketSync).toBe(true)
    expect(up.items.find(i => i.id === 'p4')).toMatchObject({ start: '2026-11-17', end: '2026-11-18' })
    expect(up.items.find(i => i.id === 'p2')).toMatchObject({ start: '2026-11-07', end: '2026-11-08' })
    expect(up.milestones.find(m => m.id === 'ms-v33')!.date).toBe('2026-11-18')
    expect(up.milestones.find(m => m.id === 'mine')!.date).toBe('2026-12-24')
    expect(up.milestones.some(m => m.id === 'ms-dec')).toBe(true)
  })

  it('does it once only, and leaves other roadmaps alone', () => {
    const up = migrateLiraSchedule(old())
    const dragged = { ...up, pendingTicketSync: false, items: up.items.map(i => (i.id === 'p3' ? { ...i, start: '2026-11-25', end: '2026-11-26' } : i)) }
    expect(migrateLiraSchedule(dragged)).toBe(dragged) // user edits after the upgrade survive
    const other = { ...old(), id: 'rm-other' }
    expect(migrateLiraSchedule(other)).toBe(other)
  })

  it('is applied when roadmaps are read from storage', () => {
    localStorage.clear()
    localStorage.setItem('lira_roadmaps', JSON.stringify([old()]))
    const [rm] = readRoadmaps()
    expect(rm.items.find(i => i.id === 'p6')).toMatchObject({ start: '2026-11-21', end: '2026-11-22' })
  })
})

describe('epics and tasks follow the new schedule', () => {
  const lira = makeSpace({ id: 6, key: 'LIRA', name: 'Lira' })
  beforeEach(async () => {
    localStorage.clear()
    vi.stubGlobal('fetch', async () => new Response('{}'))
    await db.issues.clear(); await db.spaces.clear(); await db.spaces.add(lira)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('moves the dates of epics and checklist tasks, and pulls far-future tasks back into November', async () => {
    // an existing roadmap with the old long schedule, and the epics / tasks created for it
    const base = seedLiraRoadmap()
    const created = await ensureEpics(base, [lira])
    const longAgo = '2027-04-15'
    // make the stored tasks look like the old version: dated and filed far away
    for (const i of created.items.filter(i => i.taskKey)) {
      const t = (await db.issues.where('key').equals(i.taskKey!).first())!
      await db.issues.update(t.id!, { dueDate: parseDay(longAgo), sprint: '2027-04' })
    }
    const stored = { ...base, items: created.items, scheduleVersion: undefined, pendingTicketSync: undefined } as Roadmap
    localStorage.setItem('lira_roadmaps', JSON.stringify([stored]))

    expect(await syncPendingRoadmaps()).toBe(base.items.length)

    const all = await db.issues.toArray()
    const tasks = all.filter(i => i.type === 'task')
    expect(tasks.length).toBeGreaterThan(0)
    for (const t of tasks) {
      expect(t.sprint).toBe('2026-11')
      expect(new Date(t.dueDate!).getMonth()).toBe(10)
    }
    const p6 = created.items.find(i => i.id === 'p6')!
    const epic = all.find(i => i.key === p6.epicKey)!
    expect(new Date(epic.dueDate!).toDateString()).toBe(new Date(2026, 10, 22).toDateString())
    expect(allSprintKeys(all).filter(k => k > '2026-12')).toEqual([])

    // flagged only once: the flag is cleared and a second start-up does nothing
    expect(readRoadmaps()[0].pendingTicketSync).toBe(false)
    expect(await syncPendingRoadmaps()).toBe(0)
  })

  it('does nothing when no roadmap is waiting', async () => {
    writeRoadmaps([seedLiraRoadmap()])
    expect(await syncPendingRoadmaps()).toBe(0)
  })
})
