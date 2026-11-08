import { spaceLink } from '../../../utils/links';
import { ChevronDown } from 'lucide-react';
import { motion, slide } from '../../common/motion';
import { MAIN_TABS, MORE_TABS } from './useActionBarState';
import type { ActionBarState } from './useActionBarState';

/** The coloured pill that sits around the tab you are on, and slides to the next one. */
const Pill = () => (
  <motion.span layoutId="space-tab-pill" transition={slide} aria-hidden data-testid="space-tab-pill"
    className="absolute inset-0 rounded-xl bg-lira-blue-light ring-1 ring-lira-blue/40 shadow-xs" />
);

/** Summary, Board, List, Calendar, Sprints, Capacity and More: one rounded bar, the current tab highlighted all round. */
export function SubViewTabs(s: ActionBarState) {
  const { activeTab, onTabChange, showMore, setShowMore, moreRef, handleMoreOptionClick } = s;
  const spaceKey = /^\/space\/([^/]+)/.exec(window.location.pathname)?.[1];
  const tabLink = (tab: string) => spaceKey ? spaceLink(decodeURIComponent(spaceKey), tab) : {};
  const moreActive = MORE_TABS.includes(activeTab);
  return (
    <>
      {/* Sub-view tabs */}
      <div className="px-4 py-2">
        <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-gray-100/80 border border-lira-border" role="tablist" aria-label="Space views" data-testid="space-tabs">
          {MAIN_TABS.map(tab => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => onTabChange(tab)} {...tabLink(tab)}
              className={`relative px-3.5 py-1.5 text-sm font-medium rounded-xl transition-colors cursor-pointer ${activeTab === tab ? 'text-lira-blue' : 'text-lira-muted hover:text-lira-text hover:bg-white/60'}`}
            >
              {activeTab === tab && <Pill />}
              <span className="relative">{tab}</span>
            </button>
          ))}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setShowMore(!showMore)}
              aria-haspopup="menu"
              aria-expanded={showMore}
              className={`relative flex items-center gap-1 px-3.5 py-1.5 text-sm font-medium rounded-xl transition-colors cursor-pointer ${moreActive ? 'text-lira-blue' : 'text-lira-muted hover:text-lira-text hover:bg-white/60'}`}
            >
              {moreActive && <Pill />}
              <span className="relative flex items-center gap-1">
                More <span className="text-xs text-lira-muted">({MORE_TABS.length})</span>
                <ChevronDown className="w-3 h-3" />
              </span>
            </button>
            {showMore && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-lira-border rounded-xl shadow-dropdown py-1 min-w-[140px]">
                {MORE_TABS.map(tab => (
                  <button
                    key={tab}
                    onClick={() => handleMoreOptionClick(tab)} {...tabLink(tab)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors cursor-pointer ${activeTab === tab ? 'text-lira-blue font-semibold' : 'text-lira-text'}`}
                  >
                    {tab}
                  </button>
                ))}
                <div className="border-t border-lira-border my-1" />
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-lira-muted">
                  Archived work items
                </button>
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-lira-muted">
                  Shortcuts
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
