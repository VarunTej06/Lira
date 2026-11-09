import { SectionHeader, Collapsible } from './parts';
import { SpaceRows } from './SpaceRows';
import type { SidebarState } from './useSidebarState';

/** The Spaces list. */
export function SpacesSection(s: SidebarState) {
  const { onCreateSpace, spacesExpanded, setSpacesExpanded, visibleSpaces } = s;
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
                  <SpaceRows s={s} spaces={visibleSpaces} />
                )}
              </div>
            </Collapsible>
          </div>
        </div>
      )}
    </>
  );
}
