import { confirmDialog } from '../../common/dialogs';
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import type { Space } from '../../../types/space';
import type { Project } from '../../../types/project';
import { currentSprintKey } from '../../../utils/sprintUtils';
import { deleteSpace } from '../../../hooks/useSpaces';
import { isGlobalTab } from '../../../routes';
import { loadSidebarConfig, type SidebarConfig } from '../CustomiseSidebarModal';
import { prevOf, useSectionState } from './parts';
import { User, FolderKanban, CalendarClock, Ticket, Map, LayoutDashboard } from 'lucide-react';

export interface LeftSidebarProps {
  spaces: Space[];
  activeSpaceId: number | undefined;
  onSpaceSelect: (id: number) => void;
  onCreateSpace: () => void;
  onEditSpace?: (space: Space) => void;
  onNavigateToFilters?: () => void;
  onNavigateToDashboards?: () => void;
  onNavigateToRoadmaps?: () => void;
  onNavigateToTeams?: () => void;
  onNavigateToList?: () => void;
  onNavigateToCalendar?: () => void;
  onNavigateToProjects?: () => void;
  onNavigateToSprints?: () => void;
  onNavigateToForYou?: () => void;
  projects?: Project[];
  activeProjectId?: string;
  onSelectProject?: (project: Project) => void;
  onCreateProject?: () => void;
  sprintKeys?: string[];
  sprintCounts?: Record<string, { done: number; total: number }>;
  activeSprint?: string;
  onSelectSprint?: (key: string) => void;
  onCreateSprint?: () => void;
  onDeleteProject?: (project: Project) => void;
  onDeleteSprint?: (key: string) => void;
  onNavigateToAllTickets?: () => void;
  sidebarCollapsed?: boolean;
  setSidebarCollapsed?: (collapsed: boolean) => void;
  activeTab?: string;
  hiddenSpaceIds?: number[];
  archivedSpaceIds?: number[];
  onToggleHideSpace?: (spaceId: number) => void;
  onToggleArchiveSpace?: (spaceId: number) => void;
  onUnhideAllSpaces?: () => void;
}

/** All of the sidebar's state and handlers. The parts of the sidebar (rail, navigation, sections...) read from this. */
export function useSidebarState(props: LeftSidebarProps) {
  const {
  
    spaces,
    activeSpaceId,
    onSpaceSelect,
    onCreateSpace,
    onEditSpace,
    onNavigateToDashboards,
    onNavigateToRoadmaps,
    onNavigateToProjects,
    onNavigateToSprints,
    onNavigateToForYou,
    onNavigateToAllTickets,
    projects = [],
    activeProjectId,
    onSelectProject,
    onCreateProject,
    sprintKeys = [],
    sprintCounts = {},
    activeSprint,
    onSelectSprint,
    onCreateSprint,
    onDeleteProject,
    onDeleteSprint,
    sidebarCollapsed = false,
    setSidebarCollapsed,
    activeTab,
    hiddenSpaceIds = [],
    archivedSpaceIds = [],
    onToggleHideSpace,
    onToggleArchiveSpace,
    onUnhideAllSpaces,
  } = props;
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(
    () => localStorage.getItem('lira_sidebar_collapsed') === 'true'
  );
  const isCollapsed = setSidebarCollapsed !== undefined ? sidebarCollapsed : internalCollapsed;
  const [isRotating, setIsRotating] = useState(false);
  const [spacesExpanded, setSpacesExpanded] = useSectionState('spaces', true);
  const [projectsExpanded, setProjectsExpanded] = useSectionState('projects', true);
  const [sprintsExpanded, setSprintsExpanded] = useSectionState('sprints', true);
  const [showAllSprints, setShowAllSprints] = useState(false);
  const [hiddenSpacesExpanded, setHiddenSpacesExpanded] = useState(true);
  const [archivedSpacesExpanded, setArchivedSpacesExpanded] = useState(false);
  const [hiddenHeaderMenuOpen, setHiddenHeaderMenuOpen] = useState(false);
  const hiddenMenuRef = useRef<HTMLDivElement>(null);

  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  // Menu of a project or sprint row ("project:<id>" / "sprint:<YYYY-MM>")
  const [rowMenu, setRowMenu] = useState<string | null>(null);

  // Any open row menu closes when you click anywhere else, or press Escape
  const openMenuKey = openMenuId !== null ? `space:${openMenuId}` : rowMenu;
  useEffect(() => {
    if (!openMenuKey) return;
    const close = () => { setOpenMenuId(null); setRowMenu(null); };
    const onDown = (e: MouseEvent) => {
      const root = (e.target as Element | null)?.closest?.('[data-menu-root]');
      if (!root || root.getAttribute('data-menu-root') !== openMenuKey) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [openMenuKey]);
  const [starredIds, setStarredIds] = useState<Set<number>>(new Set());
  const [showCustomiseModal, setShowCustomiseModal] = useState(false);

  useEffect(() => {
    if (!hiddenHeaderMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      const t = e.target as Element;
      if (hiddenMenuRef.current && !hiddenMenuRef.current.contains(t) && !t.closest?.('[data-floating]')) {
        setHiddenHeaderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [hiddenHeaderMenuOpen]);

  // Sidebar layout (which items are shown and in what order), edited in the Customise dialog
  const [sidebarConfig, setSidebarConfig] = useState<SidebarConfig>(loadSidebarConfig);

  const collapse = () => {
    setIsRotating(true);
    localStorage.setItem('lira_sidebar_collapsed', 'true');
    if (setSidebarCollapsed) {
      setSidebarCollapsed(true);
    } else {
      setInternalCollapsed(true);
    }
    setTimeout(() => setIsRotating(false), 300);
  };

  const expand = () => {
    setIsRotating(true);
    localStorage.setItem('lira_sidebar_collapsed', 'false');
    if (setSidebarCollapsed) {
      setSidebarCollapsed(false);
    } else {
      setInternalCollapsed(false);
    }
    setTimeout(() => setIsRotating(false), 300);
  };

  const handleSpaceClick = (id: number) => {
    setOpenMenuId(null);
    onSpaceSelect(id);
    if (isGlobalTab(activeTab ?? '')) {
      if (setSidebarCollapsed) {
        setSidebarCollapsed(false);
      } else {
        setInternalCollapsed(false);
      }
    }
  };

  const handleSaveConfig = (cfg: SidebarConfig) => {
    setSidebarConfig(cfg);
  };

  const toggleStar = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarredIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setOpenMenuId(null);
  };

  const handleDelete = async (space: Space, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(null);
    if (!space.id) return;
    if (!(await confirmDialog({ title: 'Delete space', message: `Delete "${space.name}" and all its issues? This cannot be undone.`, confirmLabel: 'Delete space', tone: 'danger' }))) return;
    await deleteSpace(space.id);
  };

  // Navigation items (the order and visibility come from the sidebar settings)
  const navItemDefs: Record<string, { label: string; icon: React.ReactNode; tab?: string; action: () => void }> = {
    forYou: { label: 'For you', icon: <User className="w-3.5 h-3.5 text-blue-400" />, tab: 'ForYou', action: () => onNavigateToForYou?.() },
    projects: { label: 'Projects', icon: <FolderKanban className="w-3.5 h-3.5 text-violet-400" />, tab: 'Projects', action: () => onNavigateToProjects?.() },
    sprints: { label: 'Sprints', icon: <CalendarClock className="w-3.5 h-3.5 text-teal-400" />, tab: 'SprintsHub', action: () => onNavigateToSprints?.() },
    allTickets: { label: 'All tickets', icon: <Ticket className="w-3.5 h-3.5 text-yellow-400" />, tab: 'AllTickets', action: () => onNavigateToAllTickets?.() },
    roadmaps: { label: 'Roadmaps', icon: <Map className="w-3.5 h-3.5 text-orange-400" />, tab: 'Roadmaps', action: () => onNavigateToRoadmaps?.() },
    dashboards: { label: 'Dashboards', icon: <LayoutDashboard className="w-3.5 h-3.5 text-purple-400" />, tab: 'Dashboards', action: () => onNavigateToDashboards?.() },
  };

  const isKeyVisible = (key: string): boolean => sidebarConfig.visibility[key] !== false;
  const visibleNavKeys = sidebarConfig.navOrder.filter(k => navItemDefs[k] && isKeyVisible(k));
  const visibleSectionKeys = sidebarConfig.sectionOrder.filter(isKeyVisible);
  const collapsedShortcuts = visibleNavKeys.slice(0, 6);

  const curSprint = currentSprintKey();
  const visibleSprintKeys = showAllSprints
    ? [...sprintKeys].reverse()
    : sprintKeys.filter(k => k >= prevOf(curSprint)).reverse().slice(0, 6);

  const visibleSpaces = spaces.filter(
    s => s.id && !hiddenSpaceIds.includes(s.id) && !archivedSpaceIds.includes(s.id)
  );
  const hiddenSpaces = spaces.filter(
    s => s.id && hiddenSpaceIds.includes(s.id)
  );
  const archivedSpaces = spaces.filter(
    s => s.id && archivedSpaceIds.includes(s.id)
  );

  const inSpaceView = !isGlobalTab(activeTab ?? '');
  const panelRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ top: 0, height: 0, visible: false });
  // Glide between rows, but not on the very first appearance (it would slide in from the top)
  const [indicatorAnimated, setIndicatorAnimated] = useState(false);
  useEffect(() => {
    if (indicator.visible && !indicatorAnimated) {
      const t = window.setTimeout(() => setIndicatorAnimated(true), 80);
      return () => window.clearTimeout(t);
    }
  }, [indicator.visible, indicatorAnimated]);

  // Measure the active row and glide the highlight to it. Re-measures through the section
  // expand/collapse animation so the highlight tracks rows while they move.
  const measureKey = [activeTab, activeSpaceId, activeProjectId, activeSprint, spacesExpanded, projectsExpanded, sprintsExpanded, isCollapsed, spaces.length, projects.length, sprintKeys.length, showAllSprints, hiddenSpaceIds.length, archivedSpaceIds.length].join('|');
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || isCollapsed) return;
    const measure = () => {
      const el = panel.querySelector<HTMLElement>('[data-active="true"]');
      if (!el) {
        setIndicator(prev => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }
      const top = el.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop;
      const height = el.getBoundingClientRect().height;
      setIndicator(prev => (prev.visible && Math.abs(prev.top - top) < 0.5 && Math.abs(prev.height - height) < 0.5 ? prev : { top, height, visible: true }));
    };
    measure();
    const start = performance.now();
    let raf = 0;
    const loop = () => {
      measure();
      if (performance.now() - start < 450) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // Keep the highlight on its row when layout shifts later (web fonts loading, sections resizing)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : undefined;
    ro?.observe(panel);
    Array.from(panel.children).forEach(c => ro?.observe(c));
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, [measureKey]);

  return {
    spaces,
    activeSpaceId,
    onSpaceSelect,
    onCreateSpace,
    onEditSpace,
    onNavigateToDashboards,
    onNavigateToRoadmaps,
    onNavigateToProjects,
    onNavigateToSprints,
    onNavigateToForYou,
    onNavigateToAllTickets,
    projects,
    activeProjectId,
    onSelectProject,
    onCreateProject,
    sprintKeys,
    sprintCounts,
    activeSprint,
    onSelectSprint,
    onCreateSprint,
    onDeleteProject,
    onDeleteSprint,
    sidebarCollapsed,
    setSidebarCollapsed,
    activeTab,
    hiddenSpaceIds,
    archivedSpaceIds,
    onToggleHideSpace,
    onToggleArchiveSpace,
    onUnhideAllSpaces,
    internalCollapsed,
    setInternalCollapsed,
    isCollapsed,
    isRotating,
    setIsRotating,
    spacesExpanded,
    setSpacesExpanded,
    projectsExpanded,
    setProjectsExpanded,
    sprintsExpanded,
    setSprintsExpanded,
    showAllSprints,
    setShowAllSprints,
    hiddenSpacesExpanded,
    setHiddenSpacesExpanded,
    archivedSpacesExpanded,
    setArchivedSpacesExpanded,
    hiddenHeaderMenuOpen,
    setHiddenHeaderMenuOpen,
    hiddenMenuRef,
    openMenuId,
    setOpenMenuId,
    rowMenu,
    setRowMenu,
    openMenuKey,
    starredIds,
    setStarredIds,
    showCustomiseModal,
    setShowCustomiseModal,
    sidebarConfig,
    setSidebarConfig,
    collapse,
    expand,
    handleSpaceClick,
    handleSaveConfig,
    toggleStar,
    handleDelete,
    navItemDefs,
    isKeyVisible,
    visibleNavKeys,
    visibleSectionKeys,
    collapsedShortcuts,
    curSprint,
    visibleSprintKeys,
    visibleSpaces,
    hiddenSpaces,
    archivedSpaces,
    inSpaceView,
    panelRef,
    indicator,
    setIndicator,
    indicatorAnimated,
    setIndicatorAnimated,
    measureKey,
  };
}

export type SidebarState = ReturnType<typeof useSidebarState>;
