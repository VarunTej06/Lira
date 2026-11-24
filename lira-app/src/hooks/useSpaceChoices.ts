import { useEffect, useState } from 'react';
import { listSpaces } from '../services/workspaceApi';

export interface SpaceChoice { id: number; name: string }

/** The spaces of the organisation, to pick one in a form. Empty until the server answers, and when it cannot be reached. */
export function useSpaceChoices(org: string): SpaceChoice[] {
  const [choices, setChoices] = useState<SpaceChoice[]>([]);
  useEffect(() => {
    let current = true;
    void listSpaces(org).then(r => { if (current) setChoices(r.ok ? r.data.flatMap(s => (s.id === undefined ? [] : [{ id: s.id, name: s.name }])) : []); });
    return () => { current = false; };
  }, [org]);
  return choices;
}
