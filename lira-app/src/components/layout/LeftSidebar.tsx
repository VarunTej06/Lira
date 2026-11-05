import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, Plus,
  Users, Folder, Settings,
  ChevronDown, MoreHorizontal, Star, Trash2, Archive,
  Edit3, Palette, Clock, Filter, LayoutDashboard,
  User, LayoutGrid, Map, Calendar, Database, Target,
  List, FolderKanban, Eye, EyeOff, ArchiveRestore
} from 'lucide-react';
import type { Space } from '../../types/space';
import { deleteSpace } from '../../hooks/useSpaces';
import { CustomiseSidebarModal, DEFAULT_SIDEBAR_CONFIG, type SidebarConfig } from './CustomiseSidebarModal';

interface LeftSidebarProps {
  spaces: Space[];
  activeSpaceId: number | undefined;
  onSpaceSelect: (id: number) => void;
  onCreateSpace: () => void;
  onEditSpace?: (space: Space) => void;
  onNavigateToFilters?: () => void;
  onNavigateToDashboards?: () => void;
  onNavigateToTeams?: () => void;
  onNavigateToList?: () => void;
  onNavigateToCalendar?: () => void;
  onNavigateToProjects?: () => void;
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
  onNavigateToFilters,
  onNavigateToDashboards,
  onNavigateToTeams,
  onNavigateToList,
  onNavigateToCalendar,
  onNavigateToProjects,
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
  const [spacesExpanded, setSpacesExpanded] = useState(true);
  const [hiddenSpacesExpanded, setHiddenSpacesExpanded] = useState(true);
  const [archivedSpacesExpanded, setArchivedSpacesExpanded] = useState(false);
  const [hiddenHeaderMenuOpen, setHiddenHeaderMenuOpen] = useState(false);
  const hiddenMenuRef = useRef<HTMLDivElement>(null);

  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
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

  // Sidebar dynamic customization preferences
  const [sidebarConfig, setSidebarConfig] = useState<SidebarConfig>(() => {
    try {
      const saved = localStorage.getItem('lira_sidebar_customization');
      return saved ? { ...DEFAULT_SIDEBAR_CONFIG, ...JSON.parse(saved) } : DEFAULT_SIDEBAR_CONFIG;
    } catch {
      return DEFAULT_SIDEBAR_CONFIG;
    }
  });

  // Pinned Views persistence (lira_sidebar_pinned)
  const [pinnedKeys, setPinnedKeys] = useState<string[]>(() => {
    try {
      const savedPinned = localStorage.getItem('lira_sidebar_pinned');
      if (savedPinned) {
        const parsed = JSON.parse(savedPinned);
        if (Array.isArray(parsed)) return parsed;
      }
      const savedConfig = localStorage.getItem('lira_sidebar_customization');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        const vis = parsed.visibility || parsed;
        const order = parsed.navOrder || DEFAULT_SIDEBAR_CONFIG.navOrder;
        const active = order.filter(
          (k: string) => k !== 'forYou' && k !== 'starred' && k !== 'spaces' && vis[k] === true
        );
        localStorage.setItem('lira_sidebar_pinned', JSON.stringify(active));
        return active;
      }
    } catch {}
    const defaultPinned = ['list', 'calendar'];
    try {
      localStorage.setItem('lira_sidebar_pinned', JSON.stringify(defaultPinned));
    } catch {}
    return defaultPinned;
  });

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
    onSpaceSelect(id);
    if (activeTab === 'Filters' || activeTab === 'Projects') {
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
    const pinned = (cfg.navOrder || DEFAULT_SIDEBAR_CONFIG.navOrder).filter(
      k => k !== 'forYou' && k !== 'starred' && k !== 'spaces' && cfg.visibility?.[k] === true
    );
    setPinnedKeys(pinned);
    localStorage.setItem('lira_sidebar_pinned', JSON.stringify(pinned));
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

  // Item definitions for ordered rendering
  const navItemDefs: Record<string, { label: string; icon: React.ReactNode; action: () => void }> = {
    forYou: { label: 'For you', icon: <User className="w-3.5 h-3.5 text-blue-400" />, action: () => handleSpaceClick(spaces[0]?.id || 1) },
    projects: { label: 'Projects', icon: <FolderKanban className="w-3.5 h-3.5 text-violet-400" />, action: () => onNavigateToProjects?.() },
    recent: { label: 'Recent', icon: <Clock className="w-3.5 h-3.5 text-amber-400" />, action: () => handleSpaceClick(spaces[0]?.id || 1) },
    filters: { label: 'Filters', icon: <Filter className="w-3.5 h-3.5 text-sky-400" />, action: () => onNavigateToFilters?.() },
    dashboards: { label: 'Dashboards', icon: <LayoutDashboard className="w-3.5 h-3.5 text-purple-400" />, action: () => onNavigateToDashboards?.() },
    teams: { label: 'Teams & Capacity', icon: <Users className="w-3.5 h-3.5 text-emerald-400" />, action: () => onNavigateToTeams?.() },
    apps: { label: 'Apps', icon: <LayoutGrid className="w-3.5 h-3.5 text-pink-400" />, action: () => setShowCustomiseModal(true) },
    roadmaps: { label: 'Roadmaps', icon: <Map className="w-3.5 h-3.5 text-orange-400" />, action: () => onNavigateToDashboards?.() },
    plans: { label: 'Plans', icon: <Calendar className="w-3.5 h-3.5 text-indigo-400" />, action: () => onNavigateToDashboards?.() },
    assets: { label: 'Assets', icon: <Database className="w-3.5 h-3.5 text-cyan-400" />, action: () => onNavigateToTeams?.() },
    goals: { label: 'Goals', icon: <Target className="w-3.5 h-3.5 text-rose-400" />, action: () => onNavigateToDashboards?.() },
    list: { label: 'List', icon: <List className="w-3.5 h-3.5 text-blue-400" />, action: () => onNavigateToList?.() },
    calendar: { label: 'Calendar', icon: <Calendar className="w-3.5 h-3.5 text-indigo-400" />, action: () => onNavigateToCalendar?.() },
  };

  const isKeyVisible = (key: string): boolean => {
    if (sidebarConfig.visibility && typeof sidebarConfig.visibility[key] === 'boolean') {
      return sidebarConfig.visibility[key];
    }
    const legacyVal = (sidebarConfig as unknown as Record<string, boolean>)[key];
    if (typeof legacyVal === 'boolean') return legacyVal;
    return key === 'forYou' || key === 'list' || key === 'calendar' || key === 'projects';
  };

  const visibleAppKeys = (sidebarConfig.appsOrder || ['assets', 'teams', 'goals'])
    .filter(k => isKeyVisible(k) && k !== 'projects');

  const isStarredVisible = isKeyVisible('starred');
  const isSpacesVisible = isKeyVisible('spaces');
  const collapsedShortcuts = ['forYou', 'projects', ...pinnedKeys.filter(k => k !== 'projects')].slice(0, 4);

  const visibleSpaces = spaces.filter(
    s => s.id && !hiddenSpaceIds.includes(s.id) && !archivedSpaceIds.includes(s.id)
  );
  const hiddenSpaces = spaces.filter(
    s => s.id && hiddenSpaceIds.includes(s.id)
  );
  const archivedSpaces = spaces.filter(
    s => s.id && archivedSpaceIds.includes(s.id)
  );

  return (
    <aside
      className={`bg-[#1A2332] flex flex-col flex-shrink-0 border-r border-black/20 transition-all duration-300 overflow-x-hidden ${
        isCollapsed ? 'w-[56px] items-center py-3 gap-2 overflow-y-auto' : 'w-64 overflow-y-auto'
      }`}
    >
      {isCollapsed ? (
        <div className="flex flex-col items-center w-full gap-2">
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
        <div className="w-64 flex flex-col flex-1 min-h-0">
          {/* ── Navigation Section ── */}
          <div className="py-2.5 border-b border-white/10 space-y-0.5">
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

        {navItemDefs.forYou && (
          <button
            onClick={navItemDefs.forYou.action}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
          >
            <span>{navItemDefs.forYou.icon}</span>
            <span>{navItemDefs.forYou.label}</span>
          </button>
        )}

        {navItemDefs.projects && (
          <button
            onClick={navItemDefs.projects.action}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
          >
            <span>{navItemDefs.projects.icon}</span>
            <span>{navItemDefs.projects.label}</span>
          </button>
        )}
      </div>

      {/* ── Pinned Views Section ── */}
      {pinnedKeys.filter(k => k !== 'projects').length > 0 && (
        <div className="py-2.5 border-b border-white/10 space-y-0.5">
          <div className="px-3 mb-1 text-white/30 text-[10px] font-semibold uppercase tracking-wider">
            Pinned Views
          </div>
          {pinnedKeys.filter(k => k !== 'projects').map(key => {
            const item = navItemDefs[key];
            if (!item) return null;
            return (
              <button
                key={key}
                onClick={item.action}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── App Shortcuts Section ── */}
      {visibleAppKeys.length > 0 && (
        <div className="py-2.5 border-b border-white/10 space-y-0.5">
          <div className="px-3 mb-1 text-white/30 text-[10px] font-semibold uppercase tracking-wider">
            App Shortcuts
          </div>
          {visibleAppKeys.map(key => {
            const item = navItemDefs[key];
            if (!item) return null;
            return (
              <button
                key={key}
                onClick={item.action}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Starred Section ── */}
      {isStarredVisible && starredIds.size > 0 && (
        <div className="py-2 border-b border-white/10">
          <div className="px-3 mb-1 text-white/30 text-[10px] font-semibold uppercase tracking-wider">
            Starred
          </div>
          {spaces.filter(s => s.id && starredIds.has(s.id)).map(space => (
            <SpaceRow
              key={space.id}
              space={space}
              active={activeSpaceId === space.id}
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

      {/* ── Your Spaces Section ── */}
      {isSpacesVisible && (
        <div className="py-2 border-b border-white/10">
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <span className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">
              Your Spaces
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={onCreateSpace}
                className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
                title="New space"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Spaces list expand/collapse toggle */}
          <div className="py-1">
            <button
              onClick={() => setSpacesExpanded(!spacesExpanded)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-white/40 text-[10px] font-semibold uppercase tracking-wider hover:text-white/60 transition-colors cursor-pointer"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${spacesExpanded ? '' : '-rotate-90'}`} />
              <span>{spacesExpanded ? 'Hide' : 'Show'}</span>
              <span className="bg-white/10 text-white/60 text-[9px] px-1.5 py-0.2 rounded-full font-bold ml-auto">
                {visibleSpaces.length}
              </span>
            </button>

            {spacesExpanded && (
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
                      active={activeSpaceId === space.id}
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
            )}
          </div>
        </div>
      )}

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
                  active={activeSpaceId === space.id}
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
                  active={activeSpaceId === space.id}
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
      <div className="border-t border-white/10 px-3 py-3 mt-auto">
        <button
          onClick={() => setShowCustomiseModal(true)}
          className="w-full flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors cursor-pointer"
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
  <div className="relative group">
    <button
      onClick={() => onSelect(space.id!)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all cursor-pointer ${
        active
          ? 'bg-[#0052CC]/30 text-white border-r-2 border-[#0052CC]'
          : 'text-white/60 hover:text-white hover:bg-white/5'
      }`}
    >
      <div
        className="w-6 h-6 rounded flex items-center justify-center text-xs flex-shrink-0"
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
