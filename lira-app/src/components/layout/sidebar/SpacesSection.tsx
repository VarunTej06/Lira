import { SpaceRow, SectionHeader, Collapsible } from './parts';
import type { SidebarState } from './useSidebarState';

/** The Spaces list. */
export function SpacesSection(s: SidebarState) {
  const { activeSpaceId, onCreateSpace, onEditSpace, onToggleHideSpace, onToggleArchiveSpace, spacesExpanded, setSpacesExpanded, openMenuId, setOpenMenuId, starredIds, handleSpaceClick, toggleStar, handleDelete, visibleSpaces, inSpaceView } = s;
  return (
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
  );
}
