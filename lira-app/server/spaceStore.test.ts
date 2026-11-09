// @vitest-environment node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSpaceStore } from './diskStore.ts'

let dir: string
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lira-spaces-')) })
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const spaceA = { id: 1, key: 'AAA', name: 'A' }
const spaceB = { id: 2, key: 'BBB', name: 'B' }
const issue = (id: number, spaceId: number, title = 't') => ({ id, spaceId, key: `K-${id}`, title })
const mtime = (f: string) => fs.statSync(path.join(dir, f)).mtimeMs
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

describe('space store', () => {
  it('writes one file per space plus manifest and snapshot, and loads them back', () => {
    const s = createSpaceStore(dir)
    s.saveAllDataToDisk([spaceA, spaceB], [issue(1, 1), issue(2, 2)])
    expect(fs.existsSync(path.join(dir, 'spaces', 'AAA.json'))).toBe(true)
    expect(fs.existsSync(path.join(dir, 'spaces', 'BBB.json'))).toBe(true)
    expect(fs.existsSync(path.join(dir, 'spaces.json'))).toBe(true)
    expect(fs.existsSync(path.join(dir, 'lira-workspace.json'))).toBe(true)
    const loaded = s.loadAllDataFromDisk()
    expect(loaded.spaces.map((x: { key: string }) => x.key)).toEqual(['AAA', 'BBB'])
    expect(loaded.issues).toHaveLength(2)
  })

  it('rewrites only the space that changed', async () => {
    const s = createSpaceStore(dir)
    s.saveAllDataToDisk([spaceA, spaceB], [issue(1, 1), issue(2, 2)])
    const a0 = mtime('spaces/AAA.json')
    const b0 = mtime('spaces/BBB.json')
    await wait(30)
    s.saveAllDataToDisk([spaceA, spaceB], [issue(1, 1), issue(2, 2, 'renamed')])
    expect(mtime('spaces/AAA.json')).toBe(a0)
    expect(mtime('spaces/BBB.json')).toBeGreaterThan(b0)
  })

  it('touches nothing when nothing changed', async () => {
    const s = createSpaceStore(dir)
    s.saveAllDataToDisk([spaceA], [issue(1, 1)])
    const before = ['spaces/AAA.json', 'spaces.json', 'lira-workspace.json'].map(mtime)
    await wait(30)
    s.saveAllDataToDisk([spaceA], [issue(1, 1)])
    expect(['spaces/AAA.json', 'spaces.json', 'lira-workspace.json'].map(mtime)).toEqual(before)
  })

  it('removes the file of a deleted space and keeps orphan tickets', () => {
    const s = createSpaceStore(dir)
    s.saveAllDataToDisk([spaceA, spaceB], [issue(1, 1), issue(2, 2)])
    s.saveAllDataToDisk([spaceA], [issue(1, 1), issue(9, 99)])
    expect(fs.existsSync(path.join(dir, 'spaces', 'BBB.json'))).toBe(false)
    expect(fs.existsSync(path.join(dir, 'spaces', '_orphans.json'))).toBe(true)
    expect(s.loadAllDataFromDisk().issues).toHaveLength(2)
  })
})

describe('space store: loading and saving in detail', () => {
  const readJson = (...parts: string[]) => JSON.parse(fs.readFileSync(path.join(dir, ...parts), 'utf-8'))

  it('keeps tickets whose space was removed in an orphans file, and loads them back', () => {
    const s = createSpaceStore(dir)
    s.saveAllDataToDisk([spaceA], [issue(1, 1), issue(2, 77), issue(3, 78)])
    const orphans = readJson('spaces', '_orphans.json')
    expect(orphans.count).toBe(2)
    expect(orphans.issues.map((i: { id: number }) => i.id)).toEqual([2, 3])
    expect(s.loadAllDataFromDisk().issues.map(i => (i as { id: number }).id).sort()).toEqual([1, 2, 3])
  })

  it('removes the orphans file once no ticket is orphaned any more', () => {
    const s = createSpaceStore(dir)
    s.saveAllDataToDisk([spaceA], [issue(1, 1), issue(2, 77)])
    expect(fs.existsSync(path.join(dir, 'spaces', '_orphans.json'))).toBe(true)
    s.saveAllDataToDisk([spaceA], [issue(1, 1)])
    expect(fs.existsSync(path.join(dir, 'spaces', '_orphans.json'))).toBe(false)
  })

  it('writes a manifest that lists each space with its ticket count and file', () => {
    const s = createSpaceStore(dir)
    s.saveAllDataToDisk([spaceA, spaceB], [issue(1, 1), issue(2, 1), issue(3, 2)])
    const manifest = readJson('spaces.json')
    expect(manifest.spaceCount).toBe(2)
    expect(manifest.totalIssueCount).toBe(3)
    expect(manifest.spaces.map((x: { key: string; issueCount: number; file: string }) => [x.key, x.issueCount, x.file])).toEqual([
      ['AAA', 2, 'spaces/AAA.json'], ['BBB', 1, 'spaces/BBB.json'],
    ])
  })

  it('reports what it saved', () => {
    const result = createSpaceStore(dir).saveAllDataToDisk([spaceA, spaceB], [issue(1, 1)])
    expect(result).toMatchObject({ success: true, counts: { spaces: 2, issues: 1, spaceFiles: 2 } })
  })

  it('reads a space file that is a bare list of tickets', () => {
    const s = createSpaceStore(dir)
    s.saveAllDataToDisk([spaceA], [])
    fs.writeFileSync(path.join(dir, 'spaces', 'AAA.json'), JSON.stringify([issue(5, 1), issue(6, 1)]))
    expect(s.loadAllDataFromDisk().issues).toHaveLength(2)
  })

  it('skips a space file it cannot read and still loads the others', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = createSpaceStore(dir)
    s.saveAllDataToDisk([spaceA, spaceB], [issue(1, 1), issue(2, 2)])
    fs.writeFileSync(path.join(dir, 'spaces', 'AAA.json'), '{ broken')
    const loaded = s.loadAllDataFromDisk()
    expect(loaded.spaces).toHaveLength(2)
    expect(loaded.issues.map(i => (i as { id: number }).id)).toEqual([2])
    vi.restoreAllMocks()
  })

  it('migrates the old single workspace file into one file per space the first time it is read', () => {
    fs.writeFileSync(path.join(dir, 'lira-workspace.json'), JSON.stringify({ version: '1', spaces: [spaceA, spaceB], issues: [issue(1, 1), issue(2, 2)] }))
    const loaded = createSpaceStore(dir).loadAllDataFromDisk()
    expect(loaded.spaces).toHaveLength(2)
    expect(fs.existsSync(path.join(dir, 'spaces', 'AAA.json'))).toBe(true)
    expect(fs.existsSync(path.join(dir, 'spaces', 'BBB.json'))).toBe(true)
    expect(fs.existsSync(path.join(dir, 'spaces.json'))).toBe(true)
  })

  it('says there is nothing yet when no data exists', () => {
    expect(createSpaceStore(dir).loadAllDataFromDisk()).toEqual({ exists: false, spaces: [], issues: [] })
  })

  it('falls back to the old file when the manifest cannot be read', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    fs.mkdirSync(path.join(dir, 'spaces'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'spaces.json'), 'not json')
    fs.writeFileSync(path.join(dir, 'lira-workspace.json'), JSON.stringify({ spaces: [spaceA], issues: [issue(1, 1)] }))
    expect(createSpaceStore(dir).loadAllDataFromDisk().issues).toHaveLength(1)
    vi.restoreAllMocks()
  })
})

