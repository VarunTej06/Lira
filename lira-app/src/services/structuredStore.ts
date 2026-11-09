/**
 * Structured (queryable) copy of the settings-style data, kept in Dexie tables:
 * projects, sprints, teams, standups.
 *
 * Source of truth is unchanged: the `lira_*` localStorage keys, which kvMirror saves to data/*.json.
 * This module projects those keys into rows after every change, so screens can use `useLiveQuery`
 * on real tables instead of parsing localStorage. It is one-way: nothing is read back from these tables.
 */
import { db } from '../db/db'

export interface ProjectRow { id: string; [field: string]: unknown }
export interface SprintRow {
  id: string
  spaceId: number | 'all'
  sprint: string // YYYY-MM (a month) or YYYY-MM-DD (a weekly / bi-weekly / N-day sprint starting that day)
  goal?: string
  completedAt?: string
  start?: string
  end?: string
  kind?: string
  planned: boolean
}
export interface TeamRow {
  id: string
  kind: 'scope' | 'member'
  owner?: string // scope teams: "space:6", "project:proj-x", "global"
  memberKeys?: string[]
  name?: string
  email?: string
}
export interface StandupRow { id: string; scopeId: string; [field: string]: unknown }

interface Structured {
  projects: ProjectRow[]
  sprints: SprintRow[]
  teams: TeamRow[]
  standups: StandupRow[]
}

function parse<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback
  try { return JSON.parse(raw) as T } catch { return fallback }
}

/** Pure projection of raw `lira_*` values into table rows. */
export function projectStructured(local: Record<string, string>): Structured {
  const projects = parse<ProjectRow[]>(local.lira_projects, []).filter(p => p && typeof p.id === 'string')

  const sprints: SprintRow[] = []
  const meta = parse<Record<string, { goal?: string; completedAt?: string }>>(local.lira_sprint_meta, {})
  for (const [k, v] of Object.entries(meta)) {
    const [space, sprint] = k.split(':')
    if (!sprint) continue
    sprints.push({ id: k, spaceId: space === 'all' ? 'all' : Number(space), sprint, goal: v.goal, completedAt: v.completedAt, planned: false })
  }
  for (const sprint of parse<string[]>(local.lira_planned_sprints, [])) {
    if (/^\d{4}-\d{2}$/.test(sprint)) sprints.push({ id: `planned:${sprint}`, spaceId: 'all', sprint, planned: true })
  }
  for (const [sprint, def] of Object.entries(parse<Record<string, { start: string; end: string; kind: string }>>(local.lira_sprint_defs, {}))) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(sprint) && def) sprints.push({ id: `custom:${sprint}`, spaceId: 'all', sprint, planned: true, start: def.start, end: def.end, kind: def.kind })
  }

  const teams: TeamRow[] = []
  for (const [k, v] of Object.entries(local)) {
    if (k.startsWith('lira_scope_team:')) {
      const owner = k.slice('lira_scope_team:'.length)
      teams.push({ id: `scope:${owner}`, kind: 'scope', owner, memberKeys: parse<string[]>(v, []) })
    }
  }
  const dir = parse<Record<string, { key: string; name: string; email: string }>>(local.lira_team_directory, {})
  for (const m of Object.values(dir)) teams.push({ id: `member:${m.key}`, kind: 'member', name: m.name, email: m.email })

  const standups = parse<StandupRow[]>(local.lira_standups, []).filter(s => s && typeof s.id === 'string')
  return { projects, sprints, teams, standups }
}

let running = false
let again = false

/** Replaces the table contents with the current localStorage state. Safe to call often. */
export async function syncStructured(): Promise<void> {
  if (running) { again = true; return }
  running = true
  try {
    const local: Record<string, string> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('lira_') && !k.startsWith('lira__')) local[k] = localStorage.getItem(k) as string
    }
    const s = projectStructured(local)
    await db.transaction('rw', [db.projects, db.sprints, db.teams, db.standups], async () => {
      await Promise.all([db.projects.clear(), db.sprints.clear(), db.teams.clear(), db.standups.clear()])
      await Promise.all([
        db.projects.bulkPut(s.projects),
        db.sprints.bulkPut(s.sprints),
        db.teams.bulkPut(s.teams),
        db.standups.bulkPut(s.standups),
      ])
    })
  } catch (err) {
    console.warn('[StructuredStore] Could not update tables:', err)
  } finally {
    running = false
    if (again) { again = false; void syncStructured() }
  }
}
