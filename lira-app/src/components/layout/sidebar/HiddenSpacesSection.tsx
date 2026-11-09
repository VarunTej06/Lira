import { Settings, ChevronDown, MoreHorizontal, Eye, EyeOff } from 'lucide-react';
import { FloatingMenu, ContextItem } from './parts';
import { SpaceRows } from './SpaceRows';
import type { SidebarState } from './useSidebarState';

/** Hidden spaces. */
export function HiddenSpacesSection(s: SidebarState) {
  const { spaces, onEditSpace, onUnhideAllSpaces, hiddenSpacesExpanded, setHiddenSpacesExpanded, hiddenHeaderMenuOpen, setHiddenHeaderMenuOpen, hiddenMenuRef, hiddenSpaces } = s;
  return (
    <>
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
          <div className="relative" ref={hiddenMenuRef} data-menu-root="hidden-header">
            <button
              data-menu-trigger
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
              <FloatingMenu menuRoot="hidden-header" onClose={() => setHiddenHeaderMenuOpen(false)} className="min-w-[190px]">
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
              </FloatingMenu>
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
              <SpaceRows s={s} spaces={hiddenSpaces} kind="hidden" />
            )}
          </div>
        )}
      </div>
    </>
  );
}
