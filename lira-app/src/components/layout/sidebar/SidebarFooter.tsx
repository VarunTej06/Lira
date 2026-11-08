import { Settings } from 'lucide-react';
import type { SidebarState } from './useSidebarState';

/** "Customise sidebar" button. */
export function SidebarFooter(s: SidebarState) {
  const { setShowCustomiseModal } = s;
  return (
    <>
      {/* ── Customise sidebar footer ── */}
      <div className="relative z-10 flex-shrink-0 border-t border-white/10 px-2 py-2">
        <button
          onClick={() => setShowCustomiseModal(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/50 hover:text-white hover:bg-white/[0.06] transition-all duration-200 cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5" /> Customise sidebar
        </button>
      </div>
    </>
  );
}
