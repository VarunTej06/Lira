import { useEffect, useMemo, useState } from 'react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { useProjects } from '../../hooks/useProjects';
import { useRoadmaps } from '../../hooks/useRoadmaps';
import { myNames, type DataCtx } from '../../utils/dashboards/metrics';

/** Everything the dashboards read: tickets, spaces, projects, roadmaps, the time, and who "me" is. Refreshes every minute. */
export function useDashboardData(issues: Issue[], spaces: Space[]): DataCtx {
  const projects = useProjects(spaces);
  const { roadmaps } = useRoadmaps();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const me = useMemo(() => myNames(), []);
  return useMemo(() => ({ issues, spaces, projects, roadmaps, now, me }), [issues, spaces, projects, roadmaps, now, me]);
}
