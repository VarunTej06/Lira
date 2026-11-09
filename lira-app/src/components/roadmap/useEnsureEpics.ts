import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { readRoadmaps } from '../../hooks/useRoadmaps';
import { ensureEpics } from '../../services/roadmapEpics';
import type { Roadmap } from '../../utils/roadmapUtils';

export type Notice = { tone: 'info' | 'error'; text: string } | null;

/**
 * Every roadmap item must be an epic. When a roadmap opens, create the missing epics (in the Backlog) and the checklist
 * tasks, save their keys on the items, and tell the person what was created.
 */
export function useEnsureEpics(
  roadmap: Roadmap | undefined, spaces: Space[], issues: Issue[], space: Space | undefined,
  update: (id: string, change: (r: Roadmap) => Roadmap) => void, setNotice: Dispatch<SetStateAction<Notice>>,
) {
  const running = useRef(false);
  useEffect(() => {
    if (!roadmap || spaces.length === 0 || running.current) return;
    const epicKeys = new Set(issues.filter(i => i.type === 'epic').map(i => i.key));
    const taskKeys = new Set(issues.filter(i => i.type !== 'epic').map(i => i.key));
    const known = issues.length > 0; // before the tickets have loaded, nothing can be called missing
    const missing = roadmap.items.some(i => !i.epicKey || (known && !epicKeys.has(i.epicKey))
      || (i.children.length > 0 && (!i.taskKey || (known && !taskKeys.has(i.taskKey)))));
    if (!missing) return;

    running.current = true;
    const latest = readRoadmaps().find(r => r.id === roadmap.id) || roadmap; // never act on a stale copy: that could create duplicates
    ensureEpics(latest, spaces).then(res => {
      if (res.error) return setNotice({ tone: 'error', text: res.error });
      if (!res.created.length && !res.tasks.length) return;
      update(roadmap.id, r => ({ ...r, items: r.items.map(i => res.items.find(x => x.id === i.id) || i) }));
      const parts: string[] = [];
      if (res.created.length) parts.push(`${res.created.length} ${res.created.length === 1 ? 'epic' : 'epics'} (${res.created[0]}${res.created.length > 1 ? ` to ${res.created[res.created.length - 1]}` : ''})`);
      if (res.tasks.length) parts.push(`${res.tasks.length} checklist ${res.tasks.length === 1 ? 'task' : 'tasks'}`);
      setNotice({ tone: 'info', text: `Created ${parts.join(' and ')} in ${space?.name}. They are in the Backlog.` });
    }).finally(() => { running.current = false; });
    // Run when the roadmap, its space or the number of items, spaces or tickets changes (not on every edit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roadmap?.id, roadmap?.spaceKey, roadmap?.items.length, spaces.length, issues.length]);
}
