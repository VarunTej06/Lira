import React, { useState } from 'react';
import {
  ChevronLeft, ChevronRight, Plus,
  Users, Folder, Settings,
  ChevronDown, MoreHorizontal, Star, Trash2, Archive,
  Edit3, Palette, Clock, Filter, LayoutDashboard,
  User, LayoutGrid
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
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem('lira_sidebar_collapsed') === 'true'
  );
  const [spacesExpanded, setSpacesExpanded] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [starredIds, setStarredIds] = useState<Set<number>>(new Set());
  const [showCustomiseModal, setShowCustomiseModal] = useState(false);

  // Sidebar dynamic customization preferences
  const [sidebarConfig, setSidebarConfig] = useState<SidebarConfig>(() => {
    try {
      const saved = localStorage.getItem('lira_sidebar_customization');
      return saved ? { ...DEFAULT_SIDEBAR_CONFIG, ...JSON.parse(saved) } : DEFAULT_SIDEBAR_CONFIG;
    } catch {
      return DEFAULT_SIDEBAR_CONFIG;
    }
  });

  const collapse = () => {
    localStorage.setItem('lira_sidebar_collapsed', 'true');
    setCollapsed(true);
  };

  const expand = () => {
    localStorage.setItem('lira_sidebar_collapsed', 'false');
    setCollapsed(false);
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

  if (collapsed) {
    return (
      <aside className="w-12 bg-[#1A2332] flex flex-col items-center py-3 gap-2 flex-shrink-0 border-r border-black/20 transition-all duration-200">
        {/* Expand button */}
        <button
          onClick={expand}
          className="p-2 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
          title="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-white/20 mx-auto" />

        {/* Shortcuts if enabled */}
        {sidebarConfig.filters && (
          <button
            onClick={onNavigateToFilters}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Filters"
          >
            <Filter className="w-4 h-4" />
          </button>
        )}

        {sidebarConfig.dashboards && (
          <button
            onClick={onNavigateToDashboards}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Dashboards"
          >
            <LayoutDashboard className="w-4 h-4" />
          </button>
        )}

        {/* + New space button */}
        <button
          onClick={onCreateSpace}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="New space"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Space icon buttons */}
        {spaces.map(space => (
          <button
            key={space.id}
            onClick={() => onSpaceSelect(space.id!)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all cursor-pointer ${
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
      </aside>
    );
  }

  // Check if any top navigation item is visible
  const hasCustomNavItems =
    sidebarConfig.forYou ||
    sidebarConfig.recent ||
    sidebarConfig.filters ||
    sidebarConfig.dashboards ||
    sidebarConfig.teams ||
    sidebarConfig.apps;

  return (
    <aside className="w-64 bg-[#1A2332] flex flex-col flex-shrink-0 border-r border-black/20 overflow-y-auto transition-all duration-200">
      {/* ── Customised Navigation Items Section ── */}
      {hasCustomNavItems && (
        <div className="py-2.5 border-b border-white/10 space-y-0.5">
          <div className="px-3 mb-1 text-white/30 text-[10px] font-semibold uppercase tracking-wider">
            Navigation
          </div>

          {sidebarConfig.forYou && (
            <button
              onClick={() => onSpaceSelect(spaces[0]?.id || 1)}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
            >
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span>For you</span>
            </button>
          )}

          {sidebarConfig.recent && (
            <button
              onClick={() => onSpaceSelect(spaces[0]?.id || 1)}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Recent</span>
            </button>
          )}

          {sidebarConfig.filters && (
            <button
              onClick={onNavigateToFilters}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
            >
              <Filter className="w-3.5 h-3.5 text-sky-400" />
              <span>Filters</span>
            </button>
          )}

          {sidebarConfig.dashboards && (
            <button
              onClick={onNavigateToDashboards}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-purple-400" />
              <span>Dashboards</span>
            </button>
          )}

          {sidebarConfig.teams && (
            <button
              onClick={onNavigateToTeams}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
            >
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Teams &amp; Capacity</span>
            </button>
          )}

          {sidebarConfig.apps && (
            <button
              onClick={() => setShowCustomiseModal(true)}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-pink-400" />
              <span>Apps</span>
            </button>
          )}
        </div>
      )}

      {/* ── Starred Section ── */}
      {sidebarConfig.starred && starredIds.size > 0 && (
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
              onSelect={onSpaceSelect}
              onMenuOpen={() => setOpenMenuId(openMenuId === space.id ? null : space.id!)}
              menuOpen={openMenuId === space.id}
              onStar={e => toggleStar(space.id!, e)}
              onDelete={e => handleDelete(space, e)}
              onEdit={() => { onEditSpace?.(space); setOpenMenuId(null); }}
            />
          ))}
        </div>
      )}

      {/* ── Your Spaces Section ── */}
      {sidebarConfig.spaces && (
        <>
          <div className="flex items-center justify-between px-3 pt-4 pb-1">
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
              <button
                onClick={collapse}
                className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
                title="Collapse sidebar"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Spaces list expand/collapse toggle */}
          <div className="py-1 flex-1">
            <button
              onClick={() => setSpacesExpanded(!spacesExpanded)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-white/40 text-[10px] font-semibold uppercase tracking-wider hover:text-white/60 transition-colors cursor-pointer"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${spacesExpanded ? '' : '-rotate-90'}`} />
              {spacesExpanded ? 'Hide' : 'Show'}
            </button>

            {spacesExpanded && (
              <div className="mt-0.5">
                {spaces.map(space => (
                  <SpaceRow
                    key={space.id}
                    space={space}
                    active={activeSpaceId === space.id}
                    starred={space.id ? starredIds.has(space.id) : false}
                    onSelect={onSpaceSelect}
                    onMenuOpen={() => setOpenMenuId(openMenuId === space.id ? null : space.id!)}
                    menuOpen={openMenuId === space.id}
                    onStar={e => toggleStar(space.id!, e)}
                    onDelete={e => handleDelete(space, e)}
                    onEdit={() => { onEditSpace?.(space); setOpenMenuId(null); }}
                  />
                ))}
              </div>
            )}
          </div>
        </>
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

      <CustomiseSidebarModal
        isOpen={showCustomiseModal}
        onClose={() => setShowCustomiseModal(false)}
        onSave={cfg => setSidebarConfig(cfg)}
      />
    </aside>
  );
};

// ── Space row with context menu ──
interface SpaceRowProps {
  space: Space;
  active: boolean;
  starred: boolean;
  onSelect: (id: number) => void;
  onMenuOpen: () => void;
  menuOpen: boolean;
  onStar: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onEdit: () => void;
}

const SpaceRow: React.FC<SpaceRowProps> = ({
  space, active, starred, onSelect, onMenuOpen, menuOpen, onStar, onDelete, onEdit,
}) => (
  <div className="relative group">
    <button
      onClick={() => onSelect(space.id!)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all cursor-pointer ${
        active ? 'bg-[#0052CC]/30 text-white border-r-2 border-[#0052CC]' : 'text-white/60 hover:text-white hover:bg-white/5'
      }`}
    >
      <div
        className="w-6 h-6 rounded flex items-center justify-center text-xs flex-shrink-0"
        style={{ backgroundColor: space.color + '33', color: space.color }}
      >
        {space.icon}
      </div>
      <span className="truncate font-medium flex-1 text-left">{space.name}</span>
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
        <ContextItem icon={<Archive className="w-3.5 h-3.5" />} label="Archive space" onClick={() => {}} />
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
