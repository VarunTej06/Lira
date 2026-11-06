import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/db'
import { makeIssue, makeSpace } from '../test/factories'
import { initLocalDiskSync, saveToDiskNow, triggerDiskSync } from './localDiskSync'

const diskSpaces = [makeSpace({ id: 1, key: 'CERT' })]
const diskIssues = [makeIssue({ id: 1, spaceId: 1, title: 'From disk' })]
let posts: unknown[]

beforeEach(async () => {
  localStorage.clear()
  await db.issues.clear(); await db.spaces.clear()
  posts = []
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url === '/api/data') return new Response(JSON.stringify({ spaces: diskSpaces, issues: diskIssues }))
    if (url === '/api/save') { posts.push(JSON.parse(init!.body as string)); return new Response(JSON.stringify({ savedAt: new Date().toISOString() })) }
    return new Response('', { status: 404 })
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('ticket sync: which copy wins on load', () => {
  it('disk wins when the browser has no unsaved changes', async () => {
    await db.issues.add(makeIssue({ spaceId: 1, title: 'Old browser copy' }))
    await initLocalDiskSync()
    expect((await db.issues.toArray()).map(i => i.title)).toEqual(['From disk'])
    expect(posts).toHaveLength(0)
  })

  it('browser wins and is pushed to disk when it has unsaved changes', async () => {
    await db.spaces.add(makeSpace({ id: 1, key: 'CERT' }))
    await db.issues.add(makeIssue({ spaceId: 1, title: 'Unsaved browser edit' }))
    localStorage.setItem('lira__issues_dirty', '1')
    await initLocalDiskSync()
    expect((await db.issues.toArray()).map(i => i.title)).toEqual(['Unsaved browser edit'])
    expect(posts).toHaveLength(1)
    expect(localStorage.getItem('lira__issues_dirty')).toBeNull() // saved, flag cleared
  })

  it('marks changes unsaved until the save succeeds', async () => {
    triggerDiskSync()
    expect(localStorage.getItem('lira__issues_dirty')).not.toBeNull()
    await saveToDiskNow()
    expect(localStorage.getItem('lira__issues_dirty')).toBeNull()
  })
})
