import { describe, expect, it } from 'vitest'
import { makeIssue } from '../test/factories'
import {
  addDays, blankRoadmap, buildHeader, buildPlannerRows, movedDate, computeRange, daysBetween, dependencyIssues, duplicateRoadmap, effectiveStatus, epicStatusFor, resolveItem, roadmapSpan, statusFromEpic, ticketDate, fmtDay, horizonOf,
  itemProgress, layoutRows, parseDay, PX_PER_DAY, resizeItem, seedLiraRoadmap, shiftItem, summarize, toCsv, xOf,
  type RoadmapItem,
} from './roadmapUtils'

const TODAY = new Date(2026, 10, 6) // 6 Nov 2026

const item = (o: Partial<RoadmapItem> = {}): RoadmapItem => ({
  id: 'i1', title: 'Item', lane: 'A', status: 'planned', start: '2026-11-10', end: '2026-11-20', progress: 0,
  deps: [], children: [], ...o,
})

describe('dates', () => {
  it('parses, formats and counts days', () => {
    expect(fmtDay(parseDay('2026-02-28'))).toBe('2026-02-28')
    expect(fmtDay(addDays(parseDay('2026-02-28'), 1))).toBe('2026-03-01')
    expect(daysBetween(parseDay('2026-11-01'), parseDay('2026-11-30'))).toBe(29)
    expect(daysBetween(parseDay('2026-11-30'), parseDay('2026-11-01'))).toBe(-29)
  })
  it('counts whole days across a DST change', () => {
    expect(daysBetween(parseDay('2026-03-01'), parseDay('2026-04-01'))).toBe(31)
    expect(daysBetween(parseDay('2026-10-01'), parseDay('2026-11-01'))).toBe(31)
  })
})

describe('timeline scale', () => {
  const rm = seedLiraRoadmap()
  const range = computeRange(rm, TODAY)

  it('covers all items and milestones, snapped to month boundaries', () => {
    expect(fmtDay(range.start)).toBe('2026-11-01')
    expect(range.end >= parseDay('2026-11-30')).toBe(true)
    expect(range.end.getDate()).toBe(new Date(range.end.getFullYear(), range.end.getMonth() + 1, 0).getDate())
  })

  it('positions dates by pixels per day', () => {
    expect(xOf(range, parseDay('2026-11-01'), 6)).toBe(0)
    expect(xOf(range, parseDay('2026-11-11'), 6)).toBe(60)
  })

  it('builds month headers whose widths add up to the whole range', () => {
    const { top, bottom } = buildHeader(range, 'months')
    expect(top[0].label).toBe('2026')
    expect(bottom[0].label).toBe('Nov')
    const total = bottom.reduce((a, c) => a + c.width, 0)
    expect(total).toBeCloseTo(range.days * PX_PER_DAY.months, 5)
  })

  it('builds quarter and week headers', () => {
    expect(buildHeader(range, 'quarters').bottom[0].label).toBe('Q4')
    const w = buildHeader(range, 'weeks')
    expect(w.top[0].label).toBe('November 2026')
    expect(w.bottom[0].x).toBeGreaterThanOrEqual(0)
  })
})

describe('layoutRows', () => {
  const a1 = item({ id: 'a1', lane: 'A', start: '2026-11-12' })
  const a2 = item({ id: 'a2', lane: 'A', start: '2026-11-03' })
  const b1 = item({ id: 'b1', lane: 'B' })

  it('puts a lane header before its items, items by start date', () => {
    const { rows, yOf } = layoutRows([a1, a2, b1], ['A', 'B'])
    expect(rows.map(r => (r.kind === 'lane' ? `lane:${r.lane}` : r.item.id))).toEqual(['lane:A', 'a2', 'a1', 'lane:B', 'b1'])
    expect(yOf.get('a2')! < yOf.get('a1')!).toBe(true)
  })

  it('hides items of a collapsed lane and keeps unknown lanes', () => {
    const c = item({ id: 'c1', lane: 'Extra' })
    const { rows } = layoutRows([a1, c], ['A'], ['A'])
    expect(rows.map(r => (r.kind === 'lane' ? `lane:${r.lane}` : r.item.id))).toEqual(['lane:A', 'lane:Extra', 'c1'])
  })
})

describe('progress and status', () => {
  it('uses the checklist, then the manual value', () => {
    expect(itemProgress(item({ progress: 40 }))).toBe(40)
    expect(itemProgress(item({ progress: 400 }))).toBe(100)
    const ch = [{ id: '1', title: 'a', done: true }, { id: '2', title: 'b', done: false }, { id: '3', title: 'c', done: false }, { id: '4', title: 'd', done: true }]
    expect(itemProgress(item({ children: ch, progress: 5 }))).toBe(50)
  })

  it('rolls progress up from the tickets of the items epic', () => {
    const epic = makeIssue({ id: 100, type: 'epic', key: 'LIRA-1', status: 'backlog' })
    const issues = [
      epic,
      makeIssue({ type: 'task', status: 'done', parentId: 100 }),
      makeIssue({ type: 'task', status: 'todo', parentId: 100 }),
      makeIssue({ type: 'bug', status: 'done', epicId: 100 }),
      makeIssue({ type: 'subtask', status: 'todo', epicId: 100 }), // subtasks are not counted
      makeIssue({ type: 'task', status: 'done' }), // unrelated
    ]
    expect(itemProgress(item({ epicKey: 'LIRA-1', progress: 0 }), issues)).toBe(67)
    // epic without tickets: manual progress, or 100 when the epic is done
    expect(itemProgress(item({ epicKey: 'NOPE-1', progress: 30 }), issues)).toBe(30)
    expect(itemProgress(item({ epicKey: 'LIRA-9', progress: 10 }), [makeIssue({ type: 'epic', key: 'LIRA-9', status: 'done' })])).toBe(100)
  })

  it('takes the status from the epic board status', () => {
    expect(statusFromEpic('backlog')).toBe('planned')
    expect(statusFromEpic('todo')).toBe('planned')
    expect(statusFromEpic('inprogress')).toBe('inprogress')
    expect(statusFromEpic('Done')).toBe('done')
    expect(effectiveStatus(item({ status: 'planned', end: '2026-12-01' }), 0, TODAY, 'inprogress')).toBe('inprogress')
    expect(effectiveStatus(item({ status: 'blocked', end: '2026-12-01' }), 0, TODAY, 'inprogress')).toBe('blocked') // manual flag kept
    expect(effectiveStatus(item({ end: '2026-11-01' }), 0, TODAY, 'backlog')).toBe('atrisk')
    expect(epicStatusFor('planned')).toBe('backlog')
    expect(epicStatusFor('atrisk')).toBe('backlog')
    expect(epicStatusFor('inprogress')).toBe('inprogress')
    expect(epicStatusFor('done')).toBe('done')
  })

  it('resolves an item together with its epic', () => {
    const epic = makeIssue({ id: 5, type: 'epic', key: 'E-1', status: 'inprogress' })
    const r = resolveItem(item({ epicKey: 'E-1', end: '2026-12-31' }), [epic, makeIssue({ type: 'task', status: 'done', parentId: 5 })], TODAY)
    expect(r.epic).toBe(epic)
    expect(r.progress).toBe(100)
    expect(r.status).toBe('done')
  })

  it('places tickets on the calendar by due date, else sprint month', () => {
    expect(ticketDate(makeIssue({ dueDate: new Date(2026, 11, 9, 15, 30) }))).toEqual({ date: new Date(2026, 11, 9), scheduled: true })
    expect(ticketDate(makeIssue({ dueDate: undefined, sprint: '2027-02' }))).toEqual({ date: new Date(2027, 1, 1), scheduled: false })
  })

  it('marks finished work done and late unfinished work at risk', () => {
    expect(effectiveStatus(item({ status: 'inprogress' }), 100, TODAY)).toBe('done')
    expect(effectiveStatus(item({ status: 'inprogress', end: '2026-11-05' }), 50, TODAY)).toBe('atrisk')
    expect(effectiveStatus(item({ status: 'planned', end: '2026-11-06' }), 0, TODAY)).toBe('planned') // ends today: not late yet
    expect(effectiveStatus(item({ status: 'blocked', end: '2026-12-01' }), 10, TODAY)).toBe('blocked')
  })

  it('assigns now / next / later / done', () => {
    expect(horizonOf(item({ start: '2026-11-01' }), 'planned', TODAY)).toBe('now')
    expect(horizonOf(item({ start: '2026-11-12' }), 'planned', TODAY)).toBe('now') // starts within a week
    expect(horizonOf(item({ start: '2026-11-20' }), 'planned', TODAY)).toBe('next')
    expect(horizonOf(item({ start: '2026-12-01' }), 'planned', TODAY)).toBe('next')
    expect(horizonOf(item({ start: '2027-03-01' }), 'planned', TODAY)).toBe('later')
    expect(horizonOf(item({ start: '2027-03-01', status: 'inprogress' }), 'inprogress', TODAY)).toBe('now')
    expect(horizonOf(item(), 'done', TODAY)).toBe('done')
  })
})

describe('dependencyIssues', () => {
  it('flags a dependency that ends after its dependant starts', () => {
    const a = item({ id: 'a', end: '2026-11-15' })
    const b = item({ id: 'b', start: '2026-11-10', deps: ['a'] })
    expect(dependencyIssues([a, b])).toEqual([{ from: 'a', to: 'b', kind: 'conflict' }])
  })
  it('accepts a dependency that finishes first', () => {
    const a = item({ id: 'a', end: '2026-11-09' })
    const b = item({ id: 'b', start: '2026-11-10', deps: ['a'] })
    expect(dependencyIssues([a, b])).toEqual([])
  })
  it('flags missing ids and cycles', () => {
    const a = item({ id: 'a', end: '2026-01-01', start: '2026-01-01', deps: ['b'] })
    const b = item({ id: 'b', end: '2025-01-01', start: '2025-01-01', deps: ['a', 'ghost'] })
    const kinds = dependencyIssues([a, b]).map(i => i.kind)
    expect(kinds).toContain('cycle')
    expect(kinds).toContain('missing')
  })
  it('the seeded Lira roadmap has no dependency problems', () => {
    expect(dependencyIssues(seedLiraRoadmap().items)).toEqual([])
  })
})

describe('editing helpers', () => {
  it('shifts an item keeping its length', () => {
    const s = shiftItem(item({ start: '2026-11-10', end: '2026-11-20' }), 5)
    expect([s.start, s.end]).toEqual(['2026-11-15', '2026-11-25'])
  })
  it('resizes edges but never past each other', () => {
    expect(resizeItem(item(), 'end', 3).end).toBe('2026-11-23')
    expect(resizeItem(item(), 'start', -4).start).toBe('2026-11-06')
    expect(resizeItem(item(), 'end', -30).end).toBe('2026-11-10')
    expect(resizeItem(item(), 'start', 30).start).toBe('2026-11-20')
  })
})

describe('summary and export', () => {
  const rm = seedLiraRoadmap()

  it('summarises the seeded roadmap on 6 Nov 2026', () => {
    const s = summarize(rm, [], TODAY)
    expect(s.total).toBe(rm.items.length)
    expect(s.byStatus.done).toBe(1) // Phase 1
    expect(s.overdue).toBe(0)
    expect(s.nextMilestone?.title).toBe('v3.1 Routing and structure') // Phase 1 complete (Nov 3) is already behind us
    expect(s.daysToNextMilestone).toBe(2)
    expect(s.percent).toBeGreaterThan(0)
    expect(s.percent).toBeLessThan(100)
  })

  it('exports CSV with escaped cells and dependency titles', () => {
    const csv = toCsv({ ...rm, items: [item({ id: 'x', title: 'Say "hi", ok' }), item({ id: 'y', title: 'Next', deps: ['x'] })], lanes: ['A'] }, [], TODAY)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Lane,Title,Status,Start,End,Progress %,Owner,Depends on,Epic')
    expect(lines[1]).toContain('"Say ""hi"", ok"')
    expect(lines[2]).toContain('"Say ""hi"", ok"') // dependency shown by title
  })
})

describe('seed roadmap content (from ROADMAP.md)', () => {
  const rm = seedLiraRoadmap()
  it('covers all seven phases and the November work', () => {
    const titles = rm.items.map(i => i.title)
    for (let n = 1; n <= 7; n++) expect(titles.some(t => t.startsWith(`Phase ${n}`))).toBe(true)
    const november = rm.items.filter(i => i.start.startsWith('2026-11') || i.end.startsWith('2026-11'))
    expect(november.length).toBeGreaterThanOrEqual(4)
    expect(rm.items.find(i => i.id === 'p1')?.status).toBe('done')
  })
  it('uses only known lanes and unique ids', () => {
    expect(rm.items.every(i => rm.lanes.includes(i.lane))).toBe(true)
    expect(new Set(rm.items.map(i => i.id)).size).toBe(rm.items.length)
  })
})

describe('roadmap collection helpers', () => {
  it('creates a blank roadmap with default lanes', () => {
    const rm = blankRoadmap({ name: '  Q1 plan ', spaceKey: 'LIRA' })
    expect(rm.name).toBe('Q1 plan')
    expect(rm.spaceKey).toBe('LIRA')
    expect(rm.lanes.length).toBeGreaterThan(0)
    expect(rm.items).toEqual([])
  })
  it('duplicates with new ids, remapped dependencies and no epic links', () => {
    const src = seedLiraRoadmap()
    src.items[0].epicKey = 'LIRA-99'
    const copy = duplicateRoadmap(src)
    expect(copy.id).not.toBe(src.id)
    expect(copy.name).toBe('Copy of Lira Platform Roadmap')
    expect(copy.items).toHaveLength(src.items.length)
    expect(copy.items.every(i => i.epicKey === undefined)).toBe(true)
    expect(copy.items.some(i => src.items.some(o => o.id === i.id))).toBe(false)
    expect(dependencyIssues(copy.items)).toEqual([])
    expect(copy.items.find(i => i.title.startsWith('Phase 2'))!.deps).toHaveLength(1)
  })
  it('reports the span of a roadmap', () => {
    expect(roadmapSpan(seedLiraRoadmap())).toEqual({ start: '2026-11-02', end: '2026-11-22' })
    expect(roadmapSpan(blankRoadmap({ name: 'x' }))).toEqual({})
  })
})

describe('planner rows (lane > epic > tickets)', () => {
  const epic = makeIssue({ id: 500, type: 'epic', key: 'E-1', status: 'backlog' })
  const late = makeIssue({ type: 'task', parentId: 500, key: 'E-3', dueDate: new Date(2026, 11, 20) })
  const early = makeIssue({ type: 'task', epicId: 500, key: 'E-2', dueDate: new Date(2026, 10, 12) })
  const noDate = makeIssue({ type: 'task', parentId: 500, key: 'E-4', dueDate: undefined, sprint: '2026-11' })
  const sub = makeIssue({ type: 'subtask', parentId: 500, key: 'E-5' })
  const issues = [epic, late, early, noDate, sub, makeIssue({ type: 'task', key: 'X-1' })]
  const a = item({ id: 'a', lane: 'A', epicKey: 'E-1' })
  const b = item({ id: 'b', lane: 'B' }) // no epic yet

  const shape = (rows: ReturnType<typeof buildPlannerRows>['rows']) =>
    rows.map(r => (r.kind === 'lane' ? `lane:${r.lane}` : r.kind === 'epic' ? `epic:${r.item.id}` : `ticket:${r.issue.key}`))

  it('lists an epic followed by its tickets in date order, without subtasks or strangers', () => {
    const { rows } = buildPlannerRows([a, b], ['A', 'B'], issues)
    expect(shape(rows)).toEqual(['lane:A', 'epic:a', 'ticket:E-4', 'ticket:E-2', 'ticket:E-3', 'lane:B', 'epic:b'])
  })

  it('hides tickets of a collapsed epic and items of a collapsed lane', () => {
    expect(shape(buildPlannerRows([a], ['A'], issues, [], ['a']).rows)).toEqual(['lane:A', 'epic:a'])
    expect(shape(buildPlannerRows([a], ['A'], issues, ['A']).rows)).toEqual(['lane:A'])
  })

  it('gives rows increasing y positions and a total height', () => {
    const { rows, height } = buildPlannerRows([a], ['A'], issues)
    const ys = rows.map(r => r.y)
    expect(ys).toEqual([...ys].sort((x, y) => x - y))
    const last = rows[rows.length - 1]
    expect(height).toBe(last.y + last.h)
  })

  it('moves a date by whole days across months and years', () => {
    expect(movedDate(new Date(2026, 10, 28), 5)).toEqual(new Date(2026, 11, 3))
    expect(movedDate(new Date(2026, 11, 30), 3)).toEqual(new Date(2027, 0, 2))
    expect(movedDate(new Date(2026, 10, 3), -5)).toEqual(new Date(2026, 9, 29))
  })
})
