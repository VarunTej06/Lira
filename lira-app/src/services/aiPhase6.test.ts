import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/db'
import { makeIssue, makeSpace } from '../test/factories'
import { confirmAndRun, processUserMessage, suggestForTicket, undoAction } from './aiAgentService'
import { refineUserPrompt } from './ai/intent'
import { planSprintFromBacklog, sprintRisk, idleTickets, standupDigestText, standupSince } from './ai/sprintInsights'
import { getAiProvider, setAiProvider, setOpenAiConfig } from './ai/settings'
import { currentSprintKey, nextSprint, setSprintMeta, setSprintSpaces, sprintIncludesSpace, getSprintSpaces } from '../utils/sprintUtils'
import type { Issue } from '../types/issue'

const ap = makeSpace({ id: 2, key: 'AP', name: 'Atmos - Weather App' })
const cert = makeSpace({ id: 1, key: 'CERT', name: 'Certifications' })
const spaces = [cert, ap]
const cur = () => currentSprintKey()
const nxt = () => nextSprint(currentSprintKey())

const add = async (o: Parameters<typeof makeIssue>[0]) => (await db.issues.get(await db.issues.add(makeIssue({ sprint: cur(), ...o, id: undefined }) as never) as number))!
const byKey = async (k: string) => (await db.issues.where('key').equals(k).first())!

beforeEach(async () => {
  localStorage.clear()
  vi.stubGlobal('fetch', async () => new Response('{}'))
  await db.issues.clear(); await db.spaces.clear(); await db.spaces.bulkAdd(spaces)
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('Phase 6: preview, confirm and undo', () => {
  beforeEach(async () => { await add({ spaceId: 2, key: 'AP-10', title: 'Add radar layer', status: 'todo' }) })

  it('shows what a move would do and changes nothing until confirmed', async () => {
    const r = await processUserMessage('move AP-10 to done', ap, spaces, 'agent', { confirmWrites: true })
    expect(r.pending?.state).toBe('waiting')
    expect(r.text).toContain('AP-10')
    expect(r.text).toContain('DONE')
    expect((await byKey('AP-10')).status).toBe('todo')
  })

  it('runs after Confirm, and Undo puts the ticket back exactly', async () => {
    const before = await byKey('AP-10')
    const r = await confirmAndRun('move AP-10 to done', ap, spaces)
    expect((await byKey('AP-10')).status).toBe('done')
    expect(r.undo?.state).toBe('available')
    expect(r.undo?.changed).toBe(1)
    expect(await undoAction(r.undo!.id)).toBe(1)
    const after = await byKey('AP-10')
    expect(after.status).toBe('todo')
    expect(after.resolvedAt).toBeUndefined()
    expect(after.statusLog).toEqual(before.statusLog)
  })

  it('undoes a created ticket by removing it', async () => {
    const n = await db.issues.count()
    const r = await confirmAndRun('create a task Fix login redirect in Certifications', ap, spaces)
    expect(await db.issues.count()).toBe(n + 1)
    await undoAction(r.undo!.id)
    expect(await db.issues.count()).toBe(n)
  })

  it('an undo can only be used once', async () => {
    const r = await confirmAndRun('move AP-10 to inprogress', ap, spaces)
    expect(await undoAction(r.undo!.id)).toBe(1)
    expect(await undoAction(r.undo!.id)).toBeNull()
  })

  it('previews a create with possible duplicates', async () => {
    await add({ spaceId: 1, key: 'CERT-5', title: 'Fix login redirect loop', status: 'todo' })
    const r = await processUserMessage('create a task Fix login redirect in Certifications', ap, spaces, 'agent', { confirmWrites: true })
    expect(r.pending).toBeTruthy()
    expect(r.text).toContain('Possible duplicate')
    expect(r.text).toContain('CERT-5')
  })

  it('without confirmWrites it still acts at once (existing behaviour)', async () => {
    const r = await processUserMessage('move AP-10 to done', ap, spaces)
    expect(r.pending).toBeUndefined()
    expect((await byKey('AP-10')).status).toBe('done')
  })

  it('asking about a ticket that does not exist is not previewed', async () => {
    const r = await processUserMessage('move AP-999 to done', ap, spaces, 'agent', { confirmWrites: true })
    expect(r.pending).toBeUndefined()
  })
})

describe('Phase 6: sprint-aware prompts', () => {
  it('understands the sprint requests', () => {
    const g = (t: string) => refineUserPrompt(t, spaces, [], ap)
    expect(g('plan next sprint from my backlog')).toMatchObject({ intent: 'sprint_plan', targetSprint: nxt() })
    expect(g('plan this sprint')).toMatchObject({ intent: 'sprint_plan', targetSprint: cur() })
    expect(g('summarise this sprint').intent).toBe('sprint_summary')
    expect(g('Summarise next sprint')).toMatchObject({ intent: 'sprint_summary', targetSprint: nxt() })
    expect(g('write my standup').intent).toBe('standup_digest')
    expect(g('show the risk radar').intent).toBe('risk_radar')
    expect(g('which tickets are idle').intent).toBe('risk_radar')
  })

  it('plans the next sprint from the backlog, highest priority first, within capacity', async () => {
    await add({ spaceId: 2, key: 'AP-1', title: 'low one', status: 'backlog', priority: 'low', storyPoints: 5 })
    await add({ spaceId: 2, key: 'AP-2', title: 'urgent one', status: 'backlog', priority: 'highest', storyPoints: 5 })
    await add({ spaceId: 2, key: 'AP-3', title: 'big one', status: 'backlog', priority: 'high', storyPoints: 13 })
    await add({ spaceId: 2, key: 'AP-4', title: 'already todo', status: 'todo', priority: 'highest', storyPoints: 1 })
    setSprintMeta('all', nxt(), { capacity: 10 })
    const plan = planSprintFromBacklog(await db.issues.toArray(), nxt())
    expect(plan.picked.map(i => i.key)).toEqual(['AP-2', 'AP-1'])
    expect(plan.skipped.map(i => i.key)).toEqual(['AP-3'])
    expect(plan.pickedPoints).toBe(10)
    expect(plan.capacitySource).toBe('set')
  })

  it('only takes tickets from spaces that work in that sprint', async () => {
    await add({ spaceId: 1, key: 'CERT-1', title: 'cert thing', status: 'backlog', storyPoints: 1 })
    await add({ spaceId: 2, key: 'AP-1', title: 'ap thing', status: 'backlog', storyPoints: 1 })
    setSprintSpaces(nxt(), [2])
    const plan = planSprintFromBacklog(await db.issues.toArray(), nxt())
    expect(plan.picked.map(i => i.key)).toEqual(['AP-1'])
  })

  it('moves the planned tickets when confirmed, and undo moves them back', async () => {
    await add({ spaceId: 2, key: 'AP-1', title: 'one', status: 'backlog', storyPoints: 2 })
    const preview = await processUserMessage('plan next sprint from my backlog', ap, spaces, 'agent', { confirmWrites: true })
    expect(preview.pending).toBeTruthy()
    expect((await byKey('AP-1')).sprint).toBe(cur())
    const r = await confirmAndRun('plan next sprint from my backlog', ap, spaces)
    expect((await byKey('AP-1')).sprint).toBe(nxt())
    await undoAction(r.undo!.id)
    expect((await byKey('AP-1')).sprint).toBe(cur())
  })

  it('summarises a sprint', async () => {
    await add({ spaceId: 2, key: 'AP-1', title: 'one', status: 'done', resolvedAt: new Date() })
    await add({ spaceId: 2, key: 'AP-2', title: 'two', status: 'todo', priority: 'high' })
    const r = await processUserMessage('summarise this sprint', ap, spaces)
    expect(r.text).toContain('1 of 2')
    expect(r.text).toContain('AP-2')
  })
})

describe('Phase 6: standup digest and risk radar', () => {
  it('standup looks back to Friday on a Monday', () => {
    const mon = new Date(2026, 10, 9, 10) // Mon 9 Nov 2026
    expect(standupSince(mon).getDate()).toBe(6)
    expect(standupSince(new Date(2026, 10, 11, 10)).getDate()).toBe(10)
  })

  it('writes yesterday / today / blockers from what changed', () => {
    const now = new Date(2026, 10, 11, 10)
    const issues = [
      makeIssue({ id: 1, spaceId: 2, key: 'AP-1', title: 'shipped it', status: 'done', resolvedAt: new Date(2026, 10, 10, 15) }),
      makeIssue({ id: 2, spaceId: 2, key: 'AP-2', title: 'working on it', status: 'inprogress', updatedAt: new Date(2026, 10, 11, 9) }),
      makeIssue({ id: 3, spaceId: 2, key: 'AP-3', title: 'stuck one', status: 'inprogress', updatedAt: new Date(2026, 10, 1) }),
      makeIssue({ id: 4, spaceId: 2, key: 'AP-4', title: 'old win', status: 'done', resolvedAt: new Date(2026, 10, 2) }),
    ] as Issue[]
    const t = standupDigestText(issues, spaces, now)
    expect(t).toContain('AP-1')
    expect(t).not.toContain('AP-4')
    expect(t.split('**Today**')[1].split('**Blockers')[0]).toContain('AP-2')
    expect(t.split('**Blockers and risks**')[1]).toContain('AP-3')
  })

  it('finds idle in-progress tickets', () => {
    const now = new Date(2026, 10, 11)
    const l = idleTickets([
      makeIssue({ id: 1, key: 'A-1', status: 'inprogress', updatedAt: new Date(2026, 10, 1) }),
      makeIssue({ id: 2, key: 'A-2', status: 'inprogress', updatedAt: new Date(2026, 10, 10) }),
      makeIssue({ id: 3, key: 'A-3', status: 'todo', updatedAt: new Date(2026, 9, 1) }),
    ] as Issue[], now)
    expect(l.map(x => x.issue.key)).toEqual(['A-1'])
  })

  it('flags a sprint that is far behind its time, and one that is on pace', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 20, 12)) // 20 of 30 days gone
    const mk = (n: number, done: number) => Array.from({ length: n }, (_, i) => makeIssue({ id: i + 1, key: `T-${i}`, status: i < done ? 'done' : 'todo', sprint: '2026-11' })) as Issue[]
    expect(sprintRisk(mk(10, 1), '2026-11').level).toBe('atrisk')
    expect(sprintRisk(mk(10, 7), '2026-11').level).toBe('ok')
    expect(sprintRisk(mk(10, 7), '2026-10').level).toBe('atrisk') // ended with unfinished work
  })

  it('answers "risk radar" in the chat', async () => {
    await add({ spaceId: 2, key: 'AP-1', title: 'stuck', status: 'inprogress', updatedAt: new Date(Date.now() - 20 * 86400000) })
    const r = await processUserMessage('show the risk radar', ap, spaces)
    expect(r.text).toContain('Risk radar')
    expect(r.text).toContain('AP-1')
  })
})

describe('Phase 6: suggestions while creating a ticket', () => {
  const existing = [
    makeIssue({ id: 1, spaceId: 2, key: 'AP-1', type: 'epic', title: 'Docker platform' }),
    makeIssue({ id: 2, spaceId: 2, key: 'AP-2', title: 'Write Dockerfile for the API', parentId: 1, epicId: 1, labels: ['docker', 'devops'] }),
    makeIssue({ id: 3, spaceId: 2, key: 'AP-3', title: 'Fix login redirect loop', status: 'todo' }),
    makeIssue({ id: 4, spaceId: 1, key: 'CERT-1', title: 'Fix login redirect loop elsewhere', status: 'todo' }),
  ] as Issue[]

  it('spots duplicates in the same space only', () => {
    const s = suggestForTicket('Fix login redirect loop', '', 'bug', existing, 2)
    expect(s.duplicates.map(d => d.issue.key)).toEqual(['AP-3'])
  })

  it('suggests labels from similar tickets and from the topic', () => {
    const s = suggestForTicket('Write Dockerfile for the worker', 'multi-stage docker build', 'task', existing, 2)
    expect(s.labels).toContain('docker')
  })

  it('suggests the epic whose tickets read alike', () => {
    expect(suggestForTicket('Dockerfile for the scheduler', '', 'task', existing, 2).epic?.key).toBe('AP-1')
    expect(suggestForTicket('Fix login redirect loop', '', 'task', existing, 2).epic).toBeUndefined()
  })

  it('suggests a priority from urgency words', () => {
    expect(suggestForTicket('Production login crashes', '', 'bug', existing, 2).priority).toBe('highest')
    expect(suggestForTicket('Fix a typo in the footer', '', 'task', existing, 2).priority).toBe('low')
    expect(suggestForTicket('Add export button', '', 'task', existing, 2).priority).toBeUndefined()
  })
})

describe('Phase 6: choosing the model', () => {
  it('defaults to the built-in engine, or Gemini when a key already exists', () => {
    expect(getAiProvider()).toBe('local')
    localStorage.setItem('lira_gemini_api_key', 'k')
    expect(getAiProvider()).toBe('gemini')
    setAiProvider('local')
    expect(getAiProvider()).toBe('local')
  })

  it('asks an OpenAI-compatible server for questions, and falls back to the engine when it fails', async () => {
    await add({ spaceId: 2, key: 'AP-1', title: 'docker thing', status: 'todo' })
    setAiProvider('openai')
    setOpenAiConfig({ baseUrl: 'http://localhost:11434/v1/', model: 'llama3.1', apiKey: 'sekret' })
    const calls: { url: string; body: { model: string }; auth: string | null }[] = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string), auth: new Headers(init.headers).get('Authorization') })
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Hello from the local model' } }] }))
    })
    const r = await processUserMessage('what should I look at first?', ap, spaces)
    expect(r.text).toBe('Hello from the local model')
    expect(calls[0].url).toBe('http://localhost:11434/v1/chat/completions')
    expect(calls[0].body.model).toBe('llama3.1')
    expect(calls[0].auth).toBe('Bearer sekret')

    vi.stubGlobal('fetch', async () => new Response('nope', { status: 500 }))
    const fallback = await processUserMessage('tell me about AP-1', ap, spaces)
    expect(fallback.text).toContain('AP-1')
  })

  it('never lets the model handle a write: moves still use the engine', async () => {
    await add({ spaceId: 2, key: 'AP-1', title: 'docker thing', status: 'todo' })
    setAiProvider('openai')
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'x' } }] })))
    vi.stubGlobal('fetch', fetchSpy)
    await processUserMessage('move AP-1 to done', ap, spaces)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect((await byKey('AP-1')).status).toBe('done')
  })
})

describe('Sprint spaces', () => {
  it('lets every space in unless the sprint is limited', () => {
    expect(getSprintSpaces(nxt())).toBeNull()
    expect(sprintIncludesSpace(nxt(), 1)).toBe(true)
    setSprintSpaces(nxt(), [2])
    expect(getSprintSpaces(nxt())).toEqual([2])
    expect(sprintIncludesSpace(nxt(), 1)).toBe(false)
    expect(sprintIncludesSpace(nxt(), 2)).toBe(true)
    setSprintSpaces(nxt(), null)
    expect(sprintIncludesSpace(nxt(), 1)).toBe(true)
  })
})
