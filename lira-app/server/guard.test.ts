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

import { isAllowedHost, isLoopbackAddress, LOCKED_PAGE, lanGate, loadLanToken } from './guard.ts'

describe('network access (tablet and phone)', () => {
  const lanReq = (headers: Record<string, string>, method = 'GET') => ({ method, headers })

  it('is off unless switched on', () => {
    expect(checkApiRequest(lanReq({ host: '192.168.0.131:5173' })).ok).toBe(false)
    expect(checkApiRequest(lanReq({ host: '192.168.0.131:5173' }), { lan: true }).ok).toBe(true)
  })

  it('accepts only addresses from your own network, never a web name', () => {
    for (const h of ['192.168.0.131', '10.0.0.7', '172.16.5.9', '172.31.255.1', 'my-pc.local', 'localhost']) expect(isAllowedHost(h, true)).toBe(true)
    for (const h of ['8.8.8.8', '172.32.0.1', '192.169.0.1', 'evil.example', '192.168.0.1.evil.example', 'evil.local.example']) expect(isAllowedHost(h, true)).toBe(false)
    expect(isAllowedHost('192.168.0.131', false)).toBe(false)
  })

  it('the page and the address it came from must agree', () => {
    const ok = lanReq({ host: '192.168.0.131:5173', origin: 'http://192.168.0.131:5173', 'sec-fetch-site': 'same-origin' })
    expect(checkApiRequest(ok, { lan: true }).ok).toBe(true)
    const other = lanReq({ host: '192.168.0.131:5173', origin: 'http://192.168.0.50:5173' })
    expect(checkApiRequest(other, { lan: true }).ok).toBe(false) // a different device's page
    expect(checkApiRequest(lanReq({ host: '192.168.0.131:5173', origin: 'https://evil.example' }), { lan: true }).ok).toBe(false)
  })

  it('knows which connections come from this computer', () => {
    expect(isLoopbackAddress('127.0.0.1')).toBe(true)
    expect(isLoopbackAddress('::1')).toBe(true)
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true)
    expect(isLoopbackAddress('192.168.0.50')).toBe(false)
    expect(isLoopbackAddress('::ffff:192.168.0.50')).toBe(false)
  })

  const token = 'a'.repeat(32)
  it('this computer never needs the link', () => {
    expect(lanGate({ url: '/', remoteAddress: '127.0.0.1', token }).action).toBe('allow')
  })
  it('not even when it opens Lira by its own network address', () => {
    const own = Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal)?.address
    if (own) {
      expect(lanGate({ url: '/', remoteAddress: own, token }).action).toBe('allow')
      expect(lanGate({ url: '/', remoteAddress: '::ffff:' + own, token }).action).toBe('allow')
    }
  })
  it('the page for a device without the link explains what to do and holds no secret', () => {
    expect(LOCKED_PAGE).toContain('private link')
    expect(LOCKED_PAGE).toContain('Other devices')
    expect(LOCKED_PAGE).not.toMatch(/[a-f0-9]{32}/)
  })
  it('another device without the link is turned away', () => {
    expect(lanGate({ url: '/', remoteAddress: '192.168.0.50', token }).action).toBe('deny')
    expect(lanGate({ url: '/api/data', remoteAddress: '192.168.0.50', token, cookie: 'lira_access=wrong' }).action).toBe('deny')
    expect(lanGate({ url: '/?key=' + 'b'.repeat(32), remoteAddress: '192.168.0.50', token }).action).toBe('deny')
    expect(lanGate({ url: '/?key=short', remoteAddress: '192.168.0.50', token }).action).toBe('deny')
  })
  it('the right link logs the device in and removes the secret from the address', () => {
    const r = lanGate({ url: `/sprints/2026-11?key=${token}&x=1`, remoteAddress: '192.168.0.50', token })
    expect(r.action).toBe('login')
    if (r.action === 'login') {
      expect(r.redirect).toBe('/sprints/2026-11?x=1')
      expect(r.cookie).toContain(`lira_access=${token}`)
      expect(r.cookie).toMatch(/HttpOnly/)
      expect(r.cookie).toMatch(/SameSite=Strict/)
    }
  })
  it('after that the cookie is enough', () => {
    expect(lanGate({ url: '/api/data', remoteAddress: '192.168.0.50', token, cookie: `theme=dark; lira_access=${token}` }).action).toBe('allow')
  })

  it('the link secret is created once and kept', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lira-lan-'))
    try {
      const a = loadLanToken(dir)
      expect(a).toMatch(/^[a-f0-9]{32}$/)
      expect(loadLanToken(dir)).toBe(a)
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
  })
})

describe('request guard: one rule at a time', () => {
  it('refuses a page whose Origin is this computer under a different name than the Host', () => {
    expect(checkApiRequest(req({ host: 'localhost:5173', origin: 'http://127.0.0.1:5173' }))).toMatchObject({ ok: false, status: 403, reason: 'Origin not allowed' })
  })

  it('reports the Host problem first, before the Origin or the content type', () => {
    expect(checkApiRequest(req({ host: 'evil.example', origin: 'https://evil.example', 'content-type': 'text/plain' }, 'POST'))).toMatchObject({ status: 403, reason: 'Host not allowed' })
  })

  it('treats every changing method like a write: JSON only', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(checkApiRequest(req({ ...own, 'content-type': 'text/plain' }, method)), method).toMatchObject({ ok: false, status: 415 })
      expect(checkApiRequest(req({ ...own, 'content-type': 'application/json' }, method)).ok, method).toBe(true)
    }
  })

  it('lets reads through without a content type', () => {
    expect(checkApiRequest(req(own, 'GET')).ok).toBe(true)
    expect(checkApiRequest(req(own, 'HEAD')).ok).toBe(true)
  })

  it('accepts a request that carries no Origin at all (a plain navigation or a script on this computer)', () => {
    expect(checkApiRequest(req({ ...own, 'sec-fetch-site': 'none' })).ok).toBe(true)
  })

  it('on the network (LAN mode) accepts a private address that agrees with its Origin, and still refuses a web name', () => {
    const lan = { lan: true }
    expect(checkApiRequest(req({ host: '192.168.1.20:5173', origin: 'http://192.168.1.20:5173' }), lan).ok).toBe(true)
    expect(checkApiRequest(req({ host: '192.168.1.20:5173', origin: 'http://192.168.1.21:5173' }), lan).ok).toBe(false)
    expect(checkApiRequest(req({ host: 'example.com' }), lan).ok).toBe(false)
    expect(checkApiRequest(req({ host: '192.168.1.20:5173' })).ok).toBe(false) // not allowed when LAN mode is off
  })
})

