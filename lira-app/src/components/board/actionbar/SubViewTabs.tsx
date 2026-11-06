import { ChevronDown } from 'lucide-react';
import { MAIN_TABS, MORE_TABS } from './useActionBarState';
import type { ActionBarState } from './useActionBarState';

/** Summary, Board, List, Calendar, Sprints, Capacity and More. */
export function SubViewTabs(s: ActionBarState) {
  const { activeTab, onTabChange, showMore, setShowMore, moreRef, handleMoreOptionClick } = s;
  return (
    <>
      {/* Sub-view tabs */}
      <div className="flex items-center border-b border-jira-border px-4">
        {MAIN_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`
              px-3 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px
              ${activeTab === tab
                ? 'text-jira-blue border-jira-blue'
                : 'text-jira-muted border-transparent hover:text-jira-text hover:border-jira-border'
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
                ? 'text-jira-blue border-jira-blue'
                : 'text-jira-muted border-transparent hover:text-jira-text'
            }`}
          >
            More <span className="text-xs text-jira-muted">({MORE_TABS.length})</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {showMore && (
            <div className="absolute top-full left-0 z-20 bg-white border border-jira-border rounded-md shadow-dropdown py-1 min-w-[140px]">
              {MORE_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => handleMoreOptionClick(tab)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-jira-text transition-colors cursor-pointer"
                >
                  {tab}
                </button>
              ))}
              <div className="border-t border-jira-border my-1" />
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-jira-muted">
                Archived work items
              </button>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-jira-muted">
                Shortcuts
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
