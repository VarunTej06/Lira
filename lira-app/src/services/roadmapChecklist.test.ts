import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/db'
import { makeSpace } from '../test/factories'
import { seedLiraRoadmap } from '../utils/roadmapUtils'
import { createEpicForItem, ensureEpics, ensureTaskForItem, syncEpicFromItem, syncTaskFromItem } from './roadmapEpics'

const lira = makeSpace({ id: 6, key: 'LIRA', name: 'Lira' })

beforeEach(async () => {
  vi.stubGlobal('fetch', async () => new Response('{}'))
  await db.issues.clear(); await db.spaces.clear()
  await db.spaces.add(lira)
})
afterEach(() => vi.unstubAllGlobals())

describe('each checklist becomes one task with subtasks', () => {
  it('creates a single task per item with a checklist, under its epic, holding the checklist as subtasks', async () => {
    const rm = seedLiraRoadmap()
    const res = await ensureEpics(rm, [lira])
    expect(res.tasks).toHaveLength(rm.items.filter(i => i.children.length > 0).length)

    const all = await db.issues.toArray()
    const phase2 = res.items.find(i => i.title.startsWith('Phase 2'))!
    const epic = all.find(i => i.key === phase2.epicKey)!
    const task = all.find(i => i.key === phase2.taskKey)!
    expect(task.type).toBe('task')
    expect(task.parentId).toBe(epic.id)
    expect(task.epicId).toBe(epic.id)
    expect(task.status).toBe('backlog')
    expect(task.subtasks.map(s => s.title)).toEqual(phase2.children.map(c => c.title))
    expect(task.subtasks.every(s => !s.completed)).toBe(true)
    expect(all.filter(i => i.parentId === epic.id)).toHaveLength(1) // exactly one checklist task per epic

    // the finished phase carries its ticked checklist and is not in the backlog
    const p1 = res.items.find(i => i.id === 'p1')!
    const t1 = all.find(i => i.key === p1.taskKey)!
    expect(t1.status).toBe('done')
    expect(t1.subtasks.every(s => s.completed)).toBe(true)
  })

  it('does not create tasks twice', async () => {
    const rm = seedLiraRoadmap()
    const first = await ensureEpics(rm, [lira])
    const again = await ensureEpics({ ...rm, items: first.items }, [lira])
    expect(again.created).toEqual([])
    expect(again.tasks).toEqual([])
    expect((await db.issues.toArray()).filter(i => i.type === 'task')).toHaveLength(first.tasks.length)
  })

  it('creates a task when an item gets its first checklist entry later, and keeps the subtasks in sync', async () => {
    const base = { ...seedLiraRoadmap().items[1], children: [], taskKey: undefined, epicKey: undefined }
    const epicKey = await createEpicForItem(base, lira, 'RM')
    const item = { ...base, epicKey, children: [{ id: 'c1', title: 'First', done: false }, { id: 'c2', title: 'Second', done: true }] }
    const taskKey = (await ensureTaskForItem(item, 'RM'))!
    expect(taskKey).toBeTruthy()
    const linked = { ...item, taskKey }
    let task = (await db.issues.where('key').equals(taskKey).first())!
    expect(task.subtasks.map(s => [s.title, s.completed])).toEqual([['First', false], ['Second', true]])
    const createdAt = task.subtasks[0].createdAt

    // edit the checklist on the roadmap: tick one, add one, remove one
    await syncTaskFromItem({ ...linked, children: [{ id: 'c1', title: 'First', done: true }, { id: 'c3', title: 'Third', done: false }] })
    task = (await db.issues.where('key').equals(taskKey).first())!
    expect(task.subtasks.map(s => [s.title, s.completed])).toEqual([['First', true], ['Third', false]])
    expect(task.subtasks[0].createdAt).toEqual(createdAt) // existing subtasks keep their creation time

    // asking again does not create another task
    expect(await ensureTaskForItem(linked, 'RM')).toBe(taskKey)
    expect((await db.issues.toArray()).filter(i => i.type === 'task')).toHaveLength(1)
  })

  it('moves the task dates and title with the item', async () => {
    const res = await ensureEpics(seedLiraRoadmap(), [lira])
    const item = { ...res.items.find(i => i.id === 'p2')!, title: 'Routing, renamed', start: '2026-12-01', end: '2026-12-15' }
    await syncEpicFromItem(item)
    const task = (await db.issues.where('key').equals(item.taskKey!).first())!
    expect(task.title).toBe('Deliver: Routing, renamed')
    expect(new Date(task.dueDate!).getDate()).toBe(15)
  })

  it('a recreated epic adopts the existing checklist task', async () => {
    const rm = seedLiraRoadmap()
    const first = await ensureEpics(rm, [lira])
    const p2 = first.items.find(i => i.id === 'p2')!
    await db.issues.where('key').equals(p2.epicKey!).delete()
    const again = await ensureEpics({ ...rm, items: first.items }, [lira])
    const newKey = again.items.find(i => i.id === 'p2')!.epicKey!
    expect(newKey).not.toBe(p2.epicKey)
    const epic = (await db.issues.where('key').equals(newKey).first())!
    const task = (await db.issues.where('key').equals(p2.taskKey!).first())!
    expect(task.parentId).toBe(epic.id)
    expect(again.tasks).toEqual([]) // no second task
  })
})
