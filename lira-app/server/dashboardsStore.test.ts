import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isStoreFile, readStore, storePath, writeStore } from './diskStore.ts'

let dir: string
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-')) })
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

const dashboards = [{ id: 'dash-1', name: 'Sprint health', scenario: 'sprint-health', widgets: [{ id: 'w1', type: 'stat', title: 'Open' }], goals: [], filters: { spaceIds: [], sprint: 'current' } }]

describe('Dashboards on disk (data/dashboards.json)', () => {
  it('dashboards is one of the files the store knows', () => {
    expect(isStoreFile('dashboards')).toBe(true)
    expect(storePath(dir, 'dashboards')).toBe(path.join(dir, 'dashboards.json'))
  })

  it('writes the dashboards to their own file and reads them back unchanged', () => {
    const written = writeStore(dir, { dashboards: { lira_dashboards: dashboards } })
    expect(written).toEqual(['dashboards'])
    expect(fs.existsSync(path.join(dir, 'dashboards.json'))).toBe(true)
    expect(readStore(dir).dashboards).toEqual({ lira_dashboards: dashboards })
  })

  it('saving the same dashboards again does not touch the file', () => {
    writeStore(dir, { dashboards: { lira_dashboards: dashboards } })
    const before = fs.statSync(path.join(dir, 'dashboards.json')).mtimeMs
    const again = writeStore(dir, { dashboards: { lira_dashboards: dashboards } })
    expect(again).toEqual([])
    expect(fs.statSync(path.join(dir, 'dashboards.json')).mtimeMs).toBe(before)
  })

  it('keeps the keys in a fixed order so the file only changes when the dashboards do', () => {
    writeStore(dir, { dashboards: { lira_dashboards: [{ name: 'b', id: 'x', widgets: [] }] } })
    const text = fs.readFileSync(path.join(dir, 'dashboards.json'), 'utf-8')
    expect(text.indexOf('"id"')).toBeLessThan(text.indexOf('"name"'))
  })

  it('refuses data with reserved keys (prototype pollution)', () => {
    expect(() => writeStore(dir, { dashboards: JSON.parse('{"__proto__": {"x": 1}}') })).toThrow()
  })

  it('a damaged file is skipped, not a crash', () => {
    fs.writeFileSync(path.join(dir, 'dashboards.json'), '{ not json')
    expect(readStore(dir).dashboards).toBeUndefined()
  })
})
