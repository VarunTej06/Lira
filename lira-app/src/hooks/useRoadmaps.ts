import { useCallback, useEffect, useState } from 'react';
import { migrateLiraSchedule, seedLiraRoadmap, type Roadmap } from '../utils/roadmapUtils';
import { appStorage } from '../utils/appStorage';

const KEY = 'lira_roadmaps';
const ROADMAPS_EVENT = 'lira-roadmaps-changed';

/** Upgrades roadmaps saved by earlier versions: the space comes from the old project key, and one linked epic replaces the old list. */
function normalizeRoadmap(input: Roadmap): Roadmap {
  const rm = migrateLiraSchedule(input);
  return {
    ...rm,
    spaceKey: rm.spaceKey || rm.projectKey,
    items: (rm.items || []).map(raw => {
      const { epicKeys, ...item } = raw as Roadmap['items'][number] & { epicKeys?: string[] };
      return { ...item, epicKey: item.epicKey ?? epicKeys?.[0] };
    }),
  };
}

/** Reads roadmaps. The first time (no saved value) the Lira product roadmap is created from ROADMAP.md. */
export function readRoadmaps(): Roadmap[] {
  try {
    const raw = appStorage.get(KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(normalizeRoadmap);
    }
  } catch (e) {
    console.error('Failed to parse lira_roadmaps', e);
  }
  const seeded = [seedLiraRoadmap()];
  writeRoadmaps(seeded);
  return seeded;
}

export function writeRoadmaps(list: Roadmap[]): void {
  try {
    appStorage.set(KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save lira_roadmaps', e);
  }
  window.dispatchEvent(new Event(ROADMAPS_EVENT));
}

/** Live roadmaps plus helpers to change one. Saved to data/roadmaps.json through the disk mirror. */
export function useRoadmaps() {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>(() => readRoadmaps());
  useEffect(() => {
    const refresh = () => setRoadmaps(readRoadmaps());
    window.addEventListener(ROADMAPS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(ROADMAPS_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const update = useCallback((id: string, fn: (rm: Roadmap) => Roadmap) => {
    writeRoadmaps(readRoadmaps().map(r => (r.id === id ? { ...fn(r), updatedAt: new Date().toISOString() } : r)));
  }, []);
  const add = useCallback((rm: Roadmap) => writeRoadmaps([...readRoadmaps(), rm]), []);
  const remove = useCallback((id: string) => writeRoadmaps(readRoadmaps().filter(r => r.id !== id)), []);

  return { roadmaps, update, add, remove };
}
