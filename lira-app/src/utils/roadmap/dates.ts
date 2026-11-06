/** Calendar-day helpers (no times, no time zones). */
export const DAY = 86_400_000;

export function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function fmtDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Whole days from a to b (b later => positive). Ignores time of day and DST. */
export function daysBetween(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / DAY);
}

export const todayStr = (now = new Date()) => fmtDay(now);

export function fmtShort(s: string): string {
  return parseDay(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
