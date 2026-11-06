import React from 'react';
import { CustomiseSidebarModal } from './CustomiseSidebarModal';
import { useSidebarState, type LeftSidebarProps } from './sidebar/useSidebarState';
import { CollapsedRail } from './sidebar/CollapsedRail';
import { NavigationList } from './sidebar/NavigationList';
import { StarredSection } from './sidebar/StarredSection';
import { SpacesSection } from './sidebar/SpacesSection';
import { ProjectsSection } from './sidebar/ProjectsSection';
import { SprintsSection } from './sidebar/SprintsSection';
import { HiddenSpacesSection } from './sidebar/HiddenSpacesSection';
import { ArchivedSection } from './sidebar/ArchivedSection';
import { SidebarFooter } from './sidebar/SidebarFooter';

/** The floating left panel: navigation, spaces, projects, sprints (in the order set in "Customise sidebar"). */
export const LeftSidebar: React.FC<LeftSidebarProps> = (props) => {
  const s = useSidebarState(props);
  const { isCollapsed, panelRef, indicator, indicatorAnimated, visibleSectionKeys, showCustomiseModal, setShowCustomiseModal, handleSaveConfig } = s;

  // Collapsible blocks below the navigation; shown in the order chosen in the sidebar settings
  const sections: Record<string, React.ReactNode> = {
    sec_spaces: <SpacesSection {...s} />,
    sec_projects: <ProjectsSection {...s} />,
    sec_sprints: <SprintsSection {...s} />,
    sec_hidden: <HiddenSpacesSection {...s} />,
  };

  return (
    <aside
      className={`flex-shrink-0 p-2 pr-0 transition-[width] duration-300 ease-[cubic-bezier(.4,0,.2,1)] ${
        isCollapsed ? 'w-[68px]' : 'w-[272px]'
      }`}
    >
      <div
        ref={panelRef}
        className="relative h-full flex flex-col rounded-2xl bg-gradient-to-b from-[#1D2A45] via-[#18233B] to-[#121A2C] border border-white/[0.08] shadow-[0_10px_34px_rgba(0,0,0,0.38)] overflow-x-hidden overflow-y-auto lira-sidebar-scroll"
      >
      {/* Sliding highlight: glides to whichever item is currently active */}
      {!isCollapsed && (
        <div
          aria-hidden
          className={`absolute left-2 right-2 z-0 rounded-xl bg-gradient-to-r from-jira-blue/35 to-jira-blue/10 ring-1 ring-jira-blue/40 shadow-[inset_3px_0_0_rgb(var(--jira-blue))] pointer-events-none ${indicatorAnimated ? 'transition-[top,height,opacity] duration-300 ease-[cubic-bezier(.4,0,.2,1)]' : ''}`}
          style={{ top: indicator.top, height: indicator.height, opacity: indicator.visible ? 1 : 0 }}
        />
      )}
        {isCollapsed ? (
          <CollapsedRail {...s} />
        ) : (
          <div key="full" className="relative z-10 w-full flex flex-col flex-1 min-h-0 animate-sidebar-in">
            <NavigationList {...s} />
            <StarredSection {...s} />
            {visibleSectionKeys.map(k => <React.Fragment key={k}>{sections[k]}</React.Fragment>)}
            <ArchivedSection {...s} />
            <SidebarFooter {...s} />
          </div>
        )}

        <CustomiseSidebarModal
          isOpen={showCustomiseModal}
          onClose={() => setShowCustomiseModal(false)}
          onSave={handleSaveConfig}
        />
      </div>
    </aside>
  );
};
