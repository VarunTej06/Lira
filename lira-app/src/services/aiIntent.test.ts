import { describe, expect, it } from 'vitest'
import { makeIssue, makeSpace } from '../test/factories'
import { findTargetSpace, refineUserPrompt } from './aiAgentService'

const cert = makeSpace({ id: 1, name: 'Certifications', key: 'CERT' })
const atmos = makeSpace({ id: 2, name: 'Atmos - Weather App', key: 'AP' })
const lira = makeSpace({ id: 3, name: 'Lira', key: 'LIRA' })
const spaces = [cert, atmos, lira]
const ap10 = makeIssue({ id: 10, spaceId: 2, key: 'AP-10', title: 'Add radar layer' })

describe('findTargetSpace', () => {
  it('matches by key, name, name word and alias', () => {
    expect(findTargetSpace('show tickets in AP', spaces)).toBe(atmos)
    expect(findTargetSpace('what is in certifications', spaces)).toBe(cert)
    expect(findTargetSpace('weather work', spaces)).toBe(atmos)
    expect(findTargetSpace('anything about lira', spaces)).toBe(lira)
  })

  it('does not match a key inside another word', () => {
    expect(findTargetSpace('capture the map', spaces)).toBeUndefined()
  })
})

describe('refineUserPrompt intent detection', () => {
  const refine = (text: string) => refineUserPrompt(text, spaces, [ap10], cert)

  it('detects status transitions and normalises ticket keys', () => {
    for (const text of ['move AP-10 to done', 'mark ap10 as done', 'put AP 10 in progress']) {
      const r = refine(text)
      expect(r.intent).toBe('status_transition')
      expect(r.targetTicketKey).toBe('AP-10')
    }
    expect(refine('move AP-10 to done').targetStatus).toBe('done')
    expect(refine('put AP 10 in progress').targetStatus).toBe('inprogress')
    expect(refine('move AP-10 to backlog').targetStatus).toBe('backlog')
  })

  it('never reads "to done" as "to do"', () => {
    expect(refine('set AP-10 to done').targetStatus).toBe('done')
    expect(refine('set AP-10 to do').targetStatus).toBe('todo')
  })

  it('detects status matrix and priority breakdown requests', () => {
    expect(refine('give me a status breakdown').intent).toBe('matrix')
    expect(refine('tickets by priority').intent).toBe('priority_breakdown')
  })

  it('detects creating issues with type, title and space', () => {
    const r = refine('create a bug login crashes in AP')
    expect(r.intent).toBe('create_issue')
    expect(r.newIssueType).toBe('bug')
    expect(r.targetSpace).toBe(atmos)
  })

  it('detects subtask breakdown for a ticket', () => {
    const r = refine('generate subtasks for AP-10')
    expect(r.intent).toBe('subtask_breakdown')
    expect(r.targetTicket).toBe(ap10)
  })

  it('resolves the space from the ticket, else falls back to the active space', () => {
    expect(refine('move AP-10 to done').targetSpace).toBe(atmos)
    expect(refine('create task write docs').targetSpace).toBe(cert)
  })
})
