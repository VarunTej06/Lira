import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, mount, q, qa, settle } from '../../test/render';
import { setActiveOrg } from '../../utils/hostedOrg';
import { CalendarView } from './CalendarView';

const edition = vi.hoisted(() => ({ hosted: true }));
vi.mock('../../utils/edition', async importOriginal => ({ ...(await importOriginal<typeof import('../../utils/edition')>()), isHosted: () => edition.hosted }));
const api = vi.hoisted(() => ({ listStandups: vi.fn() }));
vi.mock('../../services/standupsApi', async importOriginal => ({ ...(await importOriginal<typeof import('../../services/standupsApi')>()), ...api }));

/** A call on the first Monday of the month being shown (this month), at 10:00 UTC, repeating on weekdays for the rest of that week. */
function seriesThisMonth() {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 10, 0));
  while (first.getUTCDay() !== 1) first.setUTCDate(first.getUTCDate() + 1);
  const last = new Date(first.getTime() + 4 * 86_400_000);
  return { id: 's1', title: 'Daily', startsAt: first.toISOString(), durationMinutes: 15, link: 'https://meet.google.com/abc-defg-hij', linkSource: 'pasted' as const, repeat: 'weekdays' as const, repeatUntil: last.toISOString().slice(0, 10), timeZone: 'UTC', invitees: null };
}

beforeEach(() => { edition.hosted = true; api.listStandups.mockReset(); setActiveOrg('org-1'); });
afterEach(() => { cleanup(); setActiveOrg(null); });

describe('stand-ups in the calendar', () => {
  it('appear on each day of a series, with the time and title, as a link that joins the call', async () => {
    api.listStandups.mockResolvedValue({ ok: true, data: [seriesThisMonth()] });
    mount(<CalendarView issues={[]} space={undefined} onSelectIssue={() => undefined} />);
    await settle(40);
    const chips = qa<HTMLAnchorElement>('[data-testid="calendar-standup"]');
    expect(chips).toHaveLength(5);
    expect(chips[0].textContent).toContain('Daily');
    expect(chips[0].getAttribute('href')).toBe('https://meet.google.com/abc-defg-hij');
    expect(chips[0].getAttribute('target')).toBe('_blank');
    expect(chips[0].getAttribute('rel')).toContain('noopener');
    expect(chips[0].closest('[data-date]')).not.toBeNull();
    expect(new Set(chips.map(c => c.closest('[data-date]')!.getAttribute('data-date'))).size).toBe(5);
  });

  it('are not links when the address is not a meeting, and are not asked for at all in the local edition', async () => {
    api.listStandups.mockResolvedValue({ ok: true, data: [{ ...seriesThisMonth(), link: 'https://evil.example/x' }] });
    mount(<CalendarView issues={[]} space={undefined} onSelectIssue={() => undefined} />);
    await settle(40);
    expect(qa('[data-testid="calendar-standup"]').every(c => c.tagName === 'DIV')).toBe(true);
    cleanup();
    edition.hosted = false;
    api.listStandups.mockClear();
    mount(<CalendarView issues={[]} space={undefined} onSelectIssue={() => undefined} />);
    await settle(40);
    expect(api.listStandups).not.toHaveBeenCalled();
    expect(q('[data-testid="calendar-standup"]')).toBeNull();
  });

  it('leave the calendar as it was when the server cannot be asked', async () => {
    api.listStandups.mockResolvedValue({ ok: false, status: 0, message: 'no' });
    mount(<CalendarView issues={[]} space={undefined} onSelectIssue={() => undefined} />);
    await settle(40);
    expect(q('[data-testid="calendar-view"]')).not.toBeNull();
    expect(q('[data-testid="calendar-standup"]')).toBeNull();
  });
});
