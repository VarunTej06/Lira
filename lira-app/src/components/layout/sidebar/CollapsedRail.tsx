import { ChevronRight, Plus } from 'lucide-react';
import type { SidebarState } from './useSidebarState';

/** The narrow icon-only version of the sidebar. */
export function CollapsedRail(s: SidebarState) {
  const { activeSpaceId, onCreateSpace, isRotating, expand, handleSpaceClick, navItemDefs, collapsedShortcuts, visibleSpaces, hiddenSpaces } = s;
  return (
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
  );
}
