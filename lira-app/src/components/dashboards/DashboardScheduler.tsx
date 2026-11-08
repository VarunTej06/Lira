import { useEffect, useRef } from 'react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { readDashboards, updateDashboard } from '../../utils/dashboards/store';
import { saveSnapshotFile, snapshotDue, snapshotFileName, snapshotMarkdown } from '../../utils/dashboards/snapshot';
import { myNames } from '../../utils/dashboards/metrics';
import { readProjects } from '../../hooks/useProjects';
import { readRoadmaps } from '../../hooks/useRoadmaps';
import { notifySaved } from '../common/SavedToast';

/**
 * Takes the weekly dashboard snapshots. It checks once a minute (and at start-up) while Lira is open, and takes
 * every snapshot whose day and hour have passed since the last one. Shows nothing.
 */
export function DashboardScheduler({ issues, spaces }: { issues: Issue[]; spaces: Space[] }) {
  const latest = useRef({ issues, spaces });
  latest.current = { issues, spaces };
  const running = useRef(false);

  useEffect(() => {
    const check = async () => {
      if (running.current) return;
      const { issues: all, spaces: sp } = latest.current;
      if (all.length === 0) return; // data has not loaded yet
      const now = new Date();
      const due = readDashboards().filter(d => snapshotDue(d.snapshot, now));
      if (!due.length) return;
      running.current = true;
      try {
        const ctx = { issues: all, spaces: sp, projects: readProjects(sp), roadmaps: readRoadmaps(), now, me: myNames() };
        for (const d of due) {
          const r = await saveSnapshotFile(snapshotFileName(d, now), snapshotMarkdown(d, ctx));
          if (r.ok) {
            updateDashboard(d.id, x => ({ ...x, snapshot: { ...(x.snapshot ?? { enabled: true, day: 1, hour: 9 }), lastRun: now.toISOString() } }));
            notifySaved(`Weekly snapshot saved: ${d.name}`);
          }
        }
      } finally { running.current = false; }
    };
    const first = window.setTimeout(() => { void check(); }, 4000);
    const t = window.setInterval(() => { void check(); }, 60_000);
    return () => { window.clearTimeout(first); window.clearInterval(t); };
  }, []);

  return null;
}
