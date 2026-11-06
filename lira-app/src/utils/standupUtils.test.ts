import { beforeEach, describe, expect, it } from 'vitest'
import { makeIssue } from '../test/factories'
import {
  addScopeExtra, buildAgenda, googleCalendarUrl, icsFile, issuesForScope, loadNotes, loadScopeExtras, mailtoUrl,
  ownerKeys, removeScopeExtra, rrule, saveNotes, startEnd, teamFromIssues, teamsUrl,
  type Standup, type StandupScope, type TeamMember,
} from './standupUtils'

const NOW = new Date('2026-11-10T12:00:00').getTime()
const DAY = 86_400_000
const ago = (days: number) => new Date(NOW - days * DAY)

const standup: Standup = {
  id: 's1', scopeId: 'space:1', title: 'Daily standup', startDate: '2026-11-11', time: '09:30', duration: 15,
  repeat: 'weekdays', platform: 'meet', link: '', memberKeys: [], createdAt: '2026-11-01T00:00:00.000Z',
}

describe('buildAgenda', () => {
  it('flags overdue, idle in-progress, due-soon, unassigned and stale work', () => {
    const overdue = makeIssue({ status: 'todo', dueDate: ago(3) })
    const idle = makeIssue({ status: 'inprogress', assigneeInitials: 'AB', updatedAt: ago(6) })
    const dueSoon = makeIssue({ status: 'todo', dueDate: new Date(NOW + DAY) })
    const unassigned = makeIssue({ status: 'inprogress', updatedAt: ago(0) })
    const stale = makeIssue({ status: 'backlog', updatedAt: ago(20) })
    const fresh = makeIssue({ status: 'todo', updatedAt: ago(1) })
    const a = buildAgenda([overdue, idle, dueSoon, unassigned, stale, fresh], [], NOW)

    const byId = Object.fromEntries(a.needsUpdate.map(x => [x.issue.id, x]))
    expect(byId[overdue.id!].reason).toBe('Overdue by 3d')
    expect(byId[overdue.id!].severity).toBe('high')
    expect(byId[idle.id!].reason).toBe('In progress, no update for 6d')
    expect(byId[idle.id!].severity).toBe('high')
    expect(byId[dueSoon.id!].reason).toBe('Due within 2 days')
    expect(byId[unassigned.id!].reason).toBe('In progress but unassigned')
    expect(byId[stale.id!].severity).toBe('low')
    expect(byId[fresh.id!]).toBeUndefined()
    expect(a.needsUpdate[0].severity).toBe('high') // most severe first
  })

  it('groups by status and orders by priority', () => {
    const low = makeIssue({ status: 'inprogress', priority: 'low', assigneeInitials: 'A', updatedAt: ago(0) })
    const high = makeIssue({ status: 'inprogress', priority: 'highest', assigneeInitials: 'A', updatedAt: ago(0) })
    const done = makeIssue({ status: 'done', updatedAt: new Date(NOW - 3600_000) })
    const oldDone = makeIssue({ status: 'done', updatedAt: ago(5) })
    const a = buildAgenda([low, high, done, oldDone], [], NOW)
    expect(a.inProgress.map(i => i.id)).toEqual([high.id, low.id])
    expect(a.doneRecently.map(i => i.id)).toEqual([done.id])
  })

  it('detects tickets blocked by unfinished work only', () => {
    const blocker = makeIssue({ status: 'todo' })
    const finished = makeIssue({ status: 'done' })
    const blocked = makeIssue({
      status: 'inprogress', assigneeInitials: 'A', updatedAt: ago(0),
      linkedIssues: [{ id: 'l1', issueId: blocker.id!, linkType: 'blocked_by' }],
    })
    const notBlocked = makeIssue({
      status: 'todo', linkedIssues: [{ id: 'l2', issueId: finished.id!, linkType: 'blocked_by' }],
    })
    const a = buildAgenda([blocked, notBlocked], [blocker, finished, blocked, notBlocked], NOW)
    expect(a.blocked).toHaveLength(1)
    expect(a.blocked[0].issue.id).toBe(blocked.id)
    expect(a.blocked[0].blockedBy[0].id).toBe(blocker.id)
  })
})

describe('scopes and teams', () => {
  const inSpace1 = makeIssue({ spaceId: 1, sprint: '2026-11', key: 'AAA-1' })
  const inSpace2 = makeIssue({ spaceId: 2, sprint: '2026-10', key: 'BBB-1' })
  const epic = makeIssue({ spaceId: 1, type: 'epic' })
  const all = [inSpace1, inSpace2, epic]

  it('filters tickets by space, project and sprint, never including epics', () => {
    const space: StandupScope = { type: 'space', id: 'space:1', name: 'A', spaceId: 1 }
    expect(issuesForScope(all, space)).toEqual([inSpace1])
    const project: StandupScope = { type: 'project', id: 'project:p', name: 'P', projectKey: 'BBB' }
    expect(issuesForScope(all, project)).toEqual([inSpace2])
    const sprint: StandupScope = { type: 'sprint', id: 'sprint:2026-11:all', name: 'S', sprint: '2026-11' }
    expect(issuesForScope(all, sprint)).toEqual([inSpace1])
    expect(issuesForScope(all, { ...sprint, spaceId: 2 })).toEqual([])
  })

  it('derives the team from assignees using directory details', () => {
    const dir: Record<string, TeamMember> = { AB: { key: 'AB', name: 'Alex B', email: 'alex@x.com' } }
    const team = teamFromIssues([makeIssue({ assigneeInitials: 'AB' }), makeIssue({ assigneeInitials: 'VY' }), makeIssue()], dir)
    expect(team.map(m => m.key)).toEqual(['AB', 'VY'])
    expect(team[0].email).toBe('alex@x.com')
    expect(team[1].name).toBe('Varun Tej')
  })

  it('resolves storage owners: project inherits from its space', () => {
    expect(ownerKeys({ type: 'space', id: 'space:1', name: 'A', spaceId: 1 })).toEqual(['space:1'])
    expect(ownerKeys({ type: 'project', id: 'project:p', name: 'P', spaceId: 3 })).toEqual(['project:p', 'space:3'])
    expect(ownerKeys({ type: 'sprint', id: 'sprint:x', name: 'S', sprint: '2026-11' })).toEqual(['global'])
  })

  describe('added team members (localStorage)', () => {
    beforeEach(() => localStorage.clear())
    const space: StandupScope = { type: 'space', id: 'space:1', name: 'A', spaceId: 1 }
    const project: StandupScope = { type: 'project', id: 'project:p', name: 'P', spaceId: 1 }

    it('adds, inherits and removes members', () => {
      addScopeExtra(space, 'ZZ')
      addScopeExtra(space, 'ZZ')
      expect(loadScopeExtras(space)).toEqual(['ZZ'])
      expect(loadScopeExtras(project)).toEqual(['ZZ'])
      removeScopeExtra(space, 'ZZ')
      expect(loadScopeExtras(space)).toEqual([])
    })

    it('stores notes per scope and day', () => {
      saveNotes('space:1', '2026-11-10', 'hello')
      expect(loadNotes('space:1', '2026-11-10')).toBe('hello')
      expect(loadNotes('space:1', '2026-11-11')).toBe('')
    })
  })
})

describe('invites', () => {
  it('computes start/end from date, time and duration', () => {
    const { start, end } = startEnd(standup)
    expect(start.getHours()).toBe(9)
    expect(start.getMinutes()).toBe(30)
    expect(end.getTime() - start.getTime()).toBe(15 * 60_000)
  })

  it('builds recurrence rules', () => {
    const wed = new Date('2026-11-11T09:00:00')
    expect(rrule('none', wed)).toBeUndefined()
    expect(rrule('daily', wed)).toBe('RRULE:FREQ=DAILY')
    expect(rrule('weekdays', wed)).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')
    expect(rrule('weekly', wed)).toBe('RRULE:FREQ=WEEKLY;BYDAY=WE')
  })

  it('builds a Google Calendar link with attendees and recurrence', () => {
    const url = new URL(googleCalendarUrl(standup, ['a@x.com', 'b@x.com'], 'Agenda'))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe('Daily standup')
    expect(url.searchParams.get('add')).toBe('a@x.com,b@x.com')
    expect(url.searchParams.get('recur')).toContain('FREQ=WEEKLY')
    expect(url.searchParams.get('dates')).toMatch(/^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/)
    expect(url.searchParams.get('location')).toBeNull()
  })

  it('adds the pasted meeting link as location', () => {
    const url = new URL(googleCalendarUrl({ ...standup, link: 'https://meet.google.com/abc' }, [], ''))
    expect(url.searchParams.get('location')).toBe('https://meet.google.com/abc')
  })

  it('builds a Teams deep link', () => {
    const url = new URL(teamsUrl(standup, ['a@x.com'], 'Agenda'))
    expect(url.origin + url.pathname).toBe('https://teams.microsoft.com/l/meeting/new')
    expect(url.searchParams.get('subject')).toBe('Daily standup')
    expect(url.searchParams.get('attendees')).toBe('a@x.com')
    expect(url.searchParams.get('startTime')).toMatch(/^2026-11-11T09:30:00[+-]\d{2}:\d{2}$/)
    expect(new URL(teamsUrl(standup, [], '')).searchParams.has('attendees')).toBe(false)
  })

  it('builds a mailto link', () => {
    const url = mailtoUrl(standup, ['a@x.com', 'b@x.com'], 'Line 1\nLine 2')
    expect(url.startsWith('mailto:a@x.com,b@x.com?subject=Daily%20standup&body=')).toBe(true)
    expect(decodeURIComponent(url.split('body=')[1])).toBe('Line 1\nLine 2')
  })

  it('builds a valid .ics with escaped text and skips attendees without email', () => {
    const ics = icsFile(standup, [
      { key: 'A', name: 'Alex', email: 'alex@x.com' },
      { key: 'B', name: 'No Mail', email: '' },
    ], 'Hello, team; see\nagenda')
    const lines = ics.split('\r\n')
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines.at(-1)).toBe('END:VCALENDAR')
    expect(lines).toContain('UID:s1@lira.local')
    expect(lines).toContain('SUMMARY:Daily standup')
    expect(lines).toContain('DESCRIPTION:Hello\\, team\\; see\\nagenda')
    expect(lines).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')
    expect(lines.filter(l => l.startsWith('ATTENDEE'))).toEqual([
      'ATTENDEE;CN=Alex;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:alex@x.com',
    ])
  })
})
