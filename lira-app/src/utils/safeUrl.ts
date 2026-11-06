/**
 * Links that people type or paste (a repository, a meeting) end up in an `href`. A `javascript:` or `data:` link there
 * would run script inside Lira when clicked, so only web links are allowed.
 */
export function safeHttpUrl(value: string | undefined | null): string | undefined {
  const raw = (value ?? '').trim();
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined;
  } catch {
    return undefined; // not an absolute URL: do not guess, a relative link would point inside Lira
  }
}
