import fs from 'fs'
import path from 'path'

/**
 * Protection for the local /api/* routes. Lira runs on your own computer, but any web page you have open can still
 * try to talk to localhost (a forged form post, or "DNS rebinding"). These checks make sure only Lira itself can.
 */

/** Largest request body accepted, in bytes. Ticket data with attachments can be big, but not unlimited. */
export const MAX_BODY_BYTES = 50 * 1024 * 1024

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/i

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
export function checkApiRequest(req: { method?: string; headers: Record<string, string | string[] | undefined> }): GuardVerdict {
  const h = (n: string) => { const v = req.headers[n]; return Array.isArray(v) ? v[0] : v }
  const host = hostName(h('host'))
  if (!host || !LOCAL_HOST.test(host)) return { ok: false, status: 403, reason: 'Host not allowed' }

  const origin = h('origin')
  if (origin && origin !== 'null') {
    let originHost: string | undefined
    try { originHost = new URL(origin).hostname } catch { /* handled below */ }
    if (!originHost || !LOCAL_HOST.test(originHost)) return { ok: false, status: 403, reason: 'Origin not allowed' }
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
