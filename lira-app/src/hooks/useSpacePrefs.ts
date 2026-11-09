import { useCallback, useEffect, useState } from 'react';
import type { Space } from '../types/space';
import type { AppRoute } from '../routes';
import { appStorage } from '../utils/appStorage';

const readList = (key: string): number[] => {
  try { return JSON.parse(appStorage.get(key) || '[]'); } catch { return []; }
};
const ACTIVE_KEY = 'lira_active_space_id';
const HIDDEN_KEY = 'lira_hidden_spaces';
const ARCHIVED_KEY = 'lira_archived_spaces';

/** Adds the id to the saved list, or removes it when already there. */
function toggleId(key: string, set: (fn: (prev: number[]) => number[]) => void, id: number) {
  set(prev => {
    const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
    appStorage.set(key, JSON.stringify(next));
    return next;
  });
}

/**
 * The space to remember next: the one in the address when it differs from the remembered one; otherwise, when the remembered
 * space is gone, CERT or the first space; otherwise undefined (nothing to change).
 */
export function nextRememberedSpaceId(routeSpaceId: number | undefined, lastSpaceId: number | undefined, spaces: Space[] | undefined): number | undefined {
  if (routeSpaceId && routeSpaceId !== lastSpaceId) return routeSpaceId;
  if (!spaces || spaces.length === 0 || (lastSpaceId && spaces.some(s => s.id === lastSpaceId))) return undefined;
  return (spaces.find(s => s.key === 'CERT') || spaces[0]).id;
}

/** The space on screen, taken from the address. On other pages it is the last space used, or CERT / the first one when that one is gone. */
export function useActiveSpace(route: AppRoute, spaces: Space[] | undefined) {
  const routeSpace = route.kind === 'space' ? spaces?.find(s => s.key.toUpperCase() === route.spaceKey) : undefined;
  const [lastSpaceId, setLastSpaceId] = useState<number | undefined>(() => {
    const saved = appStorage.get(ACTIVE_KEY);
    return saved ? Number(saved) : undefined;
  });
  const wanted = nextRememberedSpaceId(routeSpace?.id, lastSpaceId, spaces);
  if (wanted !== undefined && wanted !== lastSpaceId) setLastSpaceId(wanted);
  useEffect(() => { if (lastSpaceId !== undefined) appStorage.set(ACTIVE_KEY, String(lastSpaceId)); }, [lastSpaceId]);

  return { routeSpace, activeSpace: routeSpace ?? spaces?.find(s => s.id === lastSpaceId) };
}

/** Which spaces are hidden or archived in the sidebar, remembered between visits. */
export function useSpacePrefs() {
  const [hiddenSpaceIds, setHidden] = useState<number[]>(() => readList(HIDDEN_KEY));
  const [archivedSpaceIds, setArchived] = useState<number[]>(() => readList(ARCHIVED_KEY));

  return {
    hiddenSpaceIds,
    archivedSpaceIds,
    toggleHideSpace: useCallback((id: number) => toggleId(HIDDEN_KEY, setHidden, id), []),
    toggleArchiveSpace: useCallback((id: number) => toggleId(ARCHIVED_KEY, setArchived, id), []),
    unhideAllSpaces: useCallback(() => { setHidden([]); appStorage.set(HIDDEN_KEY, '[]'); }, []),
  };
}
