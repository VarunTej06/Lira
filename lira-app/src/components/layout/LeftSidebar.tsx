import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
  ChevronLeft, ChevronRight, Plus,
  Users, Folder, Settings,
  ChevronDown, MoreHorizontal, Star, Trash2, Archive,
  Edit3, Palette, LayoutDashboard,
  User, Map,
  FolderKanban, Eye, EyeOff, ArchiveRestore, CalendarClock, Ticket
} from 'lucide-react';
import type { Space } from '../../types/space';
import type { Project } from '../../types/project';
import { canDeleteSprint, currentSprintKey, sprintLabel, sprintName, sprintPhase } from '../../utils/sprintUtils';
import { deleteSpace } from '../../hooks/useSpaces';
import { CustomiseSidebarModal, loadSidebarConfig, type SidebarConfig } from './CustomiseSidebarModal';

interface LeftSidebarProps {
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
  onTabChange?: (tab: string) => void;
  hiddenSpaceIds?: number[];
  archivedSpaceIds?: number[];
  onToggleHideSpace?: (spaceId: number) => void;
  onToggleArchiveSpace?: (spaceId: number) => void;
  onUnhideAllSpaces?: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
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
  onTabChange,
  hiddenSpaceIds = [],
  archivedSpaceIds = [],
  onToggleHideSpace,
  onToggleArchiveSpace,
  onUnhideAllSpaces,
}) => {
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
      if (hiddenMenuRef.current && !hiddenMenuRef.current.contains(e.target as Node)) {
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
    if (GLOBAL_TABS.includes(activeTab ?? '')) {
      onTabChange?.('Board');
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
    if (!window.confirm(`Delete "${space.name}" and all its issues? This cannot be undone.`)) return;
    await deleteSpace(space.id);
  };

  // Navigation items (the order and visibility come from the sidebar settings)
  const navItemDefs: Record<string, { label: string; icon: React.ReactNode; tab?: string; action: () => void }> = {
    forYou: { label: 'For you', icon: <User className="w-3.5 h-3.5 text-blue-400" />, tab: 'ForYou', action: () => onNavigateToForYou?.() },
    projects: { label: 'Projects', icon: <FolderKanban className="w-3.5 h-3.5 text-violet-400" />, tab: 'Projects', action: () => onNavigateToProjects?.() },
    sprints: { label: 'Sprints', icon: <CalendarClock className="w-3.5 h-3.5 text-teal-400" />, tab: 'SprintsHub', action: () => onNavigateToSprints?.() },
    allTickets: { label: 'All tickets', icon: <Ticket className="w-3.5 h-3.5 text-yellow-400" />, tab: 'AllTickets', action: () => onNavigateToAllTickets?.() },
    roadmaps: { label: 'Roadmaps', icon: <Map className="w-3.5 h-3.5 text-orange-400" />, tab: 'Roadmaps', action: () => onNavigateToRoadmaps?.() },
    dashboards: { label: 'Dashboards', icon: <LayoutDashboard className="w-3.5 h-3.5 text-purple-400" />, action: () => onNavigateToDashboards?.() },
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

  const inSpaceView = !GLOBAL_TABS.includes(activeTab ?? '');
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

  // Collapsible blocks below the navigation; shown in the order chosen in the sidebar settings
  const sectionBlocks: Record<string, React.ReactNode> = {
    sec_spaces: (
      <>
      {/* ── Your Spaces Section ── */}
      {(
        <div className="py-2 border-b border-white/10">
          <SectionHeader
            title="Spaces"
            count={visibleSpaces.length}
            expanded={spacesExpanded}
            onToggle={() => setSpacesExpanded(!spacesExpanded)}
            onAdd={onCreateSpace}
            addTitle="New space"
          />

          <div className="py-1">
            <Collapsible open={spacesExpanded}>
              <div className="mt-0.5">
                {visibleSpaces.length === 0 ? (
                  <div className="px-3 py-1.5 text-[11px] text-white/30 italic">
                    No active spaces
                  </div>
                ) : (
                  visibleSpaces.map(space => (
                    <SpaceRow
                      key={space.id}
                      space={space}
                      active={inSpaceView && activeSpaceId === space.id}
                      starred={space.id ? starredIds.has(space.id) : false}
                      onSelect={handleSpaceClick}
                      onMenuOpen={() => setOpenMenuId(openMenuId === space.id ? null : space.id!)}
                      menuOpen={openMenuId === space.id}
                      onStar={e => toggleStar(space.id!, e)}
                      onDelete={e => handleDelete(space, e)}
                      onEdit={() => { onEditSpace?.(space); setOpenMenuId(null); }}
                      onToggleHide={e => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                        onToggleHideSpace?.(space.id!);
                      }}
                      onToggleArchive={e => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                        onToggleArchiveSpace?.(space.id!);
                      }}
                    />
                  ))
                )}
              </div>
            </Collapsible>
          </div>
        </div>
      )}

      </>
    ),
    sec_projects: (
      <>
      {/* ── Projects Section ── */}
      <div className="py-2 border-b border-white/10">
        <SectionHeader
          title="Projects"
          count={projects.length}
          expanded={projectsExpanded}
          onToggle={() => setProjectsExpanded(!projectsExpanded)}
          onAdd={onCreateProject}
          addTitle="New project"
        />
        <Collapsible open={projectsExpanded}>
          <div className="mt-0.5 px-2 space-y-0.5">
            {projects.length === 0 ? (
              <div className="px-2 py-1.5 text-[11px] text-white/30 italic">No projects yet</div>
            ) : (
              projects.map(p => {
                const space = spaces.find(sp => sp.id === p.spaceId);
                const active = activeProjectId === p.id && activeTab === 'Projects';
                return (
                  <div key={p.id} className="relative group" data-menu-root={`project:${p.id}`}>
                    <button
                      onClick={() => { setRowMenu(null); onSelectProject?.(p); }}
                      title={p.name}
                      data-active={active ? 'true' : undefined}
                      className={`w-full flex items-center gap-2.5 pl-2.5 pr-2.5 group-hover:pr-8 py-1.5 rounded-xl text-left text-xs transition-all duration-200 cursor-pointer ${
                        active ? 'text-white font-medium' : 'text-white/70 hover:text-white hover:bg-white/[0.06] hover:translate-x-0.5'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: space?.color || '#0052CC' }}
                      >
                        {p.key.slice(0, 2)}
                      </span>
                      <span className="truncate flex-1">{p.name}</span>
                    </button>
                    <RowMenuButton
                      open={rowMenu === `project:${p.id}`}
                      onToggle={() => setRowMenu(rowMenu === `project:${p.id}` ? null : `project:${p.id}`)}
                      label="Project actions"
                    >
                      <ContextItem icon={<FolderKanban className="w-3.5 h-3.5 text-violet-400" />} label="Open project" onClick={() => { setRowMenu(null); onSelectProject?.(p); }} />
                      <div className="border-t border-white/10 my-1" />
                      <ContextItem
                        icon={<Trash2 className="w-3.5 h-3.5" />}
                        label="Delete project"
                        danger
                        onClick={() => {
                          setRowMenu(null);
                          if (window.confirm(`Delete the project "${p.name}"? Its tickets stay in the ${space?.name ?? 'space'} space.`)) onDeleteProject?.(p);
                        }}
                      />
                    </RowMenuButton>
                  </div>
                );
              })
            )}
          </div>
        </Collapsible>
      </div>


      </>
    ),
    sec_sprints: (
      <>
      {/* ── Sprints Section ── */}
      <div className="py-2 border-b border-white/10">
        <SectionHeader
          title="Sprints"
          count={sprintKeys.length}
          expanded={sprintsExpanded}
          onToggle={() => setSprintsExpanded(!sprintsExpanded)}
          onAdd={onCreateSprint}
          addTitle="New sprint"
        />
        <Collapsible open={sprintsExpanded}>
          <div className="mt-0.5 px-2 space-y-0.5">
            {visibleSprintKeys.map(k => {
              const phase = sprintPhase(k);
              const c = sprintCounts[k] || { done: 0, total: 0 };
              const active = activeSprint === k && activeTab === 'SprintDetail';
              return (
                <div key={k} className="relative group" data-menu-root={`sprint:${k}`}>
                  <button
                    onClick={() => { setRowMenu(null); onSelectSprint?.(k); }}
                    title={sprintName(k)}
                    data-active={active ? 'true' : undefined}
                    className={`w-full flex items-center gap-2.5 pl-2.5 pr-2.5 group-hover:pr-8 py-1.5 rounded-xl text-left text-xs transition-all duration-200 cursor-pointer ${
                      active ? 'text-white font-medium' : 'text-white/70 hover:text-white hover:bg-white/[0.06] hover:translate-x-0.5'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        phase === 'active' ? 'bg-green-400' : phase === 'upcoming' ? 'bg-sky-400' : 'bg-white/30'
                      }`}
                    />
                    <span className="truncate flex-1">{sprintLabel(k)}</span>
                    {phase === 'active' && <span className="text-[9px] font-bold text-green-300">ACTIVE</span>}
                    <span className="text-[10px] text-white/40 tabular-nums">{c.done}/{c.total}</span>
                  </button>
                  <RowMenuButton
                    open={rowMenu === `sprint:${k}`}
                    onToggle={() => setRowMenu(rowMenu === `sprint:${k}` ? null : `sprint:${k}`)}
                    label="Sprint actions"
                  >
                    <ContextItem icon={<CalendarClock className="w-3.5 h-3.5 text-teal-400" />} label="Open sprint" onClick={() => { setRowMenu(null); onSelectSprint?.(k); }} />
                    <div className="border-t border-white/10 my-1" />
                    {canDeleteSprint(k) ? (
                      <ContextItem
                        icon={<Trash2 className="w-3.5 h-3.5" />}
                        label="Delete sprint"
                        danger
                        onClick={() => {
                          setRowMenu(null);
                          const msg = c.total > 0
                            ? `Delete the ${sprintName(k)}?\n\nIts ${c.total} ${c.total === 1 ? 'ticket moves' : 'tickets move'} to the current sprint (${c.done} done). Nothing else is deleted.`
                            : `Delete the ${sprintName(k)}? It has no tickets.`;
                          if (window.confirm(msg)) onDeleteSprint?.(k);
                        }}
                      />
                    ) : (
                      <div className="px-3 py-2 text-[11px] text-white/40 leading-snug max-w-[200px]">The current and next sprints always exist, so they cannot be deleted.</div>
                    )}
                  </RowMenuButton>
                </div>
              );
            })}
            {sprintKeys.length > visibleSprintKeys.length || showAllSprints ? (
              <button
                onClick={() => setShowAllSprints(v => !v)}
                className="w-full text-left px-2.5 py-1 text-[11px] text-white/40 hover:text-white/70 cursor-pointer"
              >
                {showAllSprints ? 'Show fewer' : `Show all ${sprintKeys.length} sprints`}
              </button>
            ) : null}
          </div>
        </Collapsible>
      </div>


      </>
    ),
    sec_hidden: (
      <>
      {/* ── Hidden Spaces Section ── */}
      <div className="py-2 border-b border-white/10">
        <div className="flex items-center justify-between px-3 py-1">
          <button
            onClick={() => setHiddenSpacesExpanded(!hiddenSpacesExpanded)}
            className="flex items-center gap-1.5 text-white/50 hover:text-white/80 text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer group"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${hiddenSpacesExpanded ? '' : '-rotate-90'}`} />
            <EyeOff className="w-3.5 h-3.5 text-amber-400" />
            <span>Hidden Spaces</span>
            <span className="bg-white/10 text-white/70 text-[9px] px-1.5 py-0.2 rounded-full font-bold ml-0.5">
              {hiddenSpaces.length}
            </span>
          </button>

          {/* Hidden Spaces Header 3-Dots Menu */}
          <div className="relative" ref={hiddenMenuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setHiddenHeaderMenuOpen(!hiddenHeaderMenuOpen);
              }}
              className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
              title="Hidden spaces options"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {hiddenHeaderMenuOpen && (
              <div
                className="absolute right-0 z-50 bg-[#1D2939] border border-white/10 rounded-lg shadow-xl py-1 min-w-[190px] animate-scale-in"
                style={{ top: '100%', marginTop: 2 }}
                onClick={(e) => e.stopPropagation()}
              >
                <ContextItem
                  icon={<Eye className="w-3.5 h-3.5 text-blue-400" />}
                  label="Unhide all spaces"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHiddenHeaderMenuOpen(false);
                    onUnhideAllSpaces?.();
                  }}
                />
                <ContextItem
                  icon={<Settings className="w-3.5 h-3.5 text-emerald-400" />}
                  label="Space settings"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHiddenHeaderMenuOpen(false);
                    const target = hiddenSpaces[0] || spaces[0];
                    if (target) onEditSpace?.(target);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {hiddenSpacesExpanded && (
          <div className="mt-0.5">
            {hiddenSpaces.length === 0 ? (
              <div className="px-3 py-1.5 text-[11px] text-white/30 italic">
                No hidden spaces
              </div>
            ) : (
              hiddenSpaces.map(space => (
                <SpaceRow
                  key={space.id}
                  space={space}
                  active={inSpaceView && activeSpaceId === space.id}
                  starred={space.id ? starredIds.has(space.id) : false}
                  isHidden
                  onSelect={handleSpaceClick}
                  onMenuOpen={() => setOpenMenuId(openMenuId === space.id ? null : space.id!)}
                  menuOpen={openMenuId === space.id}
                  onStar={e => toggleStar(space.id!, e)}
                  onDelete={e => handleDelete(space, e)}
                  onEdit={() => { onEditSpace?.(space); setOpenMenuId(null); }}
                  onToggleHide={e => {
                    e.stopPropagation();
                    setOpenMenuId(null);
                    onToggleHideSpace?.(space.id!);
                  }}
                  onToggleArchive={e => {
                    e.stopPropagation();
                    setOpenMenuId(null);
                    onToggleArchiveSpace?.(space.id!);
                  }}
                />
              ))
            )}
          </div>
        )}
      </div>


      </>
    ),
  };

  return (
    <aside
      className={`flex-shrink-0 p-2 pr-0 transition-[width] duration-300 ease-[cubic-bezier(.4,0,.2,1)] ${
        isCollapsed ? 'w-[68px]' : 'w-[272px]'
      }`}
    >
      <div
        ref={panelRef}
        className="relative h-full flex flex-col rounded-2xl bg-gradient-to-b from-[#1D2A45] via-[#18233B] to-[#121A2C] border border-white/[0.08] shadow-[0_10px_34px_rgba(0,0,0,0.38)] overflow-x-hidden overflow-y-auto lira-sidebar-scroll"
      >
      {/* Sliding highlight: glides to whichever item is currently active */}
      {!isCollapsed && (
        <div
          aria-hidden
          className={`absolute left-2 right-2 z-0 rounded-xl bg-gradient-to-r from-jira-blue/35 to-jira-blue/10 ring-1 ring-jira-blue/40 shadow-[inset_3px_0_0_rgb(var(--jira-blue))] pointer-events-none ${indicatorAnimated ? 'transition-[top,height,opacity] duration-300 ease-[cubic-bezier(.4,0,.2,1)]' : ''}`}
          style={{ top: indicator.top, height: indicator.height, opacity: indicator.visible ? 1 : 0 }}
        />
      )}
      {isCollapsed ? (
        <div key="rail" className="relative z-10 flex flex-col items-center w-full gap-2 py-3 animate-sidebar-in">
          {/* Expand button with smooth animated chevron */}
          <button
            onClick={expand}
            className="p-2 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer group"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <ChevronRight
              className={`w-4 h-4 transition-transform duration-300 ease-in-out group-hover:scale-110 group-hover:translate-x-0.5 ${
                isRotating ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </button>

          <div className="w-8 h-px bg-white/20 mx-auto" />

          {/* Dynamic Ordered Shortcuts */}
          {collapsedShortcuts.map(k => {
            const item = navItemDefs[k];
            if (!item) return null;
            return (
              <button
                key={k}
                onClick={item.action}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title={item.label}
              >
                {item.icon}
              </button>
            );
          })}

          <div className="w-8 h-px bg-white/20 mx-auto" />

          {/* + New space button */}
          <button
            onClick={onCreateSpace}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="New space"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Space icon buttons */}
          <div className="flex flex-col gap-1.5 w-full items-center overflow-y-auto flex-1 mt-1">
            {visibleSpaces.map(space => (
              <button
                key={space.id}
                onClick={() => handleSpaceClick(space.id!)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm transition-all cursor-pointer flex-shrink-0 ${
                  activeSpaceId === space.id
                    ? 'ring-2 ring-white/60 text-white shadow-xs'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
                style={activeSpaceId === space.id ? { backgroundColor: space.color } : {}}
                title={space.name}
              >
                {space.icon}
              </button>
            ))}

            {hiddenSpaces.length > 0 && (
              <>
                <div className="w-6 h-px bg-amber-400/40 my-1" title="Hidden spaces divider" />
                {hiddenSpaces.map(space => (
                  <button
                    key={space.id}
                    onClick={() => handleSpaceClick(space.id!)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm transition-all cursor-pointer flex-shrink-0 relative ${
                      activeSpaceId === space.id
                        ? 'ring-2 ring-amber-400 text-white shadow-xs'
                        : 'text-white/40 hover:text-white hover:bg-white/10'
                    }`}
                    style={activeSpaceId === space.id ? { backgroundColor: space.color } : {}}
                    title={`[Hidden] ${space.name}`}
                  >
                    {space.icon}
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400" />
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      ) : (
        <div key="full" className="relative z-10 w-full flex flex-col flex-1 min-h-0 animate-sidebar-in">
          {/* ── Navigation Section ── */}
          <div className="py-2.5 px-2 border-b border-white/10 space-y-0.5">
            <div className="px-3 mb-1 text-white/30 text-[10px] font-semibold uppercase tracking-wider flex items-center justify-between">
              <span>Navigation</span>
              <button
                onClick={collapse}
                className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer group"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
            <ChevronLeft
              className={`w-3.5 h-3.5 transition-transform duration-300 ease-in-out group-hover:scale-110 group-hover:-translate-x-0.5 ${
                isRotating ? '-rotate-180' : 'rotate-0'
              }`}
            />
          </button>
        </div>

        {visibleNavKeys.map(k => {
          const item = navItemDefs[k];
          if (!item) return null;
          const tab = item.tab;
          const sprintRowShown = sprintsExpanded && visibleSprintKeys.includes(activeSprint ?? '');
          const isActive =
            (k === 'sprints'
              // overview page, or a sprint page whose row isn't visible in the Sprints section
              ? activeTab === 'SprintsHub' || (activeTab === 'SprintDetail' && !sprintRowShown)
              : activeTab === tab) &&
            !(k === 'projects' && activeProjectId);
          return (
            <button
              key={k}
              onClick={item.action}
              data-active={isActive ? 'true' : undefined}
              className={`group w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all duration-200 cursor-pointer text-left ${
                isActive ? 'text-white font-medium' : 'text-white/70 hover:text-white hover:bg-white/[0.06] hover:translate-x-0.5'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Starred Section ── */}
      {starredIds.size > 0 && (
        <div className="py-2 border-b border-white/10">
          <div className="px-3 mb-1 text-white/30 text-[10px] font-semibold uppercase tracking-wider">
            Starred
          </div>
          {spaces.filter(s => s.id && starredIds.has(s.id)).map(space => (
            <SpaceRow
              key={space.id}
              space={space}
              active={inSpaceView && activeSpaceId === space.id}
              starred
              onSelect={handleSpaceClick}
              onMenuOpen={() => setOpenMenuId(openMenuId === space.id ? null : space.id!)}
              menuOpen={openMenuId === space.id}
              onStar={e => toggleStar(space.id!, e)}
              onDelete={e => handleDelete(space, e)}
              onEdit={() => { onEditSpace?.(space); setOpenMenuId(null); }}
              onToggleHide={e => {
                e.stopPropagation();
                setOpenMenuId(null);
                onToggleHideSpace?.(space.id!);
              }}
              onToggleArchive={e => {
                e.stopPropagation();
                setOpenMenuId(null);
                onToggleArchiveSpace?.(space.id!);
              }}
            />
          ))}
        </div>
      )}

      {visibleSectionKeys.map(k => <React.Fragment key={k}>{sectionBlocks[k]}</React.Fragment>)}

      {/* ── Archived Spaces Section ── */}
      {archivedSpaces.length > 0 && (
        <div className="py-2 border-b border-white/10">
          <div className="flex items-center justify-between px-3 py-1">
            <button
              onClick={() => setArchivedSpacesExpanded(!archivedSpacesExpanded)}
              className="flex items-center gap-1.5 text-white/50 hover:text-white/80 text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer group"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${archivedSpacesExpanded ? '' : '-rotate-90'}`} />
              <Archive className="w-3.5 h-3.5 text-slate-400" />
              <span>Archived Spaces</span>
              <span className="bg-white/10 text-white/70 text-[9px] px-1.5 py-0.2 rounded-full font-bold ml-0.5">
                {archivedSpaces.length}
              </span>
            </button>
          </div>

          {archivedSpacesExpanded && (
            <div className="mt-0.5">
              {archivedSpaces.map(space => (
                <SpaceRow
                  key={space.id}
                  space={space}
                  active={inSpaceView && activeSpaceId === space.id}
                  starred={space.id ? starredIds.has(space.id) : false}
                  isArchived
                  onSelect={handleSpaceClick}
                  onMenuOpen={() => setOpenMenuId(openMenuId === space.id ? null : space.id!)}
                  menuOpen={openMenuId === space.id}
                  onStar={e => toggleStar(space.id!, e)}
                  onDelete={e => handleDelete(space, e)}
                  onEdit={() => { onEditSpace?.(space); setOpenMenuId(null); }}
                  onToggleHide={e => {
                    e.stopPropagation();
                    setOpenMenuId(null);
                    onToggleHideSpace?.(space.id!);
                  }}
                  onToggleArchive={e => {
                    e.stopPropagation();
                    setOpenMenuId(null);
                    onToggleArchiveSpace?.(space.id!);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Customise sidebar footer ── */}
      <div className="relative z-10 border-t border-white/10 px-2 py-2 mt-auto">
        <button
          onClick={() => setShowCustomiseModal(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/50 hover:text-white hover:bg-white/[0.06] transition-all duration-200 cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5" /> Customise sidebar
        </button>
      </div>
    </div>
  )}

  <CustomiseSidebarModal
    isOpen={showCustomiseModal}
    onClose={() => setShowCustomiseModal(false)}
    onSave={handleSaveConfig}
  />
  </div>
</aside>
  );
};

// ── Space row with context menu ──
interface SpaceRowProps {
  space: Space;
  active: boolean;
  starred: boolean;
  isHidden?: boolean;
  isArchived?: boolean;
  onSelect: (id: number) => void;
  onMenuOpen: () => void;
  menuOpen: boolean;
  onStar: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onEdit: () => void;
  onToggleHide?: (e: React.MouseEvent) => void;
  onToggleArchive?: (e: React.MouseEvent) => void;
}

const SpaceRow: React.FC<SpaceRowProps> = ({
  space, active, starred, isHidden, isArchived, onSelect, onMenuOpen, menuOpen, onStar, onDelete, onEdit, onToggleHide, onToggleArchive,
}) => (
  <div className="relative group px-2" data-menu-root={`space:${space.id}`}>
    <button
      onClick={() => onSelect(space.id!)}
      data-active={active ? 'true' : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 cursor-pointer ${
        active
          ? 'text-white font-medium'
          : 'text-white/60 hover:text-white hover:bg-white/[0.06] hover:translate-x-0.5'
      }`}
    >
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center text-xs flex-shrink-0"
        style={{ backgroundColor: space.color + '33', color: space.color }}
      >
        {space.icon}
      </div>
      <span className={`truncate font-medium flex-1 text-left ${isHidden ? 'text-white/50' : isArchived ? 'text-white/40 italic' : ''}`}>
        {space.name}
      </span>
      {isHidden && (
        <span title="Hidden space" className="flex items-center text-amber-400/80 mr-1 flex-shrink-0">
          <EyeOff className="w-3 h-3" />
        </span>
      )}
      {isArchived && (
        <span title="Archived space" className="flex items-center text-slate-400/80 mr-1 flex-shrink-0">
          <Archive className="w-3 h-3" />
        </span>
      )}
      {starred && <Star className="w-3 h-3 text-yellow-400 flex-shrink-0" />}

      {/* Context menu trigger */}
      <button
        onClick={e => { e.stopPropagation(); onMenuOpen(); }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/20 text-white/50 hover:text-white transition-all flex-shrink-0 cursor-pointer"
        title="Space actions"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
    </button>

    {/* Context menu */}
    {menuOpen && (
      <div
        className="absolute left-4 z-50 bg-[#1D2939] border border-white/10 rounded-lg shadow-xl py-1 min-w-[220px] animate-scale-in"
        style={{ top: '100%', marginTop: 2 }}
        onClick={e => e.stopPropagation()}
      >
        <ContextItem icon={<Star className="w-3.5 h-3.5" />} label={starred ? 'Remove from starred' : 'Add to starred'} onClick={onStar} />
        <ContextItem icon={<Edit3 className="w-3.5 h-3.5" />} label="Space settings" onClick={onEdit} />
        <ContextItem icon={<Palette className="w-3.5 h-3.5" />} label="Set space background" onClick={() => {}} />
        <ContextItem icon={<Users className="w-3.5 h-3.5" />} label="Add people" onClick={() => {}} />
        <ContextItem icon={<Folder className="w-3.5 h-3.5" />} label="Save as template" onClick={() => {}} />
        <div className="border-t border-white/10 my-1" />
        {onToggleHide && (
          <ContextItem
            icon={isHidden ? <Eye className="w-3.5 h-3.5 text-blue-400" /> : <EyeOff className="w-3.5 h-3.5 text-amber-400" />}
            label={isHidden ? 'Unhide space' : 'Hide space'}
            onClick={onToggleHide}
          />
        )}
        {onToggleArchive && (
          <ContextItem
            icon={isArchived ? <ArchiveRestore className="w-3.5 h-3.5 text-emerald-400" /> : <Archive className="w-3.5 h-3.5 text-slate-400" />}
            label={isArchived ? 'Unarchive space' : 'Archive space'}
            onClick={onToggleArchive}
          />
        )}
        <ContextItem icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete space" onClick={onDelete} danger />
        <div className="px-3 py-2 border-t border-white/10 mt-1">
          <div className="flex items-center gap-2 text-[10px] text-white/30">
            <img src="/lira-logo.png" alt="Lira" className="w-4 h-4 object-contain rounded" />
            <span>Business space · Team-managed</span>
          </div>
        </div>
      </div>
    )}
  </div>
);

/** The "..." button that appears when you hover a project or sprint row, with its dropdown. */
const RowMenuButton: React.FC<{ open: boolean; onToggle: () => void; label: string; children: React.ReactNode }> = ({ open, onToggle, label, children }) => (
  <>
    <button
      onClick={e => { e.stopPropagation(); onToggle(); }}
      className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/20 text-white/50 hover:text-white transition-all cursor-pointer ${open ? 'opacity-100 bg-white/15 text-white' : 'opacity-0 group-hover:opacity-100'}`}
      title={label}
      aria-label={label}
      aria-expanded={open}
    >
      <MoreHorizontal className="w-3.5 h-3.5" />
    </button>
    {open && (
      <div className="absolute right-1 z-50 bg-[#1D2939] border border-white/10 rounded-lg shadow-xl py-1 min-w-[190px] animate-scale-in" style={{ top: '100%', marginTop: 2 }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    )}
  </>
);

const ContextItem: React.FC<{ icon: React.ReactNode; label: string; onClick: (e: React.MouseEvent) => void; danger?: boolean }> = ({
  icon, label, onClick, danger,
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors cursor-pointer ${
      danger ? 'text-red-400 hover:bg-red-900/20' : 'text-white/70 hover:bg-white/10 hover:text-white'
    }`}
  >
    <span>{icon}</span>
    {label}
  </button>
);

const GLOBAL_TABS = ['ForYou', 'Filters', 'Projects', 'SprintsHub', 'SprintDetail', 'AllTickets', 'Roadmaps'];

function prevOf(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Expanded/collapsed state of a sidebar section, remembered between sessions. */
function useSectionState(name: string, initial: boolean): [boolean, (v: boolean) => void] {
  const key = `lira_sidebar_section_${name}`;
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? initial : v === 'true';
    } catch {
      return initial;
    }
  });
  const set = (v: boolean) => {
    setOpen(v);
    try { localStorage.setItem(key, String(v)); } catch { /* storage unavailable */ }
  };
  return [open, set];
}

/** Collapsible section title with an item count and a "+" action — used for Spaces, Projects and Sprints. */
const SectionHeader: React.FC<{
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  addTitle: string;
}> = ({ title, count, expanded, onToggle, onAdd, addTitle }) => (
  <div className="flex items-center justify-between px-3 py-1">
    <button
      onClick={onToggle}
      aria-expanded={expanded}
      title={expanded ? `Minimise ${title}` : `Expand ${title}`}
      className="flex items-center gap-1.5 text-white/50 hover:text-white/80 text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
    >
      <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? '' : '-rotate-90'}`} />
      <span>{title}</span>
      <span className="bg-white/10 text-white/70 text-[9px] px-1.5 py-0.5 rounded-full font-bold">{count}</span>
    </button>
    {onAdd && (
      <button
        onClick={onAdd}
        className="p-1 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
        title={addTitle}
        aria-label={addTitle}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

/** Smoothly animates a section open/closed (height + fade) without needing a fixed height. */
const Collapsible: React.FC<{ open: boolean; children: React.ReactNode }> = ({ open, children }) => (
  <div
    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(.4,0,.2,1)] ${
      open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
    }`}
    aria-hidden={!open}
  >
    <div className="overflow-hidden min-h-0">{children}</div>
  </div>
);
