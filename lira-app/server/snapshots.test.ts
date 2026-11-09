import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isSnapshotFile, listSnapshots, readSnapshot, safeSnapshotName, saveSnapshot, SNAPSHOT_MAX_BYTES } from './snapshots.ts'

let dir: string
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-')) })
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

describe('snapshot files', () => {
  it('turns any name into a safe .md file name', () => {
    expect(safeSnapshotName('My Sprint Dashboard 2026-11-09.md')).toBe('my-sprint-dashboard-2026-11-09.md')
    expect(safeSnapshotName('../../etc/passwd')).toBe('passwd.md')
    expect(safeSnapshotName('..\\..\\secret')).toBe('secret.md')
    expect(safeSnapshotName('')).toBeUndefined()
    expect(safeSnapshotName(42)).toBeUndefined()
  })

  it('saves, lists and reads a snapshot', () => {
    const saved = saveSnapshot(dir, 'Weekly Report', '# Hello\n')
    expect(saved).toEqual({ file: 'weekly-report.md' })
    expect(fs.existsSync(path.join(dir, 'snapshots', 'weekly-report.md'))).toBe(true)
    expect(listSnapshots(dir).map(f => f.file)).toEqual(['weekly-report.md'])
    expect(readSnapshot(dir, 'weekly-report.md')).toBe('# Hello\n')
  })

  it('refuses empty, oversized and path-like requests', () => {
    expect(saveSnapshot(dir, 'x', '')).toBeUndefined()
    expect(saveSnapshot(dir, 'x', 'a'.repeat(SNAPSHOT_MAX_BYTES + 1))).toBeUndefined()
    expect(readSnapshot(dir, '../settings.json')).toBeUndefined()
    expect(readSnapshot(dir, '..\\x.md')).toBeUndefined()
    expect(isSnapshotFile('a/b.md')).toBe(false)
    expect(isSnapshotFile('ok-name.md')).toBe(true)
  })
})
