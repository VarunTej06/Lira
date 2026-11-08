import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  isTomorrow,
  parseISO,
} from 'date-fns';

function toValidDate(date: Date | string | undefined | null): Date | null {
  if (!date) return null;
  try {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function formatRelativeDate(date: Date | string | undefined | null): string {
  const d = toValidDate(date);
  if (!d) return '';

  try {
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    if (isTomorrow(d)) return 'Tomorrow';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '';
  }
}

export function formatAbsoluteDate(date: Date | string | undefined | null): string {
  const d = toValidDate(date);
  if (!d) return '';
  try {
    return format(d, 'd MMM yyyy');
  } catch {
    return '';
  }
}

export function formatDateTime(date: Date | string | undefined | null): string {
  const d = toValidDate(date);
  if (!d) return '';
  try {
    if (isToday(d)) return `Today at ${format(d, 'h:mm a')}`;
    if (isYesterday(d)) return `Yesterday at ${format(d, 'h:mm a')}`;
    return format(d, 'd MMM yyyy, h:mm a');
  } catch {
    return '';
  }
}

export function formatDueDate(date: Date | string | undefined | null): string {
  const d = toValidDate(date);
  if (!d) return '';
  try {
    return format(d, 'd MMM yyyy');
  } catch {
    return '';
  }
}

export function isDueSoon(date: Date | string | undefined | null): boolean {
  const d = toValidDate(date);
  if (!d) return false;
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000; // within 3 days
}

export function isOverdue(date: Date | string | undefined | null): boolean {
  const d = toValidDate(date);
  if (!d) return false;
  return d < new Date();
}

export function formatTimeTracking(minutes: number): string {
  if (minutes === 0) return '0h';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

/** Day, date and time, for example "Sun, 8 Nov 2026 at 3:42 PM". Used on comments and history. */
export function formatDayDateTime(date: Date | string | undefined | null): string {
  const d = toValidDate(date);
  if (!d) return '';
  try {
    return `${format(d, 'EEE, d MMM yyyy')} at ${format(d, 'h:mm a')}`;
  } catch {
    return '';
  }
}
