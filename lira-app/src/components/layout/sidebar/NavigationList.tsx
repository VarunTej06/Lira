import { pageLink } from '../../../utils/links';
import { ChevronLeft } from 'lucide-react';
import { motion } from '../../common/motionPresets';
import { glide } from '../../common/motionPresets';
import type { SidebarState } from './useSidebarState';

/** For you, Projects, Sprints ... (the items chosen in the sidebar settings), with the collapse button. */
export function NavigationList(s: SidebarState) {
  const { activeProjectId, activeSprint, activeTab, isRotating, sprintsExpanded, collapse, navItemDefs, visibleNavKeys, visibleSprintKeys } = s;
  return (
    <>
          {/* ── Navigation Section ── */}
          <div className="py-2.5 px-2 border-b border-white/10 space-y-0.5">
            <div className="px-3 mb-1 text-white/30 text-3xs font-semibold uppercase tracking-wider flex items-center justify-between">
              <span>Navigation</span>
              <button
                onClick={collapse}
                className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer group"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
            <ChevronLeft
              className={`w-3.5 h-3.5 transition-transform duration-300 ease-in-out ${
                isRotating ? '-rotate-180' : 'rotate-0'
              }`}
            />
          </button>
        </div>

        {visibleNavKeys.map(k => {
          const item = navItemDefs[k];
          if (!item) return null;
          const tab = item.tab;
          const sprintRowShown = sprintsExpanded && visibleSprintKeys.includes(activeSprint ?? '');
          const isActive =
            (k === 'sprints'
              // overview page, or a sprint page whose row isn't visible in the Sprints section
              ? activeTab === 'SprintsHub' || (activeTab === 'SprintDetail' && !sprintRowShown)
              : activeTab === tab) &&
            !(k === 'projects' && activeProjectId);
          return (
            <button
              key={k}
              onClick={item.action} {...pageLink(item.tab)}
              data-active={isActive ? 'true' : undefined}
              className={`group relative w-full flex items-center gap-3 px-3 min-h-8 py-1.5 rounded-xl text-xs transition-colors duration-100 cursor-pointer text-left ${
                isActive ? 'text-white font-medium' : 'text-white/70 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {isActive && (
                <motion.span layoutId="nav-active-pill" transition={glide} className="absolute inset-0 rounded-xl bg-white/[0.14] ring-1 ring-white/10" aria-hidden />
              )}
              <span className="relative w-5 flex justify-center flex-shrink-0">{item.icon}</span>
              <span className="relative">{item.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
