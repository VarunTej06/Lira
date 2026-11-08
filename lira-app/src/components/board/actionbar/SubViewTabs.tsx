import { spaceLink } from '../../../utils/links';
import { ChevronDown } from 'lucide-react';
import { MAIN_TABS, MORE_TABS } from './useActionBarState';
import type { ActionBarState } from './useActionBarState';

/** Summary, Board, List, Calendar, Sprints, Capacity and More. */
export function SubViewTabs(s: ActionBarState) {
  const { activeTab, onTabChange, showMore, setShowMore, moreRef, handleMoreOptionClick } = s;
  const spaceKey = /^\/space\/([^/]+)/.exec(window.location.pathname)?.[1];
  const tabLink = (tab: string) => spaceKey ? spaceLink(decodeURIComponent(spaceKey), tab) : {};
  return (
    <>
      {/* Sub-view tabs */}
      <div className="flex items-center border-b border-lira-border px-4">
        {MAIN_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)} {...tabLink(tab)}
            className={`
              px-3 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px
              ${activeTab === tab
                ? 'text-lira-blue border-lira-blue'
                : 'text-lira-muted border-transparent hover:text-lira-text hover:border-lira-border'
              }
            `}
          >
            {tab}
          </button>
        ))}
        <div className="relative ml-1" ref={moreRef}>
          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex items-center gap-1 px-3 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              MORE_TABS.includes(activeTab)
                ? 'text-lira-blue border-lira-blue'
                : 'text-lira-muted border-transparent hover:text-lira-text'
            }`}
          >
            More <span className="text-xs text-lira-muted">({MORE_TABS.length})</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {showMore && (
            <div className="absolute top-full left-0 z-20 bg-white border border-lira-border rounded-md shadow-dropdown py-1 min-w-[140px]">
              {MORE_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => handleMoreOptionClick(tab)} {...tabLink(tab)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-lira-text transition-colors cursor-pointer"
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
    </>
  );
}
