import { createPublicKey, verify } from 'node:crypto';

/** One of Google's published signing keys, as it is listed at their certificates address. */
export interface Jwk { kty: string; kid?: string; n?: string; e?: string }

export interface GoogleClaims { sub: string; email: string; emailVerified: boolean; name: string }

export interface IdTokenChecks { clientId: string; nonce: string; keys: Jwk[]; now?: number }

const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

const decode = (part: string): Record<string, unknown> => JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;

/**
 * Checks the ID token Google gave in exchange for the sign-in code, and returns who it is for. Every check must pass: the signature
 * (RS256, with one of Google's published keys), the issuer, that it was made for this app (audience), that it has not expired, that
 * it carries the nonce this sign-in started with, and that Google has verified the email address. Anything else returns null.
 */
export function verifyIdToken(token: string, checks: IdTokenChecks): GoogleClaims | null {
  try {
    const [head, body, signature] = token.split('.');
    if (!head || !body || !signature) return null;
    const header = decode(head);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
    const jwk = checks.keys.find(k => k.kid === header.kid);
    if (!jwk) return null;
    const signed = verify('RSA-SHA256', Buffer.from(`${head}.${body}`), createPublicKey({ key: jwk as never, format: 'jwk' }), Buffer.from(signature, 'base64url'));
    if (!signed) return null;
    const claims = decode(body);
    const now = Math.floor((checks.now ?? Date.now()) / 1000);
    if (typeof claims.iss !== 'string' || !ISSUERS.includes(claims.iss)) return null;
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audience.includes(checks.clientId)) return null;
    if (typeof claims.exp !== 'number' || claims.exp <= now) return null;
    if (claims.nonce !== checks.nonce) return null;
    if (typeof claims.sub !== 'string' || !claims.sub || typeof claims.email !== 'string' || claims.email_verified !== true) return null;
    const email = claims.email.trim().toLowerCase();
    const name = typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim().slice(0, 100) : email.split('@')[0];
    return { sub: claims.sub, email, emailVerified: true, name };
  } catch {
    return null;
  }
}
