import { ChevronDown, Archive } from 'lucide-react';
import { SpaceRows } from './SpaceRows';
import type { SidebarState } from './useSidebarState';

/** Archived spaces. */
export function ArchivedSection(s: SidebarState) {
  const { archivedSpacesExpanded, setArchivedSpacesExpanded, archivedSpaces } = s;
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
              {<SpaceRows s={s} spaces={archivedSpaces} kind="archived" />}
            </div>
          )}
        </div>
      )}
    </>
  );
}
