import React, { useState } from 'react';
import {
  Share2, Zap, Maximize2, Search, ChevronDown, MoreHorizontal,
  Users, SlidersHorizontal, X
} from 'lucide-react';
import type { Space } from '../../types/space';
import { Avatar } from '../common/Avatar';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface BoardActionBarProps {
  space: Space | undefined;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterAssignee: boolean;
  onFilterAssigneeToggle: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const MAIN_TABS = ['Summary', 'Board', 'List', 'Calendar', 'Capacity', 'Timeline', 'Approvals'];
const MORE_TABS = ['Forms', 'Docs', 'Attachments', 'Reports'];

export const BoardActionBar: React.FC<BoardActionBarProps> = ({
  space,
  searchQuery,
  onSearchChange,
  filterAssignee,
  onFilterAssigneeToggle,
  activeTab,
  onTabChange,
}) => {
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-shrink-0 border-b border-jira-border bg-white">
      {/* Space header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-3">
          {space && (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
              style={{ backgroundColor: space.color + '22', color: space.color }}
            >
              {space.icon}
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-jira-text leading-tight">
              {space?.name || 'Select a space'}
            </h1>
            {space?.description && (
              <p className="text-xs text-jira-muted truncate max-w-xs">{space.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShare(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-jira-text border border-jira-border rounded hover:bg-gray-50 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
          <button className="p-1.5 rounded hover:bg-gray-100 text-jira-muted transition-colors" title="Automations">
            <Zap className="w-4 h-4" />
          </button>
          <button className="p-1.5 rounded hover:bg-gray-100 text-jira-muted transition-colors" title="Fullscreen">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

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
        <div className="relative ml-1">
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
                  onClick={() => { onTabChange(tab); setShowMore(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-jira-text transition-colors"
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

      {/* Search & filter bar */}
      <div className="flex items-center gap-2 px-4 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-jira-muted" />
          <input
            type="text"
            placeholder="Search board"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-jira-border rounded bg-white focus:outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue transition-all w-48"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-jira-muted hover:text-jira-text"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Assignee filter */}
        <button
          onClick={onFilterAssigneeToggle}
          className={`flex items-center gap-1 transition-all rounded-full p-0.5 ${filterAssignee ? 'ring-2 ring-jira-blue ring-offset-1' : 'opacity-70 hover:opacity-100'}`}
          title={filterAssignee ? 'Show all assignees' : 'Filter by me (VY)'}
        >
          <Avatar initials="VY" size="sm" color="#0052CC" />
        </button>

        <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-jira-muted border border-jira-border rounded hover:bg-gray-50 transition-colors">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filter
        </button>

        <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-jira-muted border border-jira-border rounded hover:bg-gray-50 transition-colors">
          <Users className="w-3.5 h-3.5" />
          Group
          <ChevronDown className="w-3 h-3" />
        </button>

        <button className="ml-auto p-1.5 rounded hover:bg-gray-100 text-jira-muted transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Share Modal */}
      <Modal isOpen={showShare} onClose={() => setShowShare(false)} title="Share Board" size="sm">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm text-green-700 font-medium">Space access: Open</span>
          </div>
          <p className="text-sm text-jira-muted">Anyone with the link can view this board. Since Lira is offline-first, your data never leaves your device.</p>
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-jira-border">
            <span className="text-xs text-jira-muted flex-1 truncate font-mono">{window.location.href}</span>
            <Button variant="primary" size="xs" onClick={handleCopyLink}>
              {copied ? '✓ Copied!' : 'Copy link'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
