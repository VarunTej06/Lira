import { LiraLogo } from '../../common/LiraLogo';
import { SpaceIcon } from '../../common/SpaceIcon';
import { spaceLink } from '../../../utils/links';
import { motion } from '../../common/motionPresets';
import { menuPop } from '../../common/motionPresets';
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Users, Folder, ChevronDown, MoreHorizontal, Star, Trash2, Archive, Edit3, Palette, Eye, EyeOff, ArchiveRestore } from 'lucide-react';
import type { Space } from '../../../types/space';
import { placeMenu } from '../../common/filterPlacement';

/** Building blocks of the sidebar: space rows, floating "..." menus, collapsible section headers. */

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

/** The class of a space name: dimmer when hidden, dim italic when archived. */
const nameClass = (isHidden?: boolean, isArchived?: boolean) => (isHidden ? 'text-white/50' : isArchived ? 'text-white/40 italic' : '');

/** The row button: icon, name and the hidden, archived and starred marks. */
function SpaceButton({ space, active, starred, isHidden, isArchived, onSelect }: Pick<SpaceRowProps, 'space' | 'active' | 'starred' | 'isHidden' | 'isArchived' | 'onSelect'>) {
  return (
    <button
      onClick={() => onSelect(space.id!)} {...spaceLink(space.key)}
      data-active={active ? 'true' : undefined}
      className={`w-full flex items-center gap-3 pl-3 pr-3 group-hover:pr-9 py-2 rounded-xl text-sm transition-all duration-200 cursor-pointer ${
        active ? 'text-white font-medium' : 'text-white/60 hover:text-white hover:bg-white/[0.06] hover:translate-x-0.5'
      }`}
    >
      <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs flex-shrink-0" style={{ backgroundColor: space.color + '55' }}>
        <SpaceIcon icon={space.icon} className="w-3.5 h-3.5 text-white" />
      </div>
      <span className={`truncate font-medium flex-1 text-left ${nameClass(isHidden, isArchived)}`}>{space.name}</span>
      {isHidden && <span title="Hidden space" className="flex items-center text-amber-400/80 mr-1 flex-shrink-0"><EyeOff className="w-3 h-3" /></span>}
      {isArchived && <span title="Archived space" className="flex items-center text-slate-400/80 mr-1 flex-shrink-0"><Archive className="w-3 h-3" /></span>}
      {starred && <Star className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
    </button>
  );
}

/** What a space's "..." menu offers. Hide and archive show only when the caller supports them. */
function SpaceMenu({ space, starred, isHidden, isArchived, onMenuOpen, onStar, onDelete, onEdit, onToggleHide, onToggleArchive }: Omit<SpaceRowProps, 'active' | 'onSelect' | 'menuOpen'>) {
  return (
    <FloatingMenu menuRoot={`space:${space.id}`} onClose={onMenuOpen} className="min-w-[220px]">
      <ContextItem icon={<Star className="w-3.5 h-3.5" />} label={starred ? 'Remove from starred' : 'Add to starred'} onClick={onStar} />
      <ContextItem icon={<Edit3 className="w-3.5 h-3.5" />} label="Space settings" onClick={onEdit} />
      <ContextItem icon={<Palette className="w-3.5 h-3.5" />} label="Set space background" onClick={() => {}} />
      <ContextItem icon={<Users className="w-3.5 h-3.5" />} label="Add people" onClick={() => {}} />
      <ContextItem icon={<Folder className="w-3.5 h-3.5" />} label="Save as template" onClick={() => {}} />
      <div className="border-t border-white/10 my-1" />
      {onToggleHide && (
        <ContextItem
          icon={isHidden ? <Eye className="w-3.5 h-3.5 text-lira-nav-accent" /> : <EyeOff className="w-3.5 h-3.5 text-amber-400" />}
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
        <div className="flex items-center gap-2 text-3xs text-white/30">
          <LiraLogo className="w-4 h-4" motion="none" />
          <span>Business space · Team-managed</span>
        </div>
      </div>
    </FloatingMenu>
  );
}

export const SpaceRow: React.FC<SpaceRowProps> = ({ active, menuOpen, onSelect, ...rest }) => (
  <div className="relative group px-2" data-menu-root={`space:${rest.space.id}`}>
    <SpaceButton space={rest.space} active={active} starred={rest.starred} isHidden={rest.isHidden} isArchived={rest.isArchived} onSelect={onSelect} />

    {/* Context menu trigger (a sibling of the row button: a button inside a button is not valid HTML) */}
    <button
      data-menu-trigger
      onClick={e => { e.stopPropagation(); rest.onMenuOpen(); }}
      className={`absolute right-4 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/20 text-white/50 hover:text-white transition-all cursor-pointer ${menuOpen ? 'opacity-100 bg-white/15 text-white' : 'opacity-0 group-hover:opacity-100'}`}
      title="Space actions"
      aria-label="Space actions"
      aria-expanded={menuOpen}
    >
      <MoreHorizontal className="w-3.5 h-3.5" />
    </button>

    {menuOpen && <SpaceMenu {...rest} />}
  </div>
);

/**
 * A dropdown drawn in a floating layer above everything (not inside the sidebar, whose scrolling panel would clip it).
 * It opens under its "..." button, right-aligned to it, flips above the button when there is no room below, and always
 * stays fully inside the window. It closes when the sidebar or the page scrolls or the window is resized.
 */
export const FloatingMenu: React.FC<{ menuRoot: string; onClose: () => void; className?: string; children: React.ReactNode }> = ({ menuRoot, onClose, className = '', children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const menu = ref.current;
    const anchor = document.querySelector<HTMLElement>(`[data-menu-root="${menuRoot}"]:not([data-floating]) [data-menu-trigger]`);
    if (!menu || !anchor) return;
    setPos(placeMenu(anchor.getBoundingClientRect(), { width: menu.offsetWidth, height: menu.offsetHeight }, { width: window.innerWidth, height: window.innerHeight })); // offset sizes ignore the pop-in scale
  }, [menuRoot, children]);

  useEffect(() => {
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', onClose);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', onClose); };
  }, [onClose]);

  return createPortal(
    <motion.div
      ref={ref}
      {...menuPop}
      data-menu-root={menuRoot}
      data-floating
      className={`bg-lira-nav border border-white/10 rounded-lg shadow-2xl py-1 max-h-[calc(100vh-16px)] overflow-y-auto ${className}`}
      style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, zIndex: 1000, visibility: pos ? 'visible' : 'hidden', transformOrigin: 'top right' }}
      onClick={e => e.stopPropagation()}
    >
      {children}
    </motion.div>,
    document.body,
  );
};

/** The "..." button that appears when you hover a project or sprint row, with its dropdown. */
export const RowMenuButton: React.FC<{ open: boolean; onToggle: () => void; label: string; menuKey: string; children: React.ReactNode }> = ({ open, onToggle, label, menuKey, children }) => (
  <>
    <button
      data-menu-trigger
      onClick={e => { e.stopPropagation(); onToggle(); }}
      className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/20 text-white/50 hover:text-white transition-all cursor-pointer ${open ? 'opacity-100 bg-white/15 text-white' : 'opacity-0 group-hover:opacity-100'}`}
      title={label}
      aria-label={label}
      aria-expanded={open}
    >
      <MoreHorizontal className="w-3.5 h-3.5" />
    </button>
    {open && (
      <FloatingMenu menuRoot={menuKey} onClose={onToggle} className="min-w-[190px]">
        {children}
      </FloatingMenu>
    )}
  </>
);

export const ContextItem: React.FC<{ icon: React.ReactNode; label: string; onClick: (e: React.MouseEvent) => void; danger?: boolean }> = ({
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



/** Collapsible section title with an item count and a "+" action — used for Spaces, Projects and Sprints. */
export const SectionHeader: React.FC<{
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
      className="flex items-center gap-1.5 text-white/50 hover:text-white/80 text-3xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
    >
      <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? '' : '-rotate-90'}`} />
      <span>{title}</span>
      <span className="bg-white/10 text-white/70 text-4xs px-1.5 py-0.5 rounded-full font-bold">{count}</span>
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
export const Collapsible: React.FC<{ open: boolean; children: React.ReactNode }> = ({ open, children }) => (
  <div
    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(.4,0,.2,1)] ${
      open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
    }`}
    aria-hidden={!open}
  >
    <div className="overflow-hidden min-h-0">{children}</div>
  </div>
);
