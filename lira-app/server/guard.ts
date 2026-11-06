import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'

/**
 * Protection for the local /api/* routes. Lira runs on your own computer, but any web page you have open can still
 * try to talk to localhost (a forged form post, or "DNS rebinding"). These checks make sure only Lira itself can.
 */

/** Largest request body accepted, in bytes. Ticket data with attachments can be big, but not unlimited. */
export const MAX_BODY_BYTES = 50 * 1024 * 1024

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/i

/** Addresses that only exist inside a home or office network. */
const PRIVATE_IPV4 = /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+)$/
const LOCAL_NAME = /^[a-z0-9-]+\.local$/i

/**
 * This computer always; with network access switched on (`npm run dev:lan`) also its address on your own network.
 * Only plain network addresses are accepted, never a web name, so a hostile site cannot point its own name at Lira.
 */
export const isAllowedHost = (host: string, lan: boolean) => LOCAL_HOST.test(host) || (lan && (PRIVATE_IPV4.test(host) || LOCAL_NAME.test(host)))

export const isLoopbackAddress = (addr: string | undefined) => !addr || addr === '::1' || addr === '127.0.0.1' || addr === '::ffff:127.0.0.1'

/** This computer's own addresses on the network. Opening Lira by its network address from the same computer is still this computer. */
function ownAddresses(): Set<string> {
  const set = new Set<string>()
  for (const list of Object.values(os.networkInterfaces())) for (const i of list ?? []) set.add(i.address.toLowerCase())
  return set
}

/** A connection from this computer: the loopback address, or any address that belongs to this computer. */
export const isThisComputer = (addr: string | undefined) => {
  if (isLoopbackAddress(addr)) return true
  const a = String(addr).toLowerCase().replace(/^::ffff:/, '')
  return ownAddresses().has(a)
}

function hostName(hostHeader: string | undefined): string | undefined {
  if (!hostHeader) return undefined
  return hostHeader.replace(/:\d+$/, '')
}

export interface GuardVerdict { ok: boolean; status?: number; reason?: string }

/**
 * - The Host header must be this computer (stops DNS rebinding: a hostile site pointing its name at 127.0.0.1).
 * - If the browser sends an Origin, it must be this computer too (stops other sites posting to us).
 * - Writes must be JSON, which a plain HTML form or `no-cors` request cannot send.
 */
export function checkApiRequest(req: { method?: string; headers: Record<string, string | string[] | undefined> }, opts: { lan?: boolean } = {}): GuardVerdict {
  const lan = !!opts.lan
  const h = (n: string) => { const v = req.headers[n]; return Array.isArray(v) ? v[0] : v }
  const host = hostName(h('host'))
  if (!host || !isAllowedHost(host, lan)) return { ok: false, status: 403, reason: 'Host not allowed' }

  const origin = h('origin')
  if (origin && origin !== 'null') {
    let originHost: string | undefined
    try { originHost = new URL(origin).hostname } catch { /* handled below */ }
    if (!originHost || !isAllowedHost(originHost, lan) || originHost.toLowerCase() !== host.toLowerCase()) return { ok: false, status: 403, reason: 'Origin not allowed' }
  } else if (origin === 'null') {
    return { ok: false, status: 403, reason: 'Origin not allowed' }
  }

  const site = h('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return { ok: false, status: 403, reason: 'Cross-site request' }

  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    if (!/^application\/json\b/i.test(h('content-type') || '')) return { ok: false, status: 415, reason: 'JSON required' }
  }
  return { ok: true }
}

export const ACCESS_COOKIE = 'lira_access'

/** The secret in the link you open on a tablet or phone. Kept in data/private/ (git-ignored) so the link keeps working after a restart. */
export function loadLanToken(dataDir: string): string {
  const file = path.join(dataDir, 'private', 'lan-token')
  try {
    const existing = fs.readFileSync(file, 'utf-8').trim()
    if (/^[a-f0-9]{32}$/.test(existing)) return existing
  } catch { /* first run */ }
  const token = crypto.randomBytes(16).toString('hex')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, token + '\n')
  return token
}

const same = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))

export type GateResult =
  | { action: 'allow' }
  | { action: 'login'; cookie: string; redirect: string }
  | { action: 'deny' }

/**
 * Network access is only for people who have the link. This computer never needs it. Another device must either arrive
 * with `?key=<token>` (it is then given a cookie and sent on to the clean address) or already hold the cookie.
 */
export function lanGate(input: { url: string; cookie?: string; remoteAddress?: string; token: string }): GateResult {
  if (isThisComputer(input.remoteAddress)) return { action: 'allow' }
  const u = new URL(input.url, 'http://lira.local')
  const key = u.searchParams.get('key')
  if (key && same(key, input.token)) {
    u.searchParams.delete('key')
    return {
      action: 'login',
      cookie: `${ACCESS_COOKIE}=${input.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000`,
      redirect: u.pathname + (u.search || '') + u.hash,
    }
  }
  const held = (input.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(`${ACCESS_COOKIE}=`))?.slice(ACCESS_COOKIE.length + 1)
  if (held && same(held, input.token)) return { action: 'allow' }
  return { action: 'deny' }
}

/** The page other devices see when they arrive without the secret link. It says what to do, and never contains the secret. */
export const LOCKED_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lira</title>
<style>body{font:16px/1.55 system-ui,sans-serif;background:#0f1522;color:#e6e9f0;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
main{max-width:460px}h1{font-size:22px;margin:0 0 8px}p{margin:8px 0;color:#b8c0d0}code{background:#1c2540;padding:2px 6px;border-radius:6px;color:#e6e9f0}</style></head>
<body><main><h1>Lira needs its private link</h1>
<p>This address is open only to devices that have the private link.</p>
<p>On the computer that runs Lira, open <b>Settings, Other devices</b> to see the link and a QR code, or look in the terminal where you ran <code>npm run dev:lan</code>. Open that link here once; this device is remembered afterwards.</p></main></body></html>`

/** Headers for every response: no framing (clickjacking), no sniffing, a content policy, no referrer. */
export function securityHeaders(dev: boolean): Record<string, string> {
  const csp = [
    "default-src 'self'",
    // the dev server injects a small inline script for hot reload
    `script-src 'self'${dev ? " 'unsafe-inline'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob:",
    // Gemini, or a model server you set up (Ollama on localhost, or an https one)
    "connect-src 'self' ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:* https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
  return {
    'Content-Security-Policy': csp,
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Resource-Policy': 'same-origin',
  }
}

/**
 * An append-only record of what was written to disk and when (names of files only, never their content).
 * Kept in data/private/audit.log, which is git-ignored.
 */
export function writeAudit(dataDir: string, action: string, files: string[]): void {
  if (!files.length) return
  try {
    const dir = path.join(dataDir, 'private')
    fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(path.join(dir, 'audit.log'), `${new Date().toISOString()} ${action} ${files.join(',')}\n`)
  } catch { /* the log must never break saving */ }
}

/** Reads a request body, refusing anything over the limit. */
export function readBody(req: NodeJS.ReadableStream & { destroy?: () => void }, limit = MAX_BODY_BYTES): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer | string) => {
      const b = typeof c === 'string' ? Buffer.from(c) : c
      size += b.length
      if (size > limit) { reject(new Error('too large')); req.destroy?.(); return }
      chunks.push(b)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

/** Space keys become file names, so they must be plain. Anything else is turned into underscores. */
export const safeSpaceKey = (key: unknown, id: unknown): string => {
  const raw = String(key || `SPACE-${id}`).toUpperCase().replace(/[^A-Z0-9_-]/g, '_').slice(0, 40)
  const name = raw.replace(/^[._-]+/, '') || `SPACE-${String(id).replace(/[^A-Z0-9_-]/gi, '_')}`
  return /^(CON|PRN|AUX|NUL|COM\d|LPT\d)$/.test(name) ? `_${name}` : name // reserved on Windows
}

/** Keys that would let a saved file change what every object inherits. */
export function hasPrototypePollution(value: unknown, depth = 0): boolean {
  if (depth > 40 || value === null || typeof value !== 'object') return false
  for (const k of Object.keys(value as object)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') return true
    if (hasPrototypePollution((value as Record<string, unknown>)[k], depth + 1)) return true
  }
  return false
}
