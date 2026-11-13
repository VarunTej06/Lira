interface CalendarDay { date: Date; isCurrentMonth: boolean; key: string }

/** A day as `YYYY-MM-DD` in local time. */
export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** The day key of a due date, or null when there is none or it is not a date. */
export function parseDueDateKey(raw: Date | string | undefined): string | null {
  if (!raw) return null;
  const parsed = raw instanceof Date ? raw : new Date(raw);
  return isNaN(parsed.getTime()) ? null : formatDateKey(parsed);
}

/** The days to draw for a month: whole weeks, Monday first, padded with the neighbouring months. */
export function monthGrid(year: number, month: number): CalendarDay[] {
  const leading = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = Monday
  const inMonth = new Date(year, month + 1, 0).getDate();
  const trailing = (7 - ((leading + inMonth) % 7)) % 7;
  // new Date() rolls days outside 1..inMonth into the neighbouring months
  return Array.from({ length: leading + inMonth + trailing }, (_, i) => {
    const date = new Date(year, month, i - leading + 1);
    return { date, isCurrentMonth: date.getMonth() === month, key: formatDateKey(date) };
  });
}
