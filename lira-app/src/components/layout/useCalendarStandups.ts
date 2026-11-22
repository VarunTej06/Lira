import { useEffect, useMemo, useState } from 'react';
import { listStandups, type Standup } from '../../services/standupsApi';
import { formatDateKey } from '../../utils/calendarGrid';
import { activeOrg } from '../../utils/hostedOrg';
import { isHosted } from '../../utils/edition';
import { occurrences } from '../../utils/standupSchedule';

export interface CalendarStandup { id: string; title: string; at: number; link: string }

const DAY_MS = 86_400_000;

/**
 * Hosted edition: the stand-up calls the person is invited to, as they fall on the days of the month being shown, so the calendar
 * lists them with the tickets. A series appears on each of its days. In the local edition there are none.
 */
export function useCalendarStandups(firstDay: Date, lastDay: Date): Map<string, CalendarStandup[]> {
  const [calls, setCalls] = useState<Standup[]>([]);
  const org = activeOrg();

  useEffect(() => {
    if (!isHosted() || !org) return;
    let current = true;
    void listStandups(org).then(r => { if (current && r.ok) setCalls(r.data); });
    return () => { current = false; };
  }, [org]);

  const from = firstDay.getTime();
  const to = lastDay.getTime() + DAY_MS;
  return useMemo(() => {
    const byDay = new Map<string, CalendarStandup[]>();
    for (const call of calls) {
      for (const at of occurrences(call, from, to)) {
        const key = formatDateKey(new Date(at));
        byDay.set(key, [...(byDay.get(key) ?? []), { id: call.id, title: call.title, at, link: call.link }]);
      }
    }
    for (const list of byDay.values()) list.sort((a, b) => a.at - b.at);
    return byDay;
  }, [calls, from, to]);
}
