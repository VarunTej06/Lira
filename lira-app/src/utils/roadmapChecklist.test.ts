import { describe, expect, it } from 'vitest'
import { makeIssue } from '../test/factories'
import { duplicateRoadmap, itemChecklist, itemProgress, seedLiraRoadmap, type RoadmapItem } from './roadmapUtils'

const item = (o: Partial<RoadmapItem> = {}): RoadmapItem => ({
  id: 'i1', title: 'Item', lane: 'A', status: 'planned', start: '2026-11-10', end: '2026-11-20', progress: 0,
  deps: [], children: [], ...o,
})
const sub = (title: string, completed: boolean) => ({ id: title, title, completed, createdAt: new Date() })

describe('the checklist task of a roadmap item', () => {
  const epic = makeIssue({ id: 700, type: 'epic', key: 'E-7', status: 'backlog' })
  const task = makeIssue({
    id: 701, type: 'task', key: 'E-8', parentId: 700, epicId: 700, status: 'todo',
    subtasks: [sub('a', true), sub('b', false), sub('c', true), sub('d', false)],
  })
  const linked = item({ epicKey: 'E-7', taskKey: 'E-8', children: [{ id: 'x', title: 'stale', done: false }] })

  it('shows the task subtasks as the checklist, so ticks made on the ticket appear on the roadmap', () => {
    expect(itemChecklist(linked, [epic, task])).toEqual([
      { id: 'a', title: 'a', done: true }, { id: 'b', title: 'b', done: false },
      { id: 'c', title: 'c', done: true }, { id: 'd', title: 'd', done: false },
    ])
  })

  it('falls back to the saved checklist when there is no task', () => {
    expect(itemChecklist(linked, [epic])).toEqual(linked.children)
    expect(itemChecklist(item({ children: [{ id: 'k', title: 'k', done: true }] }), [])).toHaveLength(1)
  })

  it('counts the task as the share of its subtasks that are ticked', () => {
    expect(itemProgress(linked, [epic, task])).toBe(50)
    expect(itemProgress(linked, [epic, { ...task, status: 'done' }])).toBe(100)
  })

  it('mixes the checklist task with other tickets of the epic', () => {
    const other = makeIssue({ type: 'task', status: 'done', parentId: 700, epicId: 700 })
    expect(itemProgress(linked, [epic, task, other])).toBe(75) // (0.5 + 1) / 2
  })

  it('a copied roadmap does not share the checklist task', () => {
    const src = seedLiraRoadmap()
    src.items[0].taskKey = 'LIRA-99'
    expect(duplicateRoadmap(src).items.every(i => i.taskKey === undefined)).toBe(true)
  })
})
