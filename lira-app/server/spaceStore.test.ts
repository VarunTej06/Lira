// @vitest-environment node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
