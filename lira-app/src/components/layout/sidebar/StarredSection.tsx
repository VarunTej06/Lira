import { SpaceRow } from './parts';
import type { SidebarState } from './useSidebarState';

/** Starred spaces. */
export function StarredSection(s: SidebarState) {
  const { spaces, activeSpaceId, onEditSpace, onToggleHideSpace, onToggleArchiveSpace, openMenuId, setOpenMenuId, starredIds, handleSpaceClick, toggleStar, handleDelete, inSpaceView } = s;
  return (
    <>
      {/* ── Starred Section ── */}
      {starredIds.size > 0 && (
        <div className="py-2 border-b border-white/10">
          <div className="px-3 mb-1 text-white/30 text-3xs font-semibold uppercase tracking-wider">
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
    </>
  );
}
