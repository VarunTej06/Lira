import fs from 'fs'
import os from 'os'
import path from 'path'
import { Readable } from 'stream'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkApiRequest, hasPrototypePollution, readBody, safeSpaceKey, securityHeaders, writeAudit } from './guard.ts'
import { createSpaceStore, writeStore } from './diskStore.ts'

const req = (headers: Record<string, string>, method = 'GET') => ({ method, headers })
const own = { host: 'localhost:5173' }

describe('who may use the /api routes', () => {
  it('accepts Lira itself', () => {
    expect(checkApiRequest(req(own)).ok).toBe(true)
    expect(checkApiRequest(req({ ...own, origin: 'http://localhost:5173', 'sec-fetch-site': 'same-origin' })).ok).toBe(true)
    expect(checkApiRequest(req({ host: '127.0.0.1:5199', origin: 'http://127.0.0.1:5199', 'content-type': 'application/json' }, 'POST')).ok).toBe(true)
    expect(checkApiRequest(req({ host: '[::1]:5173' })).ok).toBe(true)
  })

  it('refuses another host name (DNS rebinding)', () => {
    expect(checkApiRequest(req({ host: 'evil.example:5173' }))).toMatchObject({ ok: false, status: 403 })
    expect(checkApiRequest(req({ host: 'localhost.evil.example' }))).toMatchObject({ ok: false })
    expect(checkApiRequest(req({}))).toMatchObject({ ok: false })
  })

  it('refuses requests that come from another website', () => {
    expect(checkApiRequest(req({ ...own, origin: 'https://evil.example' }))).toMatchObject({ ok: false, status: 403 })
    expect(checkApiRequest(req({ ...own, origin: 'null' }))).toMatchObject({ ok: false })
    expect(checkApiRequest(req({ ...own, 'sec-fetch-site': 'cross-site' }))).toMatchObject({ ok: false })
    expect(checkApiRequest(req({ ...own, origin: 'http://localhost.evil.example' })).ok).toBe(false)
  })

  it('only accepts JSON for writes (a plain form post cannot send it)', () => {
    expect(checkApiRequest(req({ ...own, 'content-type': 'text/plain' }, 'POST'))).toMatchObject({ ok: false, status: 415 })
    expect(checkApiRequest(req({ ...own, 'content-type': 'application/x-www-form-urlencoded' }, 'POST')).ok).toBe(false)
    expect(checkApiRequest(req(own, 'POST')).ok).toBe(false)
    expect(checkApiRequest(req({ ...own, 'content-type': 'application/json; charset=utf-8' }, 'POST')).ok).toBe(true)
  })
})

describe('response headers', () => {
  it('forbid framing, sniffing and plugins, and limit where scripts come from', () => {
    const h = securityHeaders(false)
    expect(h['X-Frame-Options']).toBe('DENY')
    expect(h['X-Content-Type-Options']).toBe('nosniff')
    expect(h['Content-Security-Policy']).toContain("frame-ancestors 'none'")
    expect(h['Content-Security-Policy']).toContain("object-src 'none'")
    expect(h['Content-Security-Policy']).not.toMatch(/google/) // fonts are served by Lira itself
    expect(h['Content-Security-Policy']).toContain("script-src 'self'")
    expect(h['Content-Security-Policy']).not.toContain("script-src 'self' 'unsafe-inline'")
  })
  it('only the dev server allows the inline hot-reload script', () => {
    expect(securityHeaders(true)['Content-Security-Policy']).toContain("script-src 'self' 'unsafe-inline'")
  })
})

describe('file names', () => {
  it('turns anything unusual in a space key into underscores', () => {
    expect(safeSpaceKey('cert', 1)).toBe('CERT')
    expect(safeSpaceKey('../../etc/passwd', 1)).not.toMatch(/[./\\]/)
    expect(safeSpaceKey('..\\..\\x', 1)).not.toMatch(/[./\\]/)
    expect(safeSpaceKey('', 7)).toBe('SPACE-7')
    expect(safeSpaceKey('CON', 1)).toBe('_CON')
    expect(safeSpaceKey('a'.repeat(200), 1).length).toBeLessThanOrEqual(40)
  })
})

describe('saved data', () => {
  it('spots keys that would poison every object', () => {
    expect(hasPrototypePollution(JSON.parse('{"files":{"settings":{"__proto__":{"admin":true}}}}'))).toBe(true)
    expect(hasPrototypePollution({ a: [{ b: { constructor: 1 } }] })).toBe(true)
    expect(hasPrototypePollution({ a: [{ b: 1 }], title: '__proto__ is just text here' })).toBe(false)
  })
})

describe('on disk', () => {
  let dir: string
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lira-sec-')) })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('a space called "../../outside" can only write inside data/spaces', () => {
    const { saveAllDataToDisk } = createSpaceStore(path.join(dir, 'data'))
    saveAllDataToDisk([{ id: 1, key: '../../outside', name: 'x' }], [])
    expect(fs.existsSync(path.join(dir, 'outside.json'))).toBe(false)
    expect(fs.existsSync(path.join(dir, 'data', 'outside.json'))).toBe(false)
    const inside = fs.readdirSync(path.join(dir, 'data', 'spaces'))
    expect(inside.length).toBe(1)
    expect(inside[0]).toMatch(/^[A-Z0-9_-]+\.json$/)
  })

  it('refuses to save a payload with a reserved key', () => {
    expect(() => writeStore(dir, JSON.parse('{"settings":{"__proto__":{"x":1}}}'))).toThrow()
    expect(({} as Record<string, unknown>).x).toBeUndefined()
  })

  it('roadmap ids cannot escape their folder either', () => {
    writeStore(dir, { roadmaps: { 'lira_roadmaps': JSON.stringify([{ id: '../../evil', name: 'x', items: [], lanes: [] }]) } as never })
    expect(fs.existsSync(path.join(dir, 'evil.json'))).toBe(false)
  })

  it('keeps a record of what was written, without the content', () => {
    writeAudit(dir, 'save-settings', ['settings', 'sprints'])
    writeAudit(dir, 'save-settings', [])
    const log = fs.readFileSync(path.join(dir, 'private', 'audit.log'), 'utf-8').trim().split('\n')
    expect(log).toHaveLength(1)
    expect(log[0]).toMatch(/^\d{4}-\d{2}-\d{2}T.* save-settings settings,sprints$/)
  })
})

describe('request size', () => {
  it('accepts a normal body and refuses one over the limit', async () => {
    expect(await readBody(Readable.from([Buffer.from('{"a":1}')]) as never, 100)).toBe('{"a":1}')
    await expect(readBody(Readable.from([Buffer.alloc(200)]) as never, 100)).rejects.toThrow('too large')
  })
})
