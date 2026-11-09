export const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function fromKey(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export const formatPretty = (s: string) => {
  const d = fromKey(s);
  return d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
};

/** The 6 x 7 days shown for a month, starting on Monday. */
export function monthGrid(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(year, month, 1 - lead + i);
    return { date, inMonth: date.getMonth() === month };
  });
}

/** How a day button looks: the chosen day is filled, today is ringed, days of other months are dimmer. */
export const dayClass = (selected: boolean, today: boolean, inMonth: boolean): string => {
  if (selected) return 'bg-lira-blue text-white font-semibold';
  if (today) return 'ring-1 ring-lira-blue text-lira-blue font-semibold hover:bg-lira-blue-light';
  return inMonth ? 'hover:bg-gray-100' : 'text-lira-muted hover:bg-gray-50';
};

/** A day is not allowed when it is before `min` or after `max` (both optional "YYYY-MM-DD"). */
export const outOfRange = (key: string, min?: string, max?: string): boolean => (!!min && key < min) || (!!max && key > max);
