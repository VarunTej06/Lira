import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeIssue } from '../test/factories'
import {
  addPlannedSprint, allSprintKeys, burndown, daysLeft, getIssueSprint, getPlannedSprints, getSprintMeta,
  issuesInSprint, nextSprint, prevSprint, setSprintMeta, shiftSprint, sprintDays, sprintKey, sprintLabel,
  sprintName, sprintPhase, sprintStats,
} from './sprintUtils'

describe('sprint keys (monthly sprints)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-15T12:00:00')) })
  afterEach(() => vi.useRealTimers())

  it('uses YYYY-MM for a date', () => {
    expect(sprintKey(new Date(2026, 0, 31))).toBe('2026-01')
    expect(sprintKey(new Date(2026, 11, 1))).toBe('2026-12')
  })

  it('shifts across year boundaries', () => {
    expect(nextSprint('2026-12')).toBe('2027-01')
    expect(prevSprint('2027-01')).toBe('2026-12')
    expect(shiftSprint('2026-11', -11)).toBe('2025-12')
    expect(shiftSprint('2026-11', 14)).toBe('2028-01')
  })

  it('knows month length, including leap years', () => {
    expect(sprintDays('2026-11')).toBe(30)
    expect(sprintDays('2026-12')).toBe(31)
    expect(sprintDays('2028-02')).toBe(29)
    expect(sprintDays('2027-02')).toBe(28)
  })

  it('labels sprints', () => {
    expect(sprintLabel('2026-11')).toBe('November 2026')
    expect(sprintLabel('2026-11', true)).toBe("Nov '26")
    expect(sprintName('2026-12')).toBe('December 2026 Sprint')
  })

  it('computes phase relative to the current month', () => {
    expect(sprintPhase('2026-10')).toBe('past')
    expect(sprintPhase('2026-11')).toBe('active')
    expect(sprintPhase('2026-12')).toBe('upcoming')
  })

  it('counts days left', () => {
    expect(daysLeft('2026-10')).toBe(0)
    expect(daysLeft('2026-11')).toBe(15)
    expect(daysLeft('2026-12')).toBe(31)
  })
})

describe('ticket to sprint membership', () => {
  it('prefers the explicit stamp, falls back to creation month', () => {
    expect(getIssueSprint(makeIssue({ sprint: '2026-09' }))).toBe('2026-09')
    expect(getIssueSprint(makeIssue({ sprint: undefined, createdAt: new Date('2026-03-20T10:00:00') }))).toBe('2026-03')
  })

  it('keeps epics out of sprints', () => {
    const task = makeIssue({ sprint: '2026-11' })
    const epic = makeIssue({ type: 'epic', sprint: '2026-11' })
    expect(issuesInSprint([task, epic], '2026-11')).toEqual([task])
  })
})

describe('sprintStats', () => {
  it('summarises status, points and carry-over', () => {
    const list = [
      makeIssue({ status: 'done', storyPoints: 3 }),
      makeIssue({ status: 'inprogress', storyPoints: 5 }),
      makeIssue({ status: 'todo', sprintHistory: ['2026-10'] }),
      makeIssue({ status: 'backlog' }),
    ]
    expect(sprintStats(list)).toMatchObject({
      total: 4, done: 1, inprogress: 1, todo: 1, backlog: 1, open: 3, points: 8, donePoints: 3, percent: 25, carriedIn: 1,
    })
  })

  it('handles an empty sprint', () => {
    expect(sprintStats([])).toMatchObject({ total: 0, percent: 0, points: 0 })
  })
})

describe('burndown', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-10T12:00:00')) })
  afterEach(() => vi.useRealTimers())

  it('drops the actual line when tickets are resolved and stops at today', () => {
    const list = [
      makeIssue({ status: 'done', resolvedAt: new Date('2026-11-03T10:00:00') }),
      makeIssue({ status: 'todo' }),
    ]
    const points = burndown(list, '2026-11')
    expect(points).toHaveLength(30)
    expect(points[0]).toMatchObject({ day: 1, actual: 2 })
    expect(points[2].actual).toBe(1) // resolved on day 3
    expect(points[9].actual).toBe(1) // today
    expect(points[10].actual).toBeNull() // future
    expect(points[29].ideal).toBe(0)
  })

  it('shows no actual line for an upcoming sprint', () => {
    expect(burndown([makeIssue()], '2026-12').every(p => p.actual === null)).toBe(true)
  })
})

describe('planned sprints and metadata (localStorage)', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-15T12:00:00')) })
  afterEach(() => vi.useRealTimers())

  it('stores planned sprints sorted and de-duplicated', () => {
    addPlannedSprint('2027-02')
    addPlannedSprint('2027-01')
    addPlannedSprint('2027-02')
    expect(getPlannedSprints()).toEqual(['2027-01', '2027-02'])
  })

  it('ignores corrupt planned-sprint data', () => {
    localStorage.setItem('lira_planned_sprints', '["nope","2027-01"]')
    expect(getPlannedSprints()).toEqual(['2027-01'])
    localStorage.setItem('lira_planned_sprints', '{bad')
    expect(getPlannedSprints()).toEqual([])
  })

  it('lists a contiguous range covering tickets, planned months and current/next', () => {
    addPlannedSprint('2027-01')
    const old = makeIssue({ sprint: '2026-09' })
    expect(allSprintKeys([old])).toEqual(['2026-09', '2026-10', '2026-11', '2026-12', '2027-01'])
  })

  it('merges sprint metadata per space and sprint', () => {
    setSprintMeta(1, '2026-11', { goal: 'Ship it' })
    setSprintMeta(1, '2026-11', { completedAt: '2026-11-30T00:00:00.000Z' })
    expect(getSprintMeta(1, '2026-11')).toEqual({ goal: 'Ship it', completedAt: '2026-11-30T00:00:00.000Z' })
    expect(getSprintMeta('all', '2026-11')).toEqual({})
  })
})
