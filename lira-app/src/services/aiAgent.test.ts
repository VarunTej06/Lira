import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/db'
import { makeIssue, makeSpace } from '../test/factories'
import { processUserMessage } from './aiAgentService'

const ap = makeSpace({ id: 2, key: 'AP', name: 'Atmos - Weather App' })
const cert = makeSpace({ id: 1, key: 'CERT', name: 'Certifications' })
const spaces = [cert, ap]

async function seed() {
  await db.issues.clear(); await db.spaces.clear()
  await db.spaces.bulkAdd(spaces)
  const add = async (o: Parameters<typeof makeIssue>[0]) => (await db.issues.get(await db.issues.add(makeIssue({ ...o, id: undefined }) as never) as number))!
  const epic = await add({ spaceId: 2, key: 'AP-1', type: 'epic', title: 'Weather platform', status: 'inprogress' })
  const t10 = await add({ spaceId: 2, key: 'AP-10', title: 'Add radar layer for docker', status: 'todo', priority: 'high', parentId: epic.id, epicId: epic.id, description: 'uses docker' })
  await add({ spaceId: 2, key: 'AP-11', title: 'Write docs', status: 'backlog' })
  await add({ spaceId: 1, key: 'CERT-1', title: 'AZ-104', status: 'inprogress', priority: 'low' })
  await add({ spaceId: 1, key: 'CERT-2', title: 'AZ-900', status: 'done' })
  return { epic, t10 }
}

beforeEach(async () => {
  localStorage.clear()
  vi.stubGlobal('fetch', async () => new Response('{}'))
  await seed()
})
afterEach(() => vi.unstubAllGlobals())

const ask = (text: string, mode: 'info' | 'agent' = 'agent') => processUserMessage(text, ap, spaces, mode)

describe('Viva AI agent: writing', () => {
  it('moves a ticket to another status', async () => {
    const r = await ask('move AP-10 to done')
    expect(r.actionTaken?.type).toBe('updated_status')
    expect(r.text).toContain('AP-10')
    const t = (await db.issues.where('key').equals('AP-10').first())!
    expect(t.status).toBe('done')
    expect(t.resolvedAt).toBeTruthy()
  })

  it('breaks a ticket down into subtasks', async () => {
    const before = (await db.issues.where('key').equals('AP-10').first())!.subtasks.length
    const r = await ask('generate subtasks for AP-10')
    expect(r.actionTaken?.type).toBe('added_subtasks')
    expect((await db.issues.where('key').equals('AP-10').first())!.subtasks.length).toBeGreaterThan(before)
  })

  it('creates a ticket in the space named in the prompt, with the priority asked for; a new ticket starts in To Do even when another status is asked for', async () => {
    const r = await ask('create a bug login crashes in Certifications with high priority in progress')
    expect(r.actionTaken?.type).toBe('created_issue')
    const created = (await db.issues.toArray()).find(i => i.key.startsWith('CERT-') && i.type === 'bug')!
    expect(created.title.toLowerCase()).toContain('login crashes')
    expect(created.priority).toBe('high')
    expect(created.status).toBe('todo')
    expect(created.spaceId).toBe(1)
    expect(created.key).toBe('CERT-3')
  })

  it('refuses to write in read-only (info) mode and points to the agent', async () => {
    const r = await ask('move AP-10 to done', 'info')
    expect(r.actionTaken?.type).toBe('switch_to_agent')
    expect((await db.issues.where('key').equals('AP-10').first())!.status).toBe('todo')
  })
})

describe('Viva AI agent: reading', () => {
  it('shows the details of a ticket', async () => {
    const r = await ask('tell me about AP-10')
    expect(r.text).toContain('Ticket Details')
    expect(r.text).toContain('Add radar layer')
    expect(r.suggestedActions?.length).toBeGreaterThan(0)
  })

  it('builds the status matrix across spaces', async () => {
    const r = await ask('show status breakdown of all spaces')
    expect(r.text).toContain('Certifications')
    expect(r.text).toContain('Atmos')
  })

  it('breaks tickets down by priority', async () => {
    const r = await ask('tickets by priority')
    expect(r.text.toLowerCase()).toContain('priority')
  })

  it('lists the tickets of one space', async () => {
    const r = await ask('what tasks are in Certifications')
    expect(r.text).toContain('CERT-1')
    expect(r.text).not.toContain('AP-11')
  })

  it('lists epics across spaces', async () => {
    const r = await ask('show all epics')
    expect(r.text).toContain('AP-1')
  })

  it('answers what is in progress across spaces', async () => {
    const r = await ask('what is in progress across all spaces')
    expect(r.text).toContain('CERT-1')
  })

  it('searches by keyword in titles, descriptions and labels', async () => {
    const r = await ask('search for docker')
    expect(r.text).toContain('AP-10')
    expect(r.text).toContain('Search Results')
  })

  it('falls back to a friendly overview, which differs between modes', async () => {
    const agent = await ask('hello there')
    const info = await ask('hello there', 'info')
    expect(agent.text).toContain('Autonomous Agent')
    expect(info.text).toContain('Read-Only')
    expect(agent.suggestedActions?.length).toBeGreaterThan(0)
  })

  it('records how the prompt was understood', async () => {
    const r = await ask('move AP-10 to done')
    expect(r.refinedPrompt?.intentType).toBe('status_transition')
    expect(r.refinedPrompt?.targetTicketKey).toBe('AP-10')
  })
})
