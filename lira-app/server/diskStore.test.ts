// @vitest-environment node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readStore, sortKeys, writeJsonIfChanged, writeStore } from './diskStore.ts'

let dir: string
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lira-store-')) })
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('sortKeys', () => {
  it('sorts nested object keys but keeps array order', () => {
    expect(JSON.stringify(sortKeys({ b: 1, a: { d: 1, c: [3, 1, 2] } }))).toBe('{"a":{"c":[3,1,2],"d":1},"b":1}')
  })
})

describe('writeStore / readStore', () => {
  it('writes each file under data/ and reads it back', () => {
    writeStore(dir, {
      projects: { lira_projects: [{ id: 'p1' }] },
      sprints: { lira_sprint_meta: { '1:2026-11': { goal: 'Ship' } } },
      secrets: { lira_gemini_api_key: 'k' },
    })
    expect(fs.existsSync(path.join(dir, 'projects.json'))).toBe(true)
    expect(fs.existsSync(path.join(dir, 'sprints.json'))).toBe(true)
    expect(fs.existsSync(path.join(dir, 'private', 'secrets.json'))).toBe(true)
    expect(readStore(dir)).toEqual({
      projects: { lira_projects: [{ id: 'p1' }] },
      sprints: { lira_sprint_meta: { '1:2026-11': { goal: 'Ship' } } },
      secrets: { lira_gemini_api_key: 'k' },
    })
  })

  it('does not rewrite a file whose content has not changed (git stays clean)', () => {
    writeStore(dir, { teams: { b: 1, a: 2 } }, new Date('2026-01-01T00:00:00Z'))
    const file = path.join(dir, 'teams.json')
    const before = fs.readFileSync(file, 'utf-8')
    const written = writeStore(dir, { teams: { a: 2, b: 1 } }, new Date('2027-01-01T00:00:00Z'))
    expect(written).toEqual([])
    expect(fs.readFileSync(file, 'utf-8')).toBe(before)
  })

  it('rewrites and bumps updatedAt when content changes, with stable key order', () => {
    writeStore(dir, { teams: { b: 1, a: 2 } }, new Date('2026-01-01T00:00:00Z'))
    const written = writeStore(dir, { teams: { b: 1, a: 3 } }, new Date('2027-01-01T00:00:00Z'))
    expect(written).toEqual(['teams'])
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, 'teams.json'), 'utf-8'))
    expect(parsed.updatedAt).toBe('2027-01-01T00:00:00.000Z')
    expect(Object.keys(parsed.entries)).toEqual(['a', 'b'])
  })

  it('ignores unknown file names (no path traversal)', () => {
    writeStore(dir, { '../evil': { x: 1 }, nonsense: { x: 1 } })
    expect(fs.readdirSync(dir)).toEqual([])
  })

  it('skips corrupt files when reading', () => {
    fs.writeFileSync(path.join(dir, 'projects.json'), '{broken')
    expect(readStore(dir)).toEqual({})
  })
})

describe('writeJsonIfChanged', () => {
  it('ignores timestamp-only differences', () => {
    const file = path.join(dir, 'space.json')
    expect(writeJsonIfChanged(file, { updatedAt: 'a', issues: [1] }, ['updatedAt'])).toBe(true)
    expect(writeJsonIfChanged(file, { updatedAt: 'b', issues: [1] }, ['updatedAt'])).toBe(false)
    expect(JSON.parse(fs.readFileSync(file, 'utf-8')).updatedAt).toBe('a')
    expect(writeJsonIfChanged(file, { updatedAt: 'c', issues: [1, 2] }, ['updatedAt'])).toBe(true)
  })
})

describe('one JSON file per roadmap', () => {
  const rm = (id: string, name: string, items = 1) => ({ id, name, items: Array.from({ length: items }, (_, i) => ({ id: `i${i}` })), lanes: [] })
  const dirOf = () => path.join(dir, 'roadmaps')

  it('writes data/roadmaps/<id>.json for each roadmap plus an index', () => {
    writeStore(dir, { roadmaps: { lira_roadmaps: [rm('rm-a', 'Alpha', 2), rm('rm-b', 'Beta')] } })
    expect(fs.readdirSync(dirOf()).sort()).toEqual(['index.json', 'rm-a.json', 'rm-b.json'])
    const index = JSON.parse(fs.readFileSync(path.join(dirOf(), 'index.json'), 'utf-8'))
    expect(index.roadmaps).toEqual([
      { id: 'rm-a', name: 'Alpha', file: 'rm-a.json', items: 2 },
      { id: 'rm-b', name: 'Beta', file: 'rm-b.json', items: 1 },
    ])
    expect(JSON.parse(fs.readFileSync(path.join(dirOf(), 'rm-a.json'), 'utf-8')).roadmap.name).toBe('Alpha')
    expect(fs.existsSync(path.join(dir, 'roadmaps.json'))).toBe(false)
  })

  it('reads them back in index order', () => {
    writeStore(dir, { roadmaps: { lira_roadmaps: [rm('rm-b', 'Beta'), rm('rm-a', 'Alpha')] } })
    const read = readStore(dir).roadmaps.lira_roadmaps as { id: string }[]
    expect(read.map(r => r.id)).toEqual(['rm-b', 'rm-a'])
  })

  it('only rewrites the roadmap that changed', async () => {
    writeStore(dir, { roadmaps: { lira_roadmaps: [rm('rm-a', 'Alpha'), rm('rm-b', 'Beta')] } })
    const m = (f: string) => fs.statSync(path.join(dirOf(), f)).mtimeMs
    const [a0, b0] = [m('rm-a.json'), m('rm-b.json')]
    await new Promise(r => setTimeout(r, 30))
    const written = writeStore(dir, { roadmaps: { lira_roadmaps: [rm('rm-a', 'Alpha'), rm('rm-b', 'Beta renamed')] } })
    expect(written).toEqual(['roadmaps'])
    expect(m('rm-a.json')).toBe(a0)
    expect(m('rm-b.json')).toBeGreaterThan(b0)
    expect(writeStore(dir, { roadmaps: { lira_roadmaps: [rm('rm-a', 'Alpha'), rm('rm-b', 'Beta renamed')] } })).toEqual([])
  })

  it('removes the file of a deleted roadmap', () => {
    writeStore(dir, { roadmaps: { lira_roadmaps: [rm('rm-a', 'Alpha'), rm('rm-b', 'Beta')] } })
    writeStore(dir, { roadmaps: { lira_roadmaps: [rm('rm-a', 'Alpha')] } })
    expect(fs.readdirSync(dirOf()).sort()).toEqual(['index.json', 'rm-a.json'])
  })

  it('never deletes anything when the browser sends no roadmap data', () => {
    writeStore(dir, { roadmaps: { lira_roadmaps: [rm('rm-a', 'Alpha')] } })
    writeStore(dir, { roadmaps: {} })
    expect(fs.existsSync(path.join(dirOf(), 'rm-a.json'))).toBe(true)
  })

  it('migrates the old single data/roadmaps.json into the folder', () => {
    fs.writeFileSync(path.join(dir, 'roadmaps.json'), JSON.stringify({ version: 1, entries: { lira_roadmaps: [rm('old', 'Old one')] } }))
    expect((readStore(dir).roadmaps.lira_roadmaps as { id: string }[])[0].id).toBe('old')
    writeStore(dir, { roadmaps: { lira_roadmaps: [rm('old', 'Old one')] } })
    expect(fs.existsSync(path.join(dir, 'roadmaps.json'))).toBe(false)
    expect(fs.existsSync(path.join(dirOf(), 'old.json'))).toBe(true)
  })

  it('keeps roadmap ids safe as file names', () => {
    writeStore(dir, { roadmaps: { lira_roadmaps: [rm('../evil', 'x')] } })
    expect(fs.readdirSync(dirOf()).sort()).toEqual(['___evil.json', 'index.json'])
    expect(fs.existsSync(path.join(dir, 'evil.json'))).toBe(false)
  })
})
