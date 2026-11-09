/**
 * Disk persistence helpers used by the Vite dev-server plugin (vite.config.ts).
 * Kept free of Vite imports so they can be unit-tested.
 *
 * Files written (all under <repo>/data):
 *   projects.json, sprints.json, teams.json, standups.json, board-config.json, dashboards.json, settings.json
 *   roadmaps/index.json + roadmaps/<id>.json   <- one file per roadmap
 *   private/secrets.json   <- git-ignored (API keys)
 */
import fs from 'node:fs'
import path from 'node:path'

const STORE_FILES = ['projects', 'roadmaps', 'sprints', 'teams', 'standups', 'board-config', 'dashboards', 'settings', 'secrets'] as const
type StoreFile = (typeof STORE_FILES)[number]
type StoreEntries = Record<string, unknown>

export const isStoreFile = (name: string): name is StoreFile => (STORE_FILES as readonly string[]).includes(name)

export const storePath = (dataDir: string, name: StoreFile) =>
  name === 'secrets' ? path.join(dataDir, 'private', 'secrets.json') : path.join(dataDir, `${name}.json`)

/** Recursively sorts object keys so the same data always serialises identically (stable git diffs). */
export function sortKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(sortKeys) as unknown as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as object).sort().map(k => [k, sortKeys((value as Record<string, unknown>)[k])]),
    ) as T
  }
  return value
}

type JsonObject = Record<string, unknown>
const isObject = (v: unknown): v is JsonObject => !!v && typeof v === 'object' && !Array.isArray(v)

/** A space as stored on disk: only `id` and `key` are relied on, everything else is passed through untouched. */
export interface SpaceRecord extends JsonObject { id: number; key: string; name?: string }
/** A ticket as stored on disk: only `spaceId` is relied on here. */
export interface IssueRecord extends JsonObject { spaceId?: number }
/** What the dev server hands to the app: all spaces and all tickets. */
export interface WorkspaceData extends JsonObject { spaces: SpaceRecord[]; issues: IssueRecord[]; exists?: boolean }

/** The JSON object in a file, or undefined when the file is missing, unreadable or not an object. */
function readJson(file: string): JsonObject | undefined {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'))
    return isObject(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

import { safeSpaceKey, hasPrototypePollution } from './guard.ts'

const safeId = (id: unknown) => String(id).replace(/[^a-zA-Z0-9_-]/g, '_')
const roadmapsDir = (dataDir: string) => path.join(dataDir, 'roadmaps')

/** Roadmaps live in data/roadmaps/<id>.json (one file each) with an index; the old single data/roadmaps.json is still read. */
function readRoadmaps(dataDir: string): unknown[] | undefined {
  const dir = roadmapsDir(dataDir)
  const index = readJson(path.join(dir, 'index.json'))
  if (index && Array.isArray(index.roadmaps)) {
    const out: unknown[] = []
    const seen = new Set<string>()
    const add = (file: string) => {
      if (seen.has(file)) return
      seen.add(file)
      const parsed = readJson(path.join(dir, file))
      if (parsed && parsed.roadmap) out.push(parsed.roadmap)
    }
    for (const r of index.roadmaps as { file?: string }[]) if (r && typeof r.file === 'string') add(path.basename(r.file))
    try {
      for (const f of fs.readdirSync(dir)) if (f.endsWith('.json') && f !== 'index.json') add(f) // files added by hand
    } catch { /* folder vanished */ }
    return out
  }
  const legacy = readJson(path.join(dataDir, 'roadmaps.json'))
  const legacyEntries = legacy?.entries
  if (isObject(legacyEntries) && Array.isArray(legacyEntries.lira_roadmaps)) return legacyEntries.lira_roadmaps
  return undefined
}

type RoadmapRecord = { id?: unknown; name?: unknown; items?: unknown[]; starred?: boolean; archived?: boolean }
type RoadmapIndexEntry = { id: string; name: string; file: string; items: number; starred?: boolean; archived?: boolean }

/** The line in the index for one roadmap. */
const indexEntry = (rm: RoadmapRecord, file: string): RoadmapIndexEntry => ({ id: String(rm.id), name: String(rm.name ?? ''), file, items: Array.isArray(rm.items) ? rm.items.length : 0, ...(rm.starred ? { starred: true } : {}), ...(rm.archived ? { archived: true } : {}) })

/** Deletes the files of roadmaps that were removed. Returns true when any file was deleted. */
function removeStaleRoadmapFiles(dir: string, keep: Set<string>): boolean {
  let removed = false
  try {
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.json') && !keep.has(f)) { fs.unlinkSync(path.join(dir, f)); removed = true }
    }
  } catch { /* nothing to clean */ }
  return removed
}

/** Writes one JSON file per roadmap plus an index. Only changed files are touched; removed roadmaps lose their file. */
function writeRoadmaps(dataDir: string, entries: Record<string, unknown>, now = new Date()): boolean {
  if (!Array.isArray(entries.lira_roadmaps)) return false // nothing to say about roadmaps: never delete files because a key is absent
  const list = entries.lira_roadmaps as RoadmapRecord[]
  const dir = roadmapsDir(dataDir)
  let changed = false
  const keep = new Set<string>(['index.json'])
  const ts = now.toISOString()
  const index: RoadmapIndexEntry[] = []
  for (const rm of list) {
    if (!rm || rm.id === undefined) continue
    const file = `${safeId(rm.id)}.json`
    keep.add(file)
    index.push(indexEntry(rm, file))
    if (writeJsonIfChanged(path.join(dir, file), { version: 1, updatedAt: ts, roadmap: rm }, ['updatedAt'])) changed = true
  }
  if (writeJsonIfChanged(path.join(dir, 'index.json'), { version: 1, updatedAt: ts, roadmaps: index }, ['updatedAt'])) changed = true
  if (removeStaleRoadmapFiles(dir, keep)) changed = true
  const legacy = path.join(dataDir, 'roadmaps.json')
  if (fs.existsSync(legacy)) { fs.unlinkSync(legacy); changed = true } // migrated into the folder
  return changed
}

/** Reads every store file. Missing or corrupt files are skipped. */
export function readStore(dataDir: string): Record<string, StoreEntries> {
  const out: Record<string, StoreEntries> = {}
  for (const name of STORE_FILES) {
    if (name === 'roadmaps') {
      const list = readRoadmaps(dataDir)
      if (list) out.roadmaps = { lira_roadmaps: list }
      continue
    }
    const parsed = readJson(storePath(dataDir, name))
    if (parsed && isObject(parsed.entries)) out[name] = parsed.entries
  }
  return out
}

/**
 * Writes the given store files. A file is only touched when its entries actually changed,
 * and `updatedAt` only moves when they do. Returns the names that were written.
 */
export function writeStore(dataDir: string, files: Record<string, StoreEntries>, now = new Date()): string[] {
  const written: string[] = []
  if (hasPrototypePollution(files)) throw new Error('Refusing to save: reserved key in data')
  for (const [name, entries] of Object.entries(files)) {
    if (!isStoreFile(name) || !entries || typeof entries !== 'object') continue
    if (name === 'roadmaps') {
      if (writeRoadmaps(dataDir, entries, now)) written.push(name)
      continue
    }
    const file = storePath(dataDir, name)
    const sorted = sortKeys(entries)
    const existing = readJson(file)
    if (existing && JSON.stringify(existing.entries) === JSON.stringify(sorted)) continue
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const payload = { version: 1, updatedAt: now.toISOString(), entries: sorted }
    fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf-8')
    written.push(name)
  }
  return written
}

/**
 * Writes `payload` as JSON unless the file already holds identical content,
 * ignoring the timestamp fields in `tsKeys` (so a save with no real change leaves git clean).
 */
export function writeJsonIfChanged(file: string, payload: Record<string, unknown>, tsKeys: string[] = []): boolean {
  const strip = (o: Record<string, unknown>) => {
    const c = { ...o }
    tsKeys.forEach(k => delete c[k])
    return JSON.stringify(c)
  }
  const existing = readJson(file)
  if (existing && typeof existing === 'object' && strip(existing) === strip(payload)) return false
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf-8')
  return true
}

/** Splits tickets by space. Tickets whose space is gone are returned as orphans so nothing is lost. */
function groupBySpace(spaces: SpaceRecord[], issues: IssueRecord[]) {
  const bySpace = new Map<number, IssueRecord[]>(spaces.map(s => [s.id, []]))
  const orphans: IssueRecord[] = []
  for (const issue of issues) {
    const list = issue.spaceId === undefined ? undefined : bySpace.get(issue.spaceId)
    if (list) list.push(issue)
    else orphans.push(issue)
  }
  return { bySpace, orphans }
}

/**
 * Tickets and spaces: data/spaces.json (manifest), data/spaces/<KEY>.json (one file per space) and the
 * consolidated data/lira-workspace.json. Every write goes through writeJsonIfChanged, so a save only
 * touches the files whose content really changed.
 */
export function createSpaceStore(dataDir: string) {
  const spacesDir = path.resolve(dataDir, 'spaces')
  const spacesManifestFile = path.resolve(dataDir, 'spaces.json')
  const legacyDataFile = path.resolve(dataDir, 'lira-workspace.json')

  const ensureDirs = () => {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    if (!fs.existsSync(spacesDir)) {
      fs.mkdirSync(spacesDir, { recursive: true })
    }
  }

  /** The tickets in one file. A file holds either a bare list or { issues: [...] }. */
  function readIssueFile(file: string, errorLabel: string): IssueRecord[] {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'))
      if (Array.isArray(parsed)) return parsed as IssueRecord[]
      return isObject(parsed) && Array.isArray(parsed.issues) ? (parsed.issues as IssueRecord[]) : []
    } catch (err) {
      console.error(errorLabel, err)
      return []
    }
  }

  /** The primary layout: the manifest plus one file per space (and the orphans file). */
  function loadFromSpaceFiles(): WorkspaceData | undefined {
    if (!fs.existsSync(spacesManifestFile) || !fs.existsSync(spacesDir)) return undefined
    try {
      const manifest = JSON.parse(fs.readFileSync(spacesManifestFile, 'utf-8')) as JsonObject
      const spaces = (Array.isArray(manifest.spaces) ? manifest.spaces : []) as SpaceRecord[]
      const issues: IssueRecord[] = []
      for (const space of spaces) {
        const spaceFile = path.resolve(spacesDir, `${safeSpaceKey(space.key, space.id)}.json`)
        if (fs.existsSync(spaceFile)) issues.push(...readIssueFile(spaceFile, `[LocalFileDB] Error reading space file ${spaceFile}:`))
      }
      const orphanFile = path.resolve(spacesDir, '_orphans.json')
      if (fs.existsSync(orphanFile)) issues.push(...readIssueFile(orphanFile, '[LocalFileDB] Error reading orphan issues file:'))
      return {
        version: '2.0.0',
        savedAt: typeof manifest.savedAt === 'string' ? manifest.savedAt : new Date().toISOString(),
        filePath: 'data/spaces/*.json',
        spaces,
        issues,
      }
    } catch (err) {
      console.warn('[LocalFileDB] Error loading space files, checking legacy file:', err)
      return undefined
    }
  }

  /** The old single file. It is read once and migrated into the per-space layout. */
  function loadFromLegacyFile(): WorkspaceData | undefined {
    if (!fs.existsSync(legacyDataFile)) return undefined
    try {
      const parsed = JSON.parse(fs.readFileSync(legacyDataFile, 'utf-8')) as WorkspaceData
      if (Array.isArray(parsed.spaces) && parsed.spaces.length > 0) saveAllDataToDisk(parsed.spaces, parsed.issues || [])
      return parsed
    } catch (err) {
      console.error('[LocalFileDB] Error reading legacy data file:', err)
      return undefined
    }
  }

  function loadAllDataFromDisk(): WorkspaceData {
    ensureDirs()
    return loadFromSpaceFiles() ?? loadFromLegacyFile() ?? { exists: false, spaces: [], issues: [] }
  }

  /** Writes one file per space and returns the manifest entries. `activeFiles` collects the file names that must stay. */
  function writeSpaceFiles(spaces: SpaceRecord[], bySpace: Map<number, IssueRecord[]>, nowIso: string, activeFiles: Set<string>) {
    return spaces.map(space => {
      const fileName = `${safeSpaceKey(space.key, space.id)}.json`
      activeFiles.add(fileName)
      const spaceIssues = bySpace.get(space.id) || []
      writeJsonIfChanged(path.resolve(spacesDir, fileName), {
        version: '2.0.0',
        spaceId: space.id,
        spaceKey: space.key,
        spaceName: space.name,
        updatedAt: nowIso,
        issueCount: spaceIssues.length,
        space,
        issues: spaceIssues,
      }, ['updatedAt'])
      return { ...space, issueCount: spaceIssues.length, file: `spaces/${fileName}` }
    })
  }

  /** Deletes the files of spaces that no longer exist. */
  function removeStaleSpaceFiles(activeFiles: Set<string>) {
    try {
      for (const file of fs.readdirSync(spacesDir)) {
        if (file.endsWith('.json') && !activeFiles.has(file)) fs.unlinkSync(path.resolve(spacesDir, file))
      }
    } catch (err) {
      console.warn('[LocalFileDB] Stale file cleanup warning:', err)
    }
  }

  function saveAllDataToDisk(spaces: SpaceRecord[], issues: IssueRecord[]) {
    ensureDirs()
    const nowIso = new Date().toISOString()
    const { bySpace, orphans } = groupBySpace(spaces, issues)
    const activeFiles = new Set<string>()

    const manifestSpaces = writeSpaceFiles(spaces, bySpace, nowIso, activeFiles)

    if (orphans.length > 0) {
      activeFiles.add('_orphans.json')
      writeJsonIfChanged(path.resolve(spacesDir, '_orphans.json'), {
        version: '2.0.0',
        updatedAt: nowIso,
        count: orphans.length,
        issues: orphans,
      }, ['updatedAt'])
    }

    writeJsonIfChanged(spacesManifestFile, {
      version: '2.0.0',
      savedAt: nowIso,
      spaceCount: spaces.length,
      totalIssueCount: issues.length,
      spaces: manifestSpaces,
    }, ['savedAt'])

    removeStaleSpaceFiles(activeFiles)

    // keep the master consolidated lira-workspace.json in step
    try {
      writeJsonIfChanged(legacyDataFile, { version: '2.0.0', savedAt: nowIso, filePath: legacyDataFile, spaces, issues }, ['savedAt'])
    } catch (err) {
      console.warn('[LocalFileDB] Error updating master lira-workspace.json:', err)
    }

    return {
      success: true,
      savedAt: nowIso,
      filePath: 'data/spaces/*.json',
      counts: { spaces: spaces.length, issues: issues.length, spaceFiles: manifestSpaces.length },
    }
  }

  return { ensureDirs, loadAllDataFromDisk, saveAllDataToDisk }
}
