import { describe, expect, it } from 'vitest'
import {
  buildFiles, decodeValue, encodeValue, fileForKey, flattenFiles, isMirroredKey, reconcile,
} from './kvMirror'

function fakeStorage(data: Record<string, string>) {
  const keys = Object.keys(data)
  return {
    get length() { return keys.length },
    key: (i: number) => keys[i] ?? null,
    getItem: (k: string) => (k in data ? data[k] : null),
  }
}

describe('fileForKey', () => {
  it('routes keys to the right JSON file', () => {
    expect(fileForKey('lira_projects')).toBe('projects')
    expect(fileForKey('lira_project_settings_proj-1')).toBe('projects')
    expect(fileForKey('lira_sprint_meta')).toBe('sprints')
    expect(fileForKey('lira_planned_sprints')).toBe('sprints')
    expect(fileForKey('lira_team_directory')).toBe('teams')
    expect(fileForKey('lira_scope_team:space:1')).toBe('teams')
    expect(fileForKey('lira_standups')).toBe('standups')
    expect(fileForKey('lira_standup_notes')).toBe('standups')
    expect(fileForKey('lira_wip_limits')).toBe('board-config')
    expect(fileForKey('lira_docs_3')).toBe('board-config')
    expect(fileForKey('lira_gemini_api_key')).toBe('secrets')
    expect(fileForKey('lira_theme')).toBe('settings')
    expect(fileForKey('lira_anything_new')).toBe('settings')
  })

  it('only mirrors lira_ keys and never internal ones', () => {
    expect(isMirroredKey('lira_theme')).toBe(true)
    expect(isMirroredKey('lira__kv_dirty')).toBe(false)
    expect(isMirroredKey('other_app_key')).toBe(false)
  })
})

describe('value encoding', () => {
  it('stores objects and arrays as real JSON, text as text', () => {
    expect(encodeValue('{"a":1}')).toEqual({ a: 1 })
    expect(encodeValue('[1,2]')).toEqual([1, 2])
    expect(encodeValue('dark')).toBe('dark')
    expect(encodeValue('true')).toBe('true')
    expect(encodeValue('{not json')).toBe('{not json')
    expect(encodeValue('# Doc\nbody')).toBe('# Doc\nbody')
  })

  it('round-trips through decode', () => {
    for (const raw of ['{"a":[1,2,{"b":null}]}', '["x"]', 'dark', '42', '{oops']) {
      expect(decodeValue(encodeValue(raw))).toBe(raw)
    }
  })
})

describe('buildFiles / flattenFiles', () => {
  const store = {
    lira_projects: '[{"id":"p1"}]',
    lira_sprint_meta: '{"1:2026-11":{"goal":"Ship"}}',
    lira_theme: 'dark',
    lira_gemini_api_key: 'secret',
    lira__kv_dirty: '123',
    unrelated: 'x',
  }

  it('groups mirrored keys by file and skips internal/unrelated keys', () => {
    const files = buildFiles(fakeStorage(store))
    expect(files.projects).toEqual({ lira_projects: [{ id: 'p1' }] })
    expect(files.sprints).toEqual({ lira_sprint_meta: { '1:2026-11': { goal: 'Ship' } } })
    expect(files.settings).toEqual({ lira_theme: 'dark' })
    expect(files.secrets).toEqual({ lira_gemini_api_key: 'secret' })
    expect(JSON.stringify(files)).not.toContain('kv_dirty')
    expect(JSON.stringify(files)).not.toContain('unrelated')
  })

  it('always includes every file, even when empty', () => {
    expect(Object.keys(buildFiles(fakeStorage({}))).sort()).toEqual(
      ['board-config', 'projects', 'secrets', 'settings', 'sprints', 'standups', 'teams'],
    )
  })

  it('flattening disk files gives back the original raw strings', () => {
    const flat = flattenFiles(buildFiles(fakeStorage(store)))
    expect(flat.lira_theme).toBe('dark')
    expect(JSON.parse(flat.lira_projects)).toEqual([{ id: 'p1' }])
    expect(flat.lira_gemini_api_key).toBe('secret')
  })
})

describe('reconcile (which copy wins on startup)', () => {
  it('restores everything from disk into an empty (cleared) browser, without pushing', () => {
    const r = reconcile({}, { lira_projects: '[1]', lira_theme: 'dark' }, false)
    expect(r.apply).toEqual({ lira_projects: '[1]', lira_theme: 'dark' })
    expect(r.push).toBe(false)
  })

  it('keeps browser-only data and asks to push it (one-time migration)', () => {
    const r = reconcile({ lira_projects: '[1]' }, {}, false)
    expect(r.apply).toEqual({})
    expect(r.push).toBe(true)
  })

  it('disk wins on a conflict when the browser has no unsaved changes', () => {
    const r = reconcile({ lira_theme: 'light' }, { lira_theme: 'dark' }, false)
    expect(r.apply).toEqual({ lira_theme: 'dark' })
    expect(r.push).toBe(false)
  })

  it('browser wins on a conflict when it has unsaved changes', () => {
    const r = reconcile({ lira_theme: 'light' }, { lira_theme: 'dark', lira_other: 'x' }, true)
    expect(r.apply).toEqual({ lira_other: 'x' })
    expect(r.push).toBe(true)
  })

  it('treats equal JSON with different whitespace as unchanged', () => {
    const r = reconcile({ lira_projects: '[1, 2]' }, { lira_projects: '[1,2]' }, false)
    expect(r.apply).toEqual({})
    expect(r.push).toBe(false)
  })
})
