import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { readStore, writeStore } from '../../server/diskStore.ts'

/**
 * End to end: the real client mirror talking to the real disk store (a temp folder stands in for <repo>/data).
 * Proves the requirement "clearing the browser must not lose data".
 */
let dataDir: string
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

beforeAll(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lira-e2e-'))
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url === '/api/kv' && (!init || !init.method || init.method === 'GET')) {
      return new Response(JSON.stringify({ files: readStore(dataDir) }), { status: 200 })
    }
    if (url === '/api/kv' && init?.method === 'POST') {
      const { files } = JSON.parse(init.body as string)
      writeStore(dataDir, files)
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }
    return new Response('nope', { status: 404 })
  })
})
afterAll(() => {
  vi.unstubAllGlobals()
  fs.rmSync(dataDir, { recursive: true, force: true })
})

describe('disk mirror end to end', () => {
  it('writes changes to JSON files, survives a browser wipe, and migrates pre-existing browser data', async () => {
    // Data that existed in the browser before the mirror was ever installed (the migration case)
    localStorage.setItem('lira_projects', JSON.stringify([{ id: 'p1', name: 'Old project' }]))
    localStorage.setItem('lira_planned_sprints', '["2027-01"]')

    const { initKvMirror, flushKv } = await import('./kvMirror')
    await initKvMirror()
    await wait(50)

    // 1. Pre-existing browser data was migrated to disk
    expect(readStore(dataDir).projects).toEqual({ lira_projects: [{ id: 'p1', name: 'Old project' }] })
    expect(readStore(dataDir).sprints).toEqual({ lira_planned_sprints: ['2027-01'] })

    // 2. Creating / updating anything is mirrored to the right file
    localStorage.setItem('lira_sprint_meta', JSON.stringify({ '1:2026-11': { goal: 'Ship it' } }))
    localStorage.setItem('lira_scope_team:space:1', '["AB"]')
    localStorage.setItem('lira_standups', '[{"id":"s1"}]')
    localStorage.setItem('lira_theme', 'dark')
    localStorage.setItem('lira_gemini_api_key', 'sk-test')
    localStorage.setItem('not_lira', 'ignored')
    await wait(700) // debounce
    const disk = readStore(dataDir)
    expect(disk.sprints.lira_sprint_meta).toEqual({ '1:2026-11': { goal: 'Ship it' } })
    expect(disk.teams['lira_scope_team:space:1']).toEqual(['AB'])
    expect(disk.standups.lira_standups).toEqual([{ id: 's1' }])
    expect(disk.settings.lira_theme).toBe('dark')
    expect(disk.secrets.lira_gemini_api_key).toBe('sk-test')
    expect(JSON.stringify(disk)).not.toContain('not_lira')
    expect(localStorage.getItem('lira__kv_dirty')).toBeNull() // fully saved

    // 3. Updating and deleting are mirrored too
    localStorage.setItem('lira_planned_sprints', '["2027-01","2027-02"]')
    localStorage.removeItem('lira_standups')
    await flushKv()
    expect(readStore(dataDir).sprints.lira_planned_sprints).toEqual(['2027-01', '2027-02'])
    expect(readStore(dataDir).standups).toEqual({})

    // 4. The user clears browser data. Nothing must be written to disk by the wipe itself.
    localStorage.clear()
    await wait(700)
    expect(readStore(dataDir).projects).toEqual({ lira_projects: [{ id: 'p1', name: 'Old project' }] })

    // 5. Next page load restores everything from the files
    vi.resetModules()
    const fresh = await import('./kvMirror')
    await fresh.initKvMirror()
    expect(JSON.parse(localStorage.getItem('lira_projects')!)).toEqual([{ id: 'p1', name: 'Old project' }])
    expect(JSON.parse(localStorage.getItem('lira_planned_sprints')!)).toEqual(['2027-01', '2027-02'])
    expect(JSON.parse(localStorage.getItem('lira_sprint_meta')!)).toEqual({ '1:2026-11': { goal: 'Ship it' } })
    expect(JSON.parse(localStorage.getItem('lira_scope_team:space:1')!)).toEqual(['AB'])
    expect(localStorage.getItem('lira_theme')).toBe('dark')
    expect(localStorage.getItem('lira_gemini_api_key')).toBe('sk-test')
    expect(localStorage.getItem('lira_standups')).toBeNull()
  })

  it('app keeps working when the dev server is unavailable', async () => {
    vi.resetModules()
    vi.stubGlobal('fetch', async () => { throw new Error('offline') })
    const { initKvMirror } = await import('./kvMirror')
    await expect(initKvMirror()).resolves.toBeUndefined()
    localStorage.setItem('lira_theme', 'light') // must not throw
    expect(localStorage.getItem('lira_theme')).toBe('light')
  })
})
