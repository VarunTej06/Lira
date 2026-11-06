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

export const MIRROR_PREFIX = 'lira_'
const INTERNAL_PREFIX = 'lira__'
const DIRTY_KEY = 'lira__kv_dirty'
const FLUSH_DELAY_MS = 500
const BOOT_TIMEOUT_MS = 3000

export type StoreFileName = 'projects' | 'roadmaps' | 'sprints' | 'teams' | 'standups' | 'board-config' | 'settings' | 'secrets'
export type FileEntries = Record<string, unknown>
export type FileMap = Record<string, FileEntries>

// ─── Pure helpers (unit tested) ──────────────────────────────────────────────

export const isMirroredKey = (key: string) => key.startsWith(MIRROR_PREFIX) && !key.startsWith(INTERNAL_PREFIX)

/** Which JSON file a localStorage key lives in. */
export function fileForKey(key: string): StoreFileName {
  if (key === 'lira_projects' || key.startsWith('lira_project_settings_')) return 'projects'
  if (key === 'lira_roadmaps') return 'roadmaps'
  if (key === 'lira_sprint_meta' || key === 'lira_planned_sprints' || key === 'lira_deleted_sprints') return 'sprints'
  if (key === 'lira_team_directory' || key.startsWith('lira_scope_team:')) return 'teams'
  if (key === 'lira_standups' || key === 'lira_standup_notes') return 'standups'
  if (
    key.startsWith('lira_wip_') || key.startsWith('lira_board_settings') || key.startsWith('lira_attachments_') ||
    key.startsWith('lira_docs_') || key.startsWith('lira_forms_')
  ) return 'board-config'
  if (key === 'lira_gemini_api_key') return 'secrets'
  return 'settings'
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
  const files: FileMap = { projects: {}, roadmaps: {}, sprints: {}, teams: {}, standups: {}, 'board-config': {}, settings: {}, secrets: {} }
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

export interface Reconciliation {
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
    if (!enabled || !ready || localStorage.getItem(DIRTY_KEY) === null) return
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
