/**
 * Weekly dashboard snapshots: Markdown files in <data>/snapshots. Kept free of Vite imports so they can be unit-tested.
 * Only plain file names are accepted (letters, digits and dashes, ending in .md), so a request can never reach outside the folder.
 */
import fs from 'node:fs'
import path from 'node:path'

export const SNAPSHOT_MAX_BYTES = 1024 * 1024

const snapshotsDir = (dataDir: string) => path.join(dataDir, 'snapshots')

/** A safe file name from whatever was asked for. */
export function safeSnapshotName(name: unknown): string | undefined {
  if (typeof name !== 'string') return undefined
  const base = name.split(/[\\/]/).pop()!.toLowerCase().replace(/\.md$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
  return base ? `${base}.md` : undefined
}

export const isSnapshotFile = (file: unknown): file is string => typeof file === 'string' && /^[a-z0-9][a-z0-9-]{0,80}\.md$/.test(file)

export function saveSnapshot(dataDir: string, name: unknown, markdown: unknown): { file: string } | undefined {
  const file = safeSnapshotName(name)
  if (!file || typeof markdown !== 'string' || markdown.length === 0 || Buffer.byteLength(markdown) > SNAPSHOT_MAX_BYTES) return undefined
  const dir = snapshotsDir(dataDir)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, file), markdown, 'utf-8')
  return { file }
}

export function listSnapshots(dataDir: string): { file: string; size: number; modified: string }[] {
  try {
    return fs.readdirSync(snapshotsDir(dataDir))
      .filter(isSnapshotFile)
      .map(file => { const st = fs.statSync(path.join(snapshotsDir(dataDir), file)); return { file, size: st.size, modified: st.mtime.toISOString() } })
      .sort((a, b) => b.modified.localeCompare(a.modified))
  } catch { return [] }
}

export function readSnapshot(dataDir: string, file: unknown): string | undefined {
  if (!isSnapshotFile(file)) return undefined
  try { return fs.readFileSync(path.join(snapshotsDir(dataDir), file), 'utf-8') } catch { return undefined }
}
