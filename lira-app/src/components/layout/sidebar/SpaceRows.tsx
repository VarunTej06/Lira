import type { Space } from '../../../types/space';
import { SpaceRow } from './parts';
import type { SidebarState } from './useSidebarState';

/** One row per space, wired to the sidebar's menus. The Spaces, Hidden and Archived sections all list spaces this way. */
export function SpaceRows({ s, spaces, kind }: { s: SidebarState; spaces: Space[]; kind?: 'hidden' | 'archived' }) {
  const { activeSpaceId, inSpaceView, starredIds, openMenuId, setOpenMenuId, handleSpaceClick, toggleStar, handleDelete, onEditSpace, onToggleHideSpace, onToggleArchiveSpace } = s;
  // Run a menu action, closing the open menu first; the click must not also select the space.
  const fromMenu = (action: ((id: number) => void) | undefined, id: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(null);
    action?.(id);
  };
  return (
    <>
      {spaces.map(space => (
        <SpaceRow
          key={space.id}
          space={space}
          active={inSpaceView && activeSpaceId === space.id}
          starred={space.id ? starredIds.has(space.id) : false}
          isHidden={kind === 'hidden'}
          isArchived={kind === 'archived'}
          onSelect={handleSpaceClick}
          onMenuOpen={() => setOpenMenuId(openMenuId === space.id ? null : space.id!)}
          menuOpen={openMenuId === space.id}
          onStar={e => toggleStar(space.id!, e)}
          onDelete={e => handleDelete(space, e)}
          onEdit={() => { onEditSpace?.(space); setOpenMenuId(null); }}
          onToggleHide={fromMenu(onToggleHideSpace, space.id!)}
          onToggleArchive={fromMenu(onToggleArchiveSpace, space.id!)}
        />
      ))}
    </>
  );
}
