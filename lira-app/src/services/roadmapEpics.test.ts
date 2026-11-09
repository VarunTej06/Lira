import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/db'
import { makeIssue, makeSpace } from '../test/factories'
import { seedLiraRoadmap, type RoadmapItem } from '../utils/roadmapUtils'
import { addTicketToEpic, createEpicForItem, ensureEpics, setTicketDate, syncEpicFromItem } from './roadmapEpics'

const lira = makeSpace({ id: 6, key: 'LIRA', name: 'Lira' })

beforeEach(async () => {
  vi.stubGlobal('fetch', async () => new Response('{}'))
  await db.issues.clear(); await db.spaces.clear()
  await db.spaces.add(lira)
})
afterEach(() => vi.unstubAllGlobals())

describe('roadmap items are epics', () => {
  it('creates one epic per item in the roadmap space, in the Backlog, with the item dates', async () => {
    const rm = seedLiraRoadmap()
    const res = await ensureEpics(rm, [lira])
    expect(res.error).toBeUndefined()
    expect(res.created).toHaveLength(rm.items.length)
    expect(res.items.every(i => !!i.epicKey)).toBe(true)

    const epics = (await db.issues.toArray()).filter(i => i.type === 'epic')
    expect(epics).toHaveLength(rm.items.length)
    expect(new Set(epics.map(e => e.key)).size).toBe(epics.length)
    expect(epics.every(e => e.spaceId === 6 && e.key.startsWith('LIRA-'))).toBe(true)

    const phase2 = res.items.find(i => i.title.startsWith('Phase 2'))!
    const e2 = epics.find(e => e.key === phase2.epicKey)!
    expect(e2.status).toBe('backlog')
    expect(e2.title).toBe(phase2.title)
    expect(new Date(e2.startDate!).toDateString()).toBe(new Date(2026, 10, 7).toDateString())
    expect(new Date(e2.dueDate!).toDateString()).toBe(new Date(2026, 10, 8).toDateString())
    // finished work does not go back to the Backlog
    expect(epics.find(e => e.key === res.items.find(i => i.id === 'p1')!.epicKey)!.status).toBe('done')
  })

  it('does not create duplicates when called again, but recreates a deleted epic', async () => {
    const rm = seedLiraRoadmap()
    const first = await ensureEpics(rm, [lira])
    const linked = { ...rm, items: first.items }
    expect((await ensureEpics(linked, [lira])).created).toEqual([])
    const gone = first.items[0].epicKey!
    await db.issues.where('key').equals(gone).delete()
    const again = await ensureEpics(linked, [lira])
    expect(again.created).toHaveLength(1)
    expect((await db.issues.toArray()).filter(i => i.type === 'epic').length).toBe(rm.items.length)
  })

  it('reports a clear error when the space does not exist', async () => {
    const res = await ensureEpics({ ...seedLiraRoadmap(), spaceKey: 'NOPE' }, [lira])
    expect(res.created).toEqual([])
    expect(res.error).toMatch(/NOPE/)
    expect(await db.issues.count()).toBe(0)
  })

  it('keeps the epic in step when the item changes', async () => {
    const item: RoadmapItem = { ...seedLiraRoadmap().items[1], epicKey: undefined }
    const key = await createEpicForItem(item, lira, 'RM')
    const linked = { ...item, epicKey: key, title: 'Renamed', start: '2026-12-01', end: '2026-12-20', status: 'inprogress' as const }
    await syncEpicFromItem(linked)
    let epic = (await db.issues.where('key').equals(key).first())!
    expect(epic.title).toBe('Renamed')
    expect(new Date(epic.dueDate!).getDate()).toBe(20)
    expect(epic.status).toBe('backlog') // status only follows when asked
    await syncEpicFromItem(linked, { status: true })
    epic = (await db.issues.where('key').equals(key).first())!
    expect(epic.status).toBe('inprogress')
  })
})

describe('planner drag and drop updates the ticket', () => {
  it('sets the due date and moves the ticket to that month\'s sprint', async () => {
    const id = await db.issues.add(makeIssue({ id: undefined, spaceId: 6, key: 'LIRA-70', type: 'task', sprint: '2026-11', dueDate: new Date(2026, 10, 20) }) as never) as number
    const t = (await db.issues.get(id))!
    await setTicketDate(t, new Date(2027, 0, 12))
    const after = (await db.issues.get(id))!
    expect(new Date(after.dueDate!).toDateString()).toBe(new Date(2027, 0, 12).toDateString())
    expect(after.sprint).toBe('2027-01')
    expect(after.sprintHistory).toContain('2026-11')
    expect(after.activity.length).toBeGreaterThan(t.activity.length)
  })

  it('keeps the sprint when the new date is in the same month', async () => {
    const id = await db.issues.add(makeIssue({ id: undefined, spaceId: 6, key: 'LIRA-71', type: 'task', sprint: '2026-11', dueDate: new Date(2026, 10, 5) }) as never) as number
    await setTicketDate((await db.issues.get(id))!, new Date(2026, 10, 25))
    const after = (await db.issues.get(id))!
    expect(after.sprint).toBe('2026-11')
    expect(new Date(after.dueDate!).getDate()).toBe(25)
  })

  it('quick-adds a task under an epic', async () => {
    const epicId = await db.issues.add(makeIssue({ id: undefined, spaceId: 6, key: 'LIRA-80', type: 'epic' }) as never) as number
    await addTicketToEpic((await db.issues.get(epicId))!, '  Wire the router  ', new Date(2026, 11, 3))
    const task = (await db.issues.toArray()).find(i => i.title === 'Wire the router')!
    expect(task.type).toBe('task')
    expect(task.parentId).toBe(epicId)
    expect(task.epicId).toBe(epicId)
    expect(task.status).toBe('todo')
    expect(task.sprint).toBe('2026-12')
    expect(task.key).toBe('LIRA-81')
  })
})

describe('noSpaceMessage', () => {
  it('names the missing space, or says there is none', async () => {
    const { noSpaceMessage } = await import('./roadmapEpics');
    expect(noSpaceMessage({ spaceKey: 'ZZZ' } as never)).toBe('Space ZZZ was not found, so epics could not be created.');
    expect(noSpaceMessage({} as never)).toBe('This roadmap has no space, so epics could not be created.');
  });
});
