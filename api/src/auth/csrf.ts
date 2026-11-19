/**
 * Cross-site request protection for the calls that change something. The session cookie is SameSite=Lax; on top of that a
 * call must come from one of our own pages (its Origin is on the list) and carry a header that a plain form cannot send.
 */
export const CLIENT_HEADER = 'x-requested-with';
export const CLIENT_VALUE = 'liraspaces';

const READ_ONLY = new Set(['GET', 'HEAD', 'OPTIONS']);

export type RequestCheck = 'ok' | 'bad_origin' | 'bad_header';

export function checkRequest(method: string, headers: Record<string, string | string[] | undefined>, allowedOrigins: readonly string[]): RequestCheck {
  if (READ_ONLY.has(method.toUpperCase())) return 'ok';
  const origin = headers.origin;
  if (typeof origin !== 'string' || !allowedOrigins.includes(origin)) return 'bad_origin';
  return headers[CLIENT_HEADER] === CLIENT_VALUE ? 'ok' : 'bad_header';
}
