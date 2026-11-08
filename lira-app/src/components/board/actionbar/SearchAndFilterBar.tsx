import { Search, ChevronDown, MoreHorizontal, Users, SlidersHorizontal, X, Tag, FileJson, Settings, ToggleLeft, ToggleRight, CheckSquare, Eye, EyeOff, Archive, ArchiveRestore, Edit3 } from 'lucide-react';
import type {  } from '../../../types/space';
import { Avatar } from '../../common/Avatar';
import { PRIORITIES, GROUP_OPTIONS } from './useActionBarState';
import type { ActionBarState } from './useActionBarState';

/** Search, assignee filter, filters, grouping and the ... menu. */
export function SearchAndFilterBar(s: ActionBarState) {
  const {  searchQuery, onSearchChange, filterAssignee, onFilterAssigneeToggle, availableLabels, isSpaceHidden, isSpaceArchived, onToggleHideSpace, onToggleArchiveSpace, onEditSpace, showFilter, setShowFilter, filterPriorities, filterLabels, filterRef, groupBy, showGroup, setShowGroup, groupRef, showOverflow, setShowOverflow, overflowRef, wipEnabled, setShowWipLimitsModal, handlePriorityToggle, handleLabelToggle, handleClearFilters, activeFilterCount, handleGroupChange, handleWipToggle, handleBoardSettings, handleBulkActions, handleExportViewJSON, currentGroupLabel } = s;
  return (
    <>
      {/* Search & filter bar */}
      <div className="flex items-center gap-2 px-4 py-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-lira-muted" />
          <input
            type="text"
            placeholder="Search board"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-lira-border rounded bg-white focus:outline-none focus:border-lira-blue focus:ring-1 focus:ring-lira-blue transition-all w-48"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-lira-muted hover:text-lira-text"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Assignee filter */}
        <button
          onClick={onFilterAssigneeToggle}
          className={`flex items-center gap-1 transition-all rounded-full p-0.5 ${filterAssignee ? 'ring-2 ring-lira-blue ring-offset-1' : 'opacity-70 hover:opacity-100'}`}
          title={filterAssignee ? 'Show all assignees' : 'Filter by me (VY)'}
        >
          <Avatar initials="VY" size="sm" color="#0052CC" />
        </button>

        {/* ── Filter popover ── */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded transition-colors ${
              activeFilterCount > 0
                ? 'border-lira-blue text-lira-blue bg-blue-50 hover:bg-blue-100'
                : 'text-lira-muted border-lira-border hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filter
            {activeFilterCount > 0 && (
              <span className="bg-blue-100 text-blue-700 text-xs rounded-full px-1.5 font-semibold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {showFilter && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-lira-border rounded-xl shadow-lg z-30 p-4 min-w-[280px]">
              {/* Priority section */}
              <p className="text-xs font-semibold text-lira-muted uppercase tracking-wide mb-2">Priority</p>
              {PRIORITIES.map(p => (
                <label
                  key={p.value}
                  className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 cursor-pointer text-sm text-lira-text"
                >
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-lira-blue focus:ring-lira-blue"
                    checked={filterPriorities.includes(p.value)}
                    onChange={() => handlePriorityToggle(p.value)}
                  />
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  {p.label}
                </label>
              ))}

              {/* Label section */}
              {availableLabels.length > 0 && (
                <>
                  <div className="border-t border-lira-border my-3" />
                  <p className="text-xs font-semibold text-lira-muted uppercase tracking-wide mb-2">
                    <Tag className="inline w-3 h-3 mr-1" />
                    Labels
                  </p>
                  {availableLabels.map(label => (
                    <label
                      key={label}
                      className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 cursor-pointer text-sm text-lira-text"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-lira-blue focus:ring-lira-blue"
                        checked={filterLabels.includes(label)}
                        onChange={() => handleLabelToggle(label)}
                      />
                      {label}
                    </label>
                  ))}
                </>
              )}

              {/* Clear filters */}
              <div className="border-t border-lira-border mt-3 pt-3">
                <button
                  onClick={handleClearFilters}
                  className="w-full text-center text-xs font-medium text-lira-muted hover:text-red-500 transition-colors py-1"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Group dropdown ── */}
        <div className="relative" ref={groupRef}>
          <button
            onClick={() => setShowGroup(!showGroup)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-lira-muted border border-lira-border rounded hover:bg-gray-50 transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            Group: {currentGroupLabel}
            <ChevronDown className="w-3 h-3" />
          </button>

          {showGroup && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-lira-border rounded-xl shadow-lg z-30 py-1 min-w-[180px]">
              <p className="text-xs font-semibold text-lira-muted uppercase tracking-wide px-3 pt-2 pb-1">Group by</p>
              {GROUP_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleGroupChange(opt.value)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    groupBy === opt.value
                      ? 'text-lira-blue bg-blue-50 font-medium'
                      : 'text-lira-text hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Overflow / … menu ── */}
        <div className="relative ml-auto" ref={overflowRef}>
          <button
            onClick={() => setShowOverflow(!showOverflow)}
            className="p-1.5 rounded hover:bg-gray-100 text-lira-muted transition-colors"
            title="More options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showOverflow && (
            <div className="absolute top-full right-0 mt-1 bg-white border border-lira-border rounded-xl shadow-lg z-30 py-1 min-w-[220px]">
              {/* Board settings */}
              <button
                onClick={handleBoardSettings}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-lira-text hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-lira-muted" />
                Board settings
              </button>

              {/* Space settings & Edit */}
              {onEditSpace && (
                <button
                  onClick={() => {
                    setShowOverflow(false);
                    onEditSpace();
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-lira-text hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-lira-muted" />
                  Space settings
                </button>
              )}

              {/* Hide / Unhide space */}
              {onToggleHideSpace && (
                <button
                  onClick={() => {
                    setShowOverflow(false);
                    onToggleHideSpace();
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-lira-text hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  {isSpaceHidden ? (
                    <>
                      <Eye className="w-3.5 h-3.5 text-lira-blue" />
                      <span>Unhide space</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-lira-muted" />
                      <span>Hide space</span>
                    </>
                  )}
                </button>
              )}

              {/* Archive / Unarchive space */}
              {onToggleArchiveSpace && (
                <button
                  onClick={() => {
                    setShowOverflow(false);
                    onToggleArchiveSpace();
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-lira-text hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  {isSpaceArchived ? (
                    <>
                      <ArchiveRestore className="w-3.5 h-3.5 text-amber-600" />
                      <span>Unarchive space</span>
                    </>
                  ) : (
                    <>
                      <Archive className="w-3.5 h-3.5 text-lira-muted" />
                      <span>Archive space</span>
                    </>
                  )}
                </button>
              )}

              <div className="border-t border-lira-border my-1" />

              {/* WIP Limits */}
              <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors">
                <button
                  type="button"
                  onClick={() => { setShowOverflow(false); setShowWipLimitsModal(true); }}
                  className="text-sm text-lira-text flex items-center gap-2 text-left hover:text-lira-blue cursor-pointer"
                  title="Configure WIP limits per column"
                >
                  {wipEnabled
                    ? <ToggleRight className="w-3.5 h-3.5 text-lira-blue" />
                    : <ToggleLeft className="w-3.5 h-3.5 text-lira-muted" />
                  }
                  WIP limits: {wipEnabled ? 'ON' : 'OFF'}
                </button>
                <button
                  onClick={handleWipToggle}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${wipEnabled ? 'bg-lira-blue' : 'bg-gray-300'}`}
                  aria-label="Toggle WIP limits"
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${wipEnabled ? 'translate-x-4' : 'translate-x-1'}`}
                  />
                </button>
              </div>

              <div className="border-t border-lira-border my-1" />

              {/* Bulk actions */}
              <button
                onClick={handleBulkActions}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-lira-text hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5 text-lira-muted" />
                Bulk actions
              </button>

              <div className="border-t border-lira-border my-1" />

              {/* Export view to JSON */}
              <button
                onClick={handleExportViewJSON}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-lira-text hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <FileJson className="w-3.5 h-3.5 text-lira-muted" />
                Export view to JSON
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
