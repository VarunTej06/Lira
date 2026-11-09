import { useCallback } from 'react';
import { isGlobalRoute, pathFor, routeForTab, spacePath, type AppRoute } from '../routes';
import type { Space } from '../types/space';

/** The address a page name (a board tab or a sidebar entry) leads to, keeping the project, sprint or roadmap you are on. */
export function pathForTab(tab: string, route: AppRoute, spaceKey: string | undefined): string {
  return pathFor(routeForTab(tab, {
    spaceKey,
    projectId: route.kind === 'projects' ? route.projectId : undefined,
    sprintKey: route.kind === 'sprints' ? route.sprintKey : undefined,
    roadmapId: route.kind === 'roadmaps' ? route.roadmapId : undefined,
  }));
}

/**
 * The moves between spaces and pages. Going to a space keeps the tab you are on when you are already inside a space, otherwise
 * opens its board; leaving a page that is not a space expands the sidebar again.
 */
export function useAppNavigation(opts: { route: AppRoute; navigate: (to: string) => void; spaces: Space[] | undefined; activeSpace: Space | undefined; setSidebarCollapsed: (collapsed: boolean) => void }) {
  const { route, navigate, spaces, activeSpace, setSidebarCollapsed } = opts;
  const handleSelectSpace = useCallback((id: number) => {
    const space = spaces?.find(s => s.id === id);
    if (!space) return;
    if (isGlobalRoute(route)) setSidebarCollapsed(false);
    navigate(spacePath(space.key, route.kind === 'space' ? route.tab : 'Board'));
  }, [spaces, route, navigate, setSidebarCollapsed]);
  const openSpaceBoard = useCallback((id: number) => {
    const space = spaces?.find(s => s.id === id);
    if (!space) return;
    setSidebarCollapsed(false);
    navigate(spacePath(space.key, 'Board'));
  }, [spaces, navigate, setSidebarCollapsed]);
  const goTab = useCallback((tab: string) => navigate(pathForTab(tab, route, activeSpace?.key)), [navigate, route, activeSpace]);
  return { handleSelectSpace, openSpaceBoard, goTab };
}
