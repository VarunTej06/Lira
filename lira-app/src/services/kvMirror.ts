/**
 * Disk mirror for Lira's settings-style data (projects, sprint goals, teams, standups, board config, preferences).
 *
 * localStorage stays the fast runtime cache the app already reads and writes. This module makes sure everything
 * under the `lira_` prefix is ALSO written to JSON files in <repo>/data via the dev server (`/api/kv`), and that
 * those files are loaded back into localStorage on startup. Clearing browser storage therefore loses nothing.
 *
 * Conflict rule on startup:
 *   - key only on disk            -> restored into the browser
 *   - key only in the browser     -> kept and written to disk (this migrates pre-existing browser data)
 *   - key on both, values differ  -> disk wins, UNLESS the browser has unsaved changes (dirty flag), then browser wins
 */

import { isHosted } from '../utils/edition'
import { COLLECTIONS, isCollectionKey, loadCollection, resetHostedObjects, syncCollection } from './hostedObjects'
import { readKv, writeKv, type KvChanges } from './workspaceApi'

const MIRROR_PREFIX = 'lira_'
const INTERNAL_PREFIX = 'lira__'
const DIRTY_KEY = 'lira__kv_dirty'
const FLUSH_DELAY_MS = 500
const BOOT_TIMEOUT_MS = 3000

type StoreFileName = 'projects' | 'roadmaps' | 'sprints' | 'teams' | 'standups' | 'board-config' | 'dashboards' | 'mindmaps' | 'storyboxes' | 'settings' | 'secrets'
type FileEntries = Record<string, unknown>
type FileMap = Record<string, FileEntries>

// ─── Pure helpers (unit tested) ──────────────────────────────────────────────

export const isMirroredKey = (key: string) => key.startsWith(MIRROR_PREFIX) && !key.startsWith(INTERNAL_PREFIX)

/** The keys that belong in each file, by exact name or by prefix. The first matching rule wins; anything else is a setting. */
const FILE_RULES: { file: StoreFileName; exact?: string[]; prefix?: string[] }[] = [
  { file: 'projects', exact: ['lira_projects'], prefix: ['lira_project_settings_'] },
  { file: 'roadmaps', exact: ['lira_roadmaps'] },
  { file: 'dashboards', exact: ['lira_dashboards'] },
  { file: 'mindmaps', exact: ['lira_mindmaps'] },
  { file: 'storyboxes', exact: ['lira_storyboxes'] },
  { file: 'sprints', exact: ['lira_sprint_meta', 'lira_planned_sprints', 'lira_deleted_sprints', 'lira_sprint_defs'] },
  { file: 'teams', exact: ['lira_team_directory'], prefix: ['lira_scope_team:'] },
  { file: 'standups', exact: ['lira_standups', 'lira_standup_notes'] },
  { file: 'board-config', prefix: ['lira_wip_', 'lira_board_settings', 'lira_attachments_', 'lira_docs_', 'lira_forms_'] },
  { file: 'secrets', exact: ['lira_gemini_api_key', 'lira_ai_api_key'] },
];

/** Which JSON file a localStorage key lives in. */
export function fileForKey(key: string): StoreFileName {
  const rule = FILE_RULES.find(r => r.exact?.includes(key) || r.prefix?.some(p => key.startsWith(p)));
  return rule?.file ?? 'settings';
}

/** Objects/arrays are stored as real JSON (readable, diff-friendly); everything else stays a string. */
export function encodeValue(raw: string): unknown {
  const t = raw.trimStart()
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed
    } catch { /* not JSON, keep as text */ }
  }
  return raw
}

export const decodeValue = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v))

/** Groups every mirrored key of a Storage-like object into its file. Every known file is present (maybe empty). */
export function buildFiles(storage: Pick<Storage, 'length' | 'key' | 'getItem'>): FileMap {
  const files: FileMap = { projects: {}, roadmaps: {}, sprints: {}, teams: {}, standups: {}, 'board-config': {}, dashboards: {}, mindmaps: {}, storyboxes: {}, settings: {}, secrets: {} }
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (!k || !isMirroredKey(k)) continue
    const raw = storage.getItem(k)
    if (raw === null) continue
    files[fileForKey(k)][k] = encodeValue(raw)
  }
  return files
}

/** Flattens the files returned by the server into key -> raw string. */
export function flattenFiles(files: FileMap | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const entries of Object.values(files || {})) {
    for (const [k, v] of Object.entries(entries || {})) {
      if (isMirroredKey(k)) out[k] = decodeValue(v)
    }
  }
  return out
}

/** Semantic equality, so whitespace differences in stored JSON do not count as a change. */
function sameValue(a: string, b: string) {
  if (a === b) return true
  try { return JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b)) } catch { return false }
}

interface Reconciliation {
  /** keys to write into localStorage */
  apply: Record<string, string>
  /** true when the browser holds something the disk does not, so the disk must be updated */
  push: boolean
}

export function reconcile(local: Record<string, string>, disk: Record<string, string>, dirty: boolean): Reconciliation {
  const apply: Record<string, string> = {}
  let push = dirty
  for (const [k, dv] of Object.entries(disk)) {
    if (!(k in local)) { apply[k] = dv; continue }
    if (sameValue(local[k], dv)) continue
    if (dirty) push = true
    else apply[k] = dv
  }
  for (const k of Object.keys(local)) if (!(k in disk)) push = true
  return { apply, push }
}

// ─── Runtime ─────────────────────────────────────────────────────────────────

let enabled = false
let ready = false
let installed = false
let version = 0
let timer: number | undefined
let rawSet: Storage['setItem'] | undefined
let rawRemove: Storage['removeItem'] | undefined

/** Called after the browser copy changes or is restored (used to refresh the Dexie tables). */
let changeListener: (() => void) | undefined
export function onKvChange(fn: () => void) { changeListener = fn }

function markDirty() {
  version++
  changeListener?.()
  try { rawSet?.call(localStorage, DIRTY_KEY, String(Date.now())) } catch { /* storage unavailable */ }
  scheduleFlush()
}

function scheduleFlush() {
  if (!enabled || !ready) return
  window.clearTimeout(timer)
  timer = window.setTimeout(() => { void flushKv() }, FLUSH_DELAY_MS)
}

/** Writes all mirrored data to disk now. Resolves true when the files are saved. */
export async function flushKv(): Promise<boolean> {
  if (!enabled || !ready) return false
  window.clearTimeout(timer)
  const sent = version
  if (hostedOrg) return flushToServer(sent)
  try {
    const res = await fetch('/api/kv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: buildFiles(localStorage) }),
    })
    if (!res.ok) throw new Error(String(res.status))
    if (sent === version) rawRemove?.call(localStorage, DIRTY_KEY)
    else scheduleFlush()
    return true
  } catch (err) {
    console.warn('[KvMirror] Could not save to disk, will retry on next change:', err)
    return false
  }
}

function installStoragePatch() {
  if (installed) return
  installed = true
  const proto = Storage.prototype
  rawSet = proto.setItem
  rawRemove = proto.removeItem
  const origClear = proto.clear
  proto.setItem = function (this: Storage, key: string, value: string) {
    const before = this === localStorage && isMirroredKey(key) ? this.getItem(key) : null
    rawSet!.call(this, key, value)
    if (this === localStorage && isMirroredKey(key) && before !== String(value)) markDirty()
  }
  proto.removeItem = function (this: Storage, key: string) {
    const had = this === localStorage && isMirroredKey(key) && this.getItem(key) !== null
    rawRemove!.call(this, key)
    if (had) markDirty()
  }
  proto.clear = function (this: Storage) {
    origClear.call(this)
    // A wipe must never reach the disk: stop mirroring until the next reload restores from the files.
    if (this === localStorage) {
      ready = false
      window.clearTimeout(timer)
    }
  }
  window.addEventListener('pagehide', () => {
    if (hostedOrg || !enabled || !ready || localStorage.getItem(DIRTY_KEY) === null) return
    try {
      navigator.sendBeacon('/api/kv', new Blob([JSON.stringify({ files: buildFiles(localStorage) })], { type: 'application/json' }))
    } catch { /* best effort */ }
  })
}

/**
 * Call once before the app renders. Restores data from disk, migrates browser-only data to disk,
 * then starts mirroring every future change. Never throws; without the dev server it does nothing.
 */
export async function initKvMirror(): Promise<void> {
  installStoragePatch()
  if (isHosted()) return // the hosted edition starts after sign-in, with startHostedKv
  try {
    const ctrl = new AbortController()
    const t = window.setTimeout(() => ctrl.abort(), BOOT_TIMEOUT_MS)
    const res = await fetch('/api/kv', { signal: ctrl.signal })
    window.clearTimeout(t)
    if (!res.ok) throw new Error(String(res.status))
    const { files } = (await res.json()) as { files?: FileMap }

    const local: Record<string, string> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && isMirroredKey(k)) local[k] = localStorage.getItem(k) as string
    }
    const dirty = localStorage.getItem(DIRTY_KEY) !== null
    const { apply, push } = reconcile(local, flattenFiles(files), dirty)
    for (const [k, v] of Object.entries(apply)) rawSet!.call(localStorage, k, v) // bypass the mirror: already on disk

    enabled = true
    ready = true
    changeListener?.()
    if (push) {
      version++
      void flushKv()
    }
  } catch (err) {
    enabled = false
    console.warn('[KvMirror] Disk store unavailable, using browser storage only:', err)
  }
}

// ─── Hosted edition: the server is the store ────────────────────────────────

/** The files whose data the whole organisation shares. Everything else (preferences) belongs to the signed-in person. */
const SHARED_FILES: StoreFileName[] = ['projects', 'roadmaps', 'sprints', 'teams', 'standups', 'board-config', 'dashboards']
const MAX_ENTRIES_PER_REQUEST = 100

/** The look the person chose, kept across sign-in: they may have picked it on the public pages before signing in, and it must not change. */
const LOOK_KEYS = ['lira_theme', 'lira_light_palette', 'lira_dark_palette']

let hostedOrg: string | null = null
/** What the server holds, as it last confirmed. Changes are the difference between this and the browser's copy. */
let serverHas: Record<string, string> = {}
let mayShare = false

const isShared = (key: string) => SHARED_FILES.includes(fileForKey(key))
const syncedKeys = (): string[] => {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && isMirroredKey(k) && fileForKey(k) !== 'secrets') keys.push(k)
  }
  return keys
}

/**
 * Hosted edition, after sign-in: the server's data replaces whatever this browser held (it may belong to another account), and
 * every later change is sent to the server. The browser's copy is only a cache. Resolves false when the server cannot be asked.
 */
export async function startHostedKv(orgId: string): Promise<boolean> {
  installStoragePatch()
  const r = await readKv(orgId)
  if (!r.ok) return false
  const chosenLook = LOOK_KEYS.flatMap(k => { const v = localStorage.getItem(k); return v === null ? [] : [[k, v] as const] })
  syncedKeys().forEach(k => rawRemove!.call(localStorage, k))
  rawRemove!.call(localStorage, DIRTY_KEY)
  mayShare = r.data.shared !== null
  // projects, roadmaps and dashboards come from their own rows below, never from this shared data
  serverHas = Object.fromEntries(Object.entries({ ...(r.data.shared ?? {}), ...r.data.mine }).filter(([k]) => !isCollectionKey(k)))
  for (const [k, v] of Object.entries(serverHas)) rawSet!.call(localStorage, k, v)
  for (const key of Object.keys(COLLECTIONS)) {
    const loaded = await loadCollection(orgId, key)
    if (!loaded) return false
    if (loaded.text !== null) rawSet!.call(localStorage, key, loaded.text)
  }
  hostedOrg = orgId
  enabled = true
  ready = true
  // a look chosen before signing in stays, unless the server already has the person's own; it is then saved for next time
  for (const [k, v] of chosenLook) if (!(k in serverHas)) localStorage.setItem(k, v)
  changeListener?.()
  return true
}

/** The entries that differ from what the server has, split by who they belong to. A person without access to shared data sends none of it. */
export function diffForServer(current: Record<string, string>, server: Record<string, string>, mayShare: boolean): { shared: KvChanges; mine: KvChanges } {
  const out = { shared: {} as KvChanges, mine: {} as KvChanges }
  const put = (k: string, v: string | null) => { if (isShared(k)) { if (mayShare) out.shared[k] = v } else out.mine[k] = v }
  for (const [k, v] of Object.entries(current)) if (server[k] !== v) put(k, v)
  for (const k of Object.keys(server)) if (!(k in current)) put(k, null)
  return out
}

async function flushToServer(sent: number): Promise<boolean> {
  const current: Record<string, string> = {}
  for (const k of syncedKeys()) if (!isCollectionKey(k)) current[k] = localStorage.getItem(k) as string
  const changes = diffForServer(current, serverHas, mayShare)
  for (const scope of ['shared', 'mine'] as const) {
    const pairs = Object.entries(changes[scope])
    for (let i = 0; i < pairs.length; i += MAX_ENTRIES_PER_REQUEST) {
      const chunk = Object.fromEntries(pairs.slice(i, i + MAX_ENTRIES_PER_REQUEST))
      const r = await writeKv(hostedOrg!, { [scope]: chunk })
      if (!r.ok) { console.warn('[KvMirror] Could not save to the server, will retry:', r.message); scheduleFlush(); return false }
      for (const [k, v] of Object.entries(chunk)) { if (v === null) delete serverHas[k]; else serverHas[k] = v }
    }
  }
  for (const key of Object.keys(COLLECTIONS)) {
    const outcome = await syncCollection(hostedOrg!, key, localStorage.getItem(key))
    if (outcome === 'retry') { scheduleFlush(); return false }
    if (outcome === 'reload') await reloadCollection(key)
  }
  if (sent === version) rawRemove?.call(localStorage, DIRTY_KEY)
  else scheduleFlush()
  return true
}

/** The server refused a change to one list: the server's copy replaces the browser's, so the screen shows what is really saved. */
async function reloadCollection(key: string) {
  const loaded = await loadCollection(hostedOrg!, key)
  if (!loaded) return
  if (loaded.text === null) rawRemove!.call(localStorage, key); else rawSet!.call(localStorage, key, loaded.text)
  changeListener?.()
}

/**
 * Another person changed a project, roadmap, dashboard, mind map or story box. Reads each list again and tells the screens. A browser that
 * still has changes it has not sent is left alone, so a refresh never undoes them; the next note, or the next save, brings it up to date.
 */
export async function refreshCollections(): Promise<void> {
  if (!hostedOrg || !ready || localStorage.getItem(DIRTY_KEY) !== null) return
  for (const key of Object.keys(COLLECTIONS)) {
    const before = localStorage.getItem(key)
    await reloadCollection(key)
    if (localStorage.getItem(key) !== before) window.dispatchEvent(new StorageEvent('storage', { key }))
  }
}

/** For the tests: forgets the signed-in state. */
export function resetHostedKv() { resetHostedObjects(); hostedOrg = null; serverHas = {}; mayShare = false; enabled = false; ready = false }

// ─── Backup / restore ────────────────────────────────────────────────────────

/** Raw strings for every mirrored key. API keys are left out of backups. */
export function snapshotForBackup(): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && isMirroredKey(k) && fileForKey(k) !== 'secrets') out[k] = localStorage.getItem(k) as string
  }
  return out
}

/** Replaces the mirrored data with a backup's (secrets are kept). Changes are mirrored to disk as usual. */
export function restoreFromBackup(kv: Record<string, string>) {
  const current: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && isMirroredKey(k) && fileForKey(k) !== 'secrets') current.push(k)
  }
  current.forEach(k => { if (!(k in kv)) localStorage.removeItem(k) })
  for (const [k, v] of Object.entries(kv)) if (isMirroredKey(k) && fileForKey(k) !== 'secrets') localStorage.setItem(k, v)
}
