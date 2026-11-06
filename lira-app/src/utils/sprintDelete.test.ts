import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/db'
import { makeIssue } from '../test/factories'
import {
  addPlannedSprint, allSprintKeys, canDeleteSprint, deleteSprint, getDeletedSprints, getPlannedSprints, getSprintMeta,
  setSprintMeta, sprintDeleteTarget,
} from './sprintUtils'

beforeEach(async () => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-15T12:00:00'))
  vi.stubGlobal('fetch', async () => new Response('{}'))
  await db.issues.clear()
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

const add = async (o: Parameters<typeof makeIssue>[0]) => {
  const i = makeIssue({ ...o, id: undefined })
  const id = await db.issues.add(i as never) as number
  return (await db.issues.get(id))!
}

describe('deleting a sprint', () => {
  it('only the current and next sprints are protected', () => {
    expect(canDeleteSprint('2026-11')).toBe(false)
    expect(canDeleteSprint('2026-12')).toBe(false)
    expect(canDeleteSprint('2027-02')).toBe(true)
    expect(canDeleteSprint('2026-09')).toBe(true)
    expect(sprintDeleteTarget('2027-02')).toBe('2026-11')
  })

  it('moves the tickets to the current sprint instead of deleting them, and hides the month', async () => {
    const a = await add({ spaceId: 1, sprint: '2027-02', status: 'backlog' })
    const b = await add({ spaceId: 1, sprint: '2027-02', status: 'done' })
    const keep = await add({ spaceId: 1, sprint: '2027-04', status: 'backlog' })
    const all = await db.issues.toArray()
    expect(allSprintKeys(all)).toContain('2027-02')

    const moved = await deleteSprint('2027-02', all)
    expect(moved).toBe(2)
    const after = await db.issues.toArray()
    expect(after).toHaveLength(3) // nothing deleted
    expect(after.find(i => i.id === a.id)!.sprint).toBe('2026-11')
    expect(after.find(i => i.id === b.id)!.sprint).toBe('2026-11')
    expect(after.find(i => i.id === a.id)!.sprintHistory ?? []).not.toContain('2027-02') // moved back in time: no carry-over mark
    expect(after.find(i => i.id === keep.id)!.sprint).toBe('2027-04')

    // February is hidden although it lies between November and April
    const keys = allSprintKeys(after)
    expect(keys).not.toContain('2027-02')
    expect(keys).toContain('2027-03')
    expect(keys).toContain('2027-04')
    expect(getDeletedSprints()).toEqual(['2027-02'])
  })

  it('removes its goal, closed state and planned entry', async () => {
    addPlannedSprint('2027-03')
    setSprintMeta(1, '2027-03', { goal: 'Launch' })
    setSprintMeta('all', '2027-03', { goal: 'All spaces' })
    setSprintMeta(1, '2026-11', { goal: 'Keep me' })
    await deleteSprint('2027-03', [])
    expect(getPlannedSprints()).not.toContain('2027-03')
    expect(getSprintMeta(1, '2027-03')).toEqual({})
    expect(getSprintMeta('all', '2027-03')).toEqual({})
    expect(getSprintMeta(1, '2026-11')).toEqual({ goal: 'Keep me' })
  })

  it('refuses to delete the current or next sprint', async () => {
    const a = await add({ spaceId: 1, sprint: '2026-11' })
    expect(await deleteSprint('2026-11', [a])).toBe(0)
    expect(await deleteSprint('2026-12', [])).toBe(0)
    expect(getDeletedSprints()).toEqual([])
    expect((await db.issues.get(a.id!))!.sprint).toBe('2026-11')
  })

  it('a deleted sprint comes back when a ticket is put in it, or when it is created again', async () => {
    await deleteSprint('2027-02', [])
    await add({ spaceId: 1, sprint: '2027-04' })
    expect(allSprintKeys(await db.issues.toArray())).not.toContain('2027-02')
    await add({ spaceId: 1, sprint: '2027-02' })
    expect(allSprintKeys(await db.issues.toArray())).toContain('2027-02')

    await db.issues.clear()
    await add({ spaceId: 1, sprint: '2027-04' })
    addPlannedSprint('2027-02')
    expect(getDeletedSprints()).not.toContain('2027-02')
    expect(allSprintKeys(await db.issues.toArray())).toContain('2027-02')
  })

  it('is saved in data/sprints.json with the other sprint data', async () => {
    const { fileForKey } = await import('../services/kvMirror')
    expect(fileForKey('lira_deleted_sprints')).toBe('sprints')
  })
})
