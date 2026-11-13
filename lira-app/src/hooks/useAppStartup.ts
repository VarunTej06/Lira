import { useEffect, useState } from 'react';
import { requestDurableStorage } from '../db/db';
import { initLocalDiskSync } from '../services/localDiskSync';
import { syncPendingRoadmaps } from '../services/roadmapEpics';
import { stampLegacySprints } from '../utils/sprintUtils';

/** Runs the start-up steps once, in order, and says when the app is ready to show. */
export function useAppStartup(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const init = async () => {
      await requestDurableStorage();
      await initLocalDiskSync();
      await stampLegacySprints();
      await syncPendingRoadmaps(); // a changed roadmap schedule reaches its epics and tasks (and stops future sprints from piling up)
      setReady(true);
    };
    void init();
  }, []);
  return ready;
}
