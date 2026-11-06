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
