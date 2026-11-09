import { afterAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * DATA HEALTH CHECK: reads your real workspace files (the data/ folder, or the folder in LIRA_DATA_DIR) and checks that
 * they hold together. It never changes anything. Run it with `npm run test:health`.
 *
 * It is not part of `npm test` because it checks YOUR data, which changes every day, not the code.
 */

const DATA = process.env.LIRA_DATA_DIR ? path.resolve(process.env.LIRA_DATA_DIR) : path.resolve(process.cwd(), '../data')
const STATUSES = ['backlog', 'todo', 'inprogress', 'done']
const PRIORITIES = ['highest', 'high', 'medium', 'low', 'lowest']
const TYPES = ['epic', 'task', 'bug', 'subtask']
const SPRINT_KEY = /^\d{4}-\d{2}(-\d{2})?$/

const readJson = (file: string): any => JSON.parse(fs.readFileSync(file, 'utf-8'))
const exists = (...p: string[]) => fs.existsSync(path.join(DATA, ...p))

const manifest = exists('spaces.json') ? readJson(path.join(DATA, 'spaces.json')) : { spaces: [] }
const spaces: any[] = manifest.spaces ?? []
const issues: any[] = spaces.flatMap(s => {
  const f = path.join(DATA, 'spaces', `${s.key}.json`)
  if (!fs.existsSync(f)) return []
  const parsed = readJson(f)
  return Array.isArray(parsed) ? parsed : parsed.issues ?? []
})
const byId = new Map(issues.map(i => [i.id, i]))
/** Things worth a look but not wrong (for example a ticket entered with a past finish date): printed at the end, they do not fail the check. */
const warnings: string[] = []
afterAll(() => { if (warnings.length) console.warn(['', `Data health: ${warnings.length} thing(s) worth a look:`, ...warnings.map(w => `  - ${w}`), ''].join('\n')) })
const bad = (list: any[], why: (i: any) => string | false) => list.map(i => { const w = why(i); return w ? `${i.key ?? i.id}: ${w}` : '' }).filter(Boolean)

describe(`Data health (${DATA})`, () => {
  it('the data folder exists and has spaces', () => {
    expect(fs.existsSync(DATA), `no data folder at ${DATA}`).toBe(true)
    expect(spaces.length).toBeGreaterThan(0)
  })

  it('every JSON file in the data folder can be read', () => {
    const all: string[] = []
    const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
      const p = path.join(d, e.name)
      if (e.isDirectory()) { if (e.name !== 'private') walk(p) } else if (e.name.endsWith('.json')) all.push(p)
    })
    walk(DATA)
    const broken = all.filter(f => { try { JSON.parse(fs.readFileSync(f, 'utf-8')); return false } catch { return true } }).map(f => path.relative(DATA, f))
    expect(broken).toEqual([])
  })

  it('every space has a unique key and its own ticket file', () => {
    const keys = spaces.map(s => s.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(spaces.filter(s => !exists('spaces', `${s.key}.json`)).map(s => s.key)).toEqual([])
    expect(spaces.filter(s => !s.name || s.id === undefined).map(s => s.key)).toEqual([])
  })

  it('ticket keys are unique, start with their space\'s key, and belong to a space', () => {
    const keys = issues.map(i => i.key)
    expect(keys.filter((k, n) => keys.indexOf(k) !== n)).toEqual([])
    const spaceById = new Map(spaces.map(s => [s.id, s]))
    expect(bad(issues, i => !spaceById.has(i.spaceId) ? 'its space does not exist' : !String(i.key).startsWith(`${spaceById.get(i.spaceId).key}-`) ? 'its key does not match its space' : false)).toEqual([])
  })

  it('ticket ids are unique', () => {
    const ids = issues.map(i => i.id)
    expect(ids.filter((k, n) => ids.indexOf(k) !== n)).toEqual([])
  })

  it('every ticket has a known status, priority and type, and a title', () => {
    expect(bad(issues, i => !STATUSES.includes(i.status) ? `unknown status "${i.status}"` : !PRIORITIES.includes(i.priority) ? `unknown priority "${i.priority}"` : !TYPES.includes(i.type) ? `unknown type "${i.type}"` : !String(i.title ?? '').trim() ? 'no title' : false)).toEqual([])
  })

  it('parents, epics and blockers point at tickets that exist (and never at themselves)', () => {
    expect(bad(issues, i => {
      for (const f of ['parentId', 'epicId']) if (i[f] !== undefined && i[f] !== null && !byId.has(i[f])) return `${f} ${i[f]} does not exist`
      if (i.parentId === i.id) return 'its own parent'
      for (const b of i.blockedByIds ?? []) { if (!byId.has(b)) return `blocked by ${b}, which does not exist`; if (b === i.id) return 'blocked by itself' }
      return false
    })).toEqual([])
  })

  it('a ticket that is switched to Blocked says what blocks it, and two tickets never block each other', () => {
    expect(bad(issues, i => i.blocked && !(i.blockedByIds ?? []).length ? 'blocked but no blocking ticket is chosen' : false)).toEqual([])
    expect(bad(issues, i => (i.blockedByIds ?? []).some((b: number) => (byId.get(b)?.blockedByIds ?? []).includes(i.id)) ? 'blocks, and is blocked by, the same ticket' : false)).toEqual([])
  })

  it('a ticket cannot be both a child of itself through its epic or its parent chain (no loops)', () => {
    expect(bad(issues, i => {
      const seen = new Set<number>(); let cur = i
      while (cur && cur.parentId !== undefined && cur.parentId !== null) { if (seen.has(cur.id)) return 'parent loop'; seen.add(cur.id); cur = byId.get(cur.parentId) }
      return false
    })).toEqual([])
  })

  it('dates are real dates', () => {
    const t = (v: unknown) => (v ? new Date(v as string).getTime() : undefined)
    expect(bad(issues, i => {
      for (const f of ['createdAt', 'updatedAt', 'dueDate', 'startDate', 'resolvedAt']) if (i[f] && Number.isNaN(t(i[f]))) return `${f} is not a date`
      return false
    })).toEqual([])
    // a ticket finished before it was created is odd (lead time would be negative) but happens when old work is entered later
    warnings.push(...bad(issues, i => (t(i.resolvedAt) !== undefined && t(i.createdAt) !== undefined && t(i.resolvedAt)! < t(i.createdAt)! - 1000 ? 'finished before it was created' : false)))
  })

  it('sprints and story points are valid', () => {
    expect(bad(issues, i => (i.sprint && !SPRINT_KEY.test(i.sprint)) ? `bad sprint "${i.sprint}"` : (i.storyPoints !== undefined && i.storyPoints !== null && (typeof i.storyPoints !== 'number' || i.storyPoints < 0)) ? 'bad story points' : false)).toEqual([])
  })

  it('comments and attachments are well formed', () => {
    expect(bad(issues, i => {
      for (const c of i.comments ?? []) if (!c.id || typeof c.content !== 'string' || !c.createdAt) return 'a comment is missing its id, text or time'
      for (const a of i.attachments ?? []) if (!a.id || !a.name) return 'an attachment is missing its id or name'
      return false
    })).toEqual([])
  })

  it('saved dashboards use widgets and filters Lira knows', () => {
    if (!exists('dashboards.json')) return
    const list: any[] = readJson(path.join(DATA, 'dashboards.json')).entries?.lira_dashboards ?? []
    const types = ['stat', 'bar', 'donut', 'trend', 'throughput', 'burndown', 'burnup', 'cfd', 'list', 'progress', 'workload', 'due', 'blocked', 'aging', 'roadmap', 'summary']
    const problems = list.flatMap(d => [
      ...(d.id && d.name ? [] : [`a dashboard has no id or name`]),
      ...(d.widgets ?? []).filter((w: any) => !types.includes(w.type)).map((w: any) => `${d.name}: unknown widget type "${w.type}"`),
      ...(d.widgets ?? []).filter((w: any) => !['S', 'M', 'L', 'XL'].includes(w.size)).map((w: any) => `${d.name}: bad widget width "${w.size}"`),
      ...((d.filters?.spaceIds ?? []).filter((id: number) => !spaces.some(s => s.id === id)).map((id: number) => `${d.name}: filters a space (${id}) that does not exist`)),
    ])
    expect(problems).toEqual([])
  })

  it('roadmap items that name an epic name one that exists', () => {
    const dir = path.join(DATA, 'roadmaps')
    if (!fs.existsSync(dir)) return
    const keys = new Set(issues.map(i => i.key))
    const missing = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json').flatMap(f => {
      const rm = readJson(path.join(dir, f)).roadmap
      return (rm?.items ?? []).filter((it: any) => it.epicKey && !keys.has(it.epicKey)).map((it: any) => `${rm.name}: ${it.title} -> ${it.epicKey}`)
    })
    expect(missing).toEqual([])
  })

  it('no secrets sit in the shared data files (keys live in data/private only)', () => {
    const files: string[] = []
    const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
      const p = path.join(d, e.name)
      if (e.isDirectory()) { if (e.name !== 'private') walk(p) } else if (e.name.endsWith('.json')) files.push(p)
    })
    walk(DATA)
    const hits = files.filter(f => /AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{30,}|ghp_[A-Za-z0-9]{30,}|"(api[_-]?key|password|secret)"\s*:\s*"[^"]{8,}"/i.test(fs.readFileSync(f, 'utf-8'))).map(f => path.relative(DATA, f))
    expect(hits).toEqual([])
  })
})
