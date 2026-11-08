import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
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
  // On a phone the sidebar is a drawer: closed until you tap the menu button, over the page when open.
  const phone = useMediaQuery('(max-width: 1023px)');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setDrawerOpen(false); }, [location.pathname, location.search]); // going somewhere closes it
  useEffect(() => {
    if (!phone || !drawerOpen) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [phone, drawerOpen]);

  const s = useSidebarState(phone ? { ...props, sidebarCollapsed: false, setSidebarCollapsed: (c: boolean) => { if (c) setDrawerOpen(false); } } : props);
  const { isCollapsed, panelRef, indicator, indicatorAnimated, visibleSectionKeys, showCustomiseModal, setShowCustomiseModal, handleSaveConfig } = s;

  // Collapsible blocks below the navigation; shown in the order chosen in the sidebar settings
  const sections: Record<string, React.ReactNode> = {
    sec_spaces: <SpacesSection {...s} />,
    sec_projects: <ProjectsSection {...s} />,
    sec_sprints: <SprintsSection {...s} />,
    sec_hidden: <HiddenSpacesSection {...s} />,
  };

  if (phone && !drawerOpen) {
    return (
      <button
        onClick={() => setDrawerOpen(true)}
        aria-label="Open menu"
        data-testid="open-menu"
        className="fixed bottom-5 left-4 z-40 w-12 h-12 rounded-2xl bg-[#1D2A45] text-white border border-white/10 shadow-xl flex items-center justify-center cursor-pointer"
      >
        <Menu className="w-5 h-5" />
      </button>
    );
  }

  return (
    <>
    {phone && <div className="fixed inset-0 z-[55] bg-black/55" onClick={() => setDrawerOpen(false)} aria-hidden />}
    <aside
      className={`flex-shrink-0 p-2 pr-0 transition-[width] duration-300 ease-[cubic-bezier(.4,0,.2,1)] ${
        phone ? 'fixed inset-y-0 left-0 z-[60] w-[min(300px,86vw)] pr-2' : isCollapsed ? 'w-[68px]' : 'w-[272px]'
      }`}
    >
      <div className="relative h-full flex flex-col rounded-2xl bg-gradient-to-b from-[#1D2A45] via-[#18233B] to-[#121A2C] border border-white/[0.08] shadow-[0_10px_34px_rgba(0,0,0,0.38)] overflow-hidden">
      {/* Everything except the settings button scrolls here; the button below stays at the bottom */}
      <div ref={panelRef} className="relative flex-1 min-h-0 flex flex-col overflow-x-hidden overflow-y-auto lira-sidebar-scroll">
      {/* Sliding highlight: glides to whichever item is currently active */}
      {!isCollapsed && (
        <div
          aria-hidden
          className={`absolute left-2 right-2 z-0 rounded-xl bg-gradient-to-r from-lira-blue/35 to-lira-blue/10 ring-1 ring-lira-blue/40 shadow-[inset_3px_0_0_rgb(var(--lira-blue))] pointer-events-none ${indicatorAnimated ? 'transition-[top,height,opacity] duration-300 ease-[cubic-bezier(.4,0,.2,1)]' : ''}`}
          style={{ top: indicator.top, height: indicator.height, opacity: indicator.visible ? 1 : 0 }}
        />
      )}
        {isCollapsed ? (
          <CollapsedRail {...s} />
        ) : (
          <div key="full" className="relative z-10 w-full flex flex-col flex-shrink-0 animate-sidebar-in">
            <NavigationList {...s} />
            <StarredSection {...s} />
            {visibleSectionKeys.map(k => <React.Fragment key={k}>{sections[k]}</React.Fragment>)}
            <ArchivedSection {...s} />
          </div>
        )}
      </div>
      {!isCollapsed && <SidebarFooter {...s} />}

        <CustomiseSidebarModal
          isOpen={showCustomiseModal}
          onClose={() => setShowCustomiseModal(false)}
          onSave={handleSaveConfig}
        />
      </div>
    </aside>
    </>
  );
};
