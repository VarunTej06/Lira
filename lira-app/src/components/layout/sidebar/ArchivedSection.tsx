import { ChevronDown, Archive } from 'lucide-react';
import { SpaceRow } from './parts';
import type { SidebarState } from './useSidebarState';

/** Archived spaces. */
export function ArchivedSection(s: SidebarState) {
  const { activeSpaceId, onEditSpace, onToggleHideSpace, onToggleArchiveSpace, archivedSpacesExpanded, setArchivedSpacesExpanded, openMenuId, setOpenMenuId, starredIds, handleSpaceClick, toggleStar, handleDelete, archivedSpaces, inSpaceView } = s;
  return (
    <>
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
    </>
  );
}
