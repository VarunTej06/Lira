import { useCallback, useEffect, useState } from 'react';
import type { Space } from '../types/space';
import type { AppRoute } from '../routes';

const readList = (key: string): number[] => {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
};
const ACTIVE_KEY = 'lira_active_space_id';
const HIDDEN_KEY = 'lira_hidden_spaces';
const ARCHIVED_KEY = 'lira_archived_spaces';

/** The space on screen, taken from the address. On other pages it is the last space used, or CERT / the first one when that one is gone. */
export function useActiveSpace(route: AppRoute, spaces: Space[] | undefined) {
  const routeSpace = route.kind === 'space' ? spaces?.find(s => s.key.toUpperCase() === route.spaceKey) : undefined;
  const [lastSpaceId, setLastSpaceId] = useState<number | undefined>(() => {
    const saved = localStorage.getItem(ACTIVE_KEY);
    return saved ? Number(saved) : undefined;
  });
  const remember = useCallback((id: number | undefined) => {
    setLastSpaceId(id);
    if (id !== undefined) localStorage.setItem(ACTIVE_KEY, String(id));
  }, []);

  useEffect(() => { if (routeSpace?.id && routeSpace.id !== lastSpaceId) remember(routeSpace.id); }, [routeSpace, lastSpaceId, remember]);
  useEffect(() => {
    if (!spaces || spaces.length === 0 || (lastSpaceId && spaces.some(s => s.id === lastSpaceId))) return;
    remember((spaces.find(s => s.key === 'CERT') || spaces[0]).id);
  }, [spaces, lastSpaceId, remember]);

  return { routeSpace, activeSpace: routeSpace ?? spaces?.find(s => s.id === lastSpaceId) };
}

/** Which spaces are hidden or archived in the sidebar, remembered between visits. */
export function useSpacePrefs() {
  const [hiddenSpaceIds, setHidden] = useState<number[]>(() => readList(HIDDEN_KEY));
  const [archivedSpaceIds, setArchived] = useState<number[]>(() => readList(ARCHIVED_KEY));

  const toggler = (key: string, set: (fn: (prev: number[]) => number[]) => void) => (id: number) =>
    set(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });

  return {
    hiddenSpaceIds,
    archivedSpaceIds,
    toggleHideSpace: useCallback(toggler(HIDDEN_KEY, setHidden), []), // eslint-disable-line react-hooks/exhaustive-deps
    toggleArchiveSpace: useCallback(toggler(ARCHIVED_KEY, setArchived), []), // eslint-disable-line react-hooks/exhaustive-deps
    unhideAllSpaces: useCallback(() => { setHidden([]); localStorage.setItem(HIDDEN_KEY, '[]'); }, []),
  };
}
