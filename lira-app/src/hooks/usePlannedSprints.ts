import { useEffect, useMemo, useState } from 'react';
import { getPlannedSprints, SPRINTS_EVENT } from '../utils/sprintUtils';

/** The sprints planned ahead of time. The list is read again whenever a sprint is planned or deleted. */
export function usePlannedSprints(): string[] {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    window.addEventListener(SPRINTS_EVENT, bump);
    return () => window.removeEventListener(SPRINTS_EVENT, bump);
  }, []);
  // tick is only here so the list is read again after the event
  return useMemo(() => (tick >= 0 ? getPlannedSprints() : []), [tick]);
}
