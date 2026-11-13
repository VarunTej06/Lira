import type { ComponentType, ReactNode } from 'react';
import { Search, ChevronDown, MoreHorizontal, Users, SlidersHorizontal, X, Tag, FileJson, Settings, ToggleLeft, ToggleRight, CheckSquare, Eye, EyeOff, Archive, ArchiveRestore, Edit3 } from 'lucide-react';
import { Avatar } from '../../common/Avatar';
import { PRIORITIES, GROUP_OPTIONS } from './useActionBarState';
import { FilterMultiSelect } from '../../common/FilterMultiSelect';
import { STATUS_LIST, BLOCKED_META } from '../../../utils/status';
import type { ActionBarState } from './useActionBarState';
import { currentUser } from '../../../utils/currentUser';
import { PALETTE } from '../../../theme/palette';

type Icon = ComponentType<{ className?: string }>;

const STATUS_OPTIONS = [...STATUS_LIST.map(st => ({ value: st.id as string, label: st.label, color: st.color })), { value: 'blocked', label: 'Blocked', color: BLOCKED_META.color }];

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-lira-muted" />
      <input
        type="text"
        placeholder="Search board"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pl-8 pr-3 py-1.5 text-sm border border-lira-border rounded bg-white focus:outline-none focus:border-lira-blue focus:ring-1 focus:ring-lira-blue transition-all w-48"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-lira-muted hover:text-lira-text">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function GroupMenu({ s, menuRef }: { s: ActionBarState; menuRef: ActionBarState['groupRef'] }) {
  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => s.setShowGroup(!s.showGroup)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-lira-muted border border-lira-border rounded hover:bg-gray-50 transition-colors"
      >
        <Users className="w-3.5 h-3.5" />
        Group: {s.currentGroupLabel}
        <ChevronDown className="w-3 h-3" />
      </button>
      {s.showGroup && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-lira-border rounded-xl shadow-lg z-30 py-1 min-w-[180px]">
          <p className="text-xs font-semibold text-lira-muted uppercase tracking-wide px-3 pt-2 pb-1">Group by</p>
          {GROUP_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => s.handleGroupChange(opt.value)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${s.groupBy === opt.value ? 'text-lira-blue bg-lira-blue-light font-medium' : 'text-lira-text hover:bg-gray-50'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** One row of the ... menu. */
function MenuItem({ icon: Icon, iconClass = 'text-lira-muted', onClick, children }: { icon: Icon; iconClass?: string; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-lira-text hover:bg-gray-50 transition-colors cursor-pointer">
      <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
      {children}
    </button>
  );
}

const Divider = () => <div className="border-t border-lira-border my-1" />;

/** The WIP limits row: the label opens the settings, the switch turns the limits on or off. */
function WipRow({ s }: { s: ActionBarState }) {
  const WipIcon = s.wipEnabled ? ToggleRight : ToggleLeft;
  return (
    <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors">
      <button
        type="button"
        onClick={() => { s.setShowOverflow(false); s.setShowWipLimitsModal(true); }}
        className="text-sm text-lira-text flex items-center gap-2 text-left hover:text-lira-blue cursor-pointer"
        title="Configure WIP limits per column"
      >
        <WipIcon className={`w-3.5 h-3.5 ${s.wipEnabled ? 'text-lira-blue' : 'text-lira-muted'}`} />
        WIP limits: {s.wipEnabled ? 'ON' : 'OFF'}
      </button>
      <button
        onClick={s.handleWipToggle}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${s.wipEnabled ? 'bg-lira-blue' : 'bg-gray-300'}`}
        aria-label="Toggle WIP limits"
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${s.wipEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

/** The space actions of the menu: each shows only when it can be done, and closes the menu first. */
function SpaceItems({ s }: { s: ActionBarState }) {
  const close = (action: () => void) => () => { s.setShowOverflow(false); action(); };
  return (
    <>
      {s.onEditSpace && <MenuItem icon={Edit3} onClick={close(s.onEditSpace)}>Space settings</MenuItem>}
      {s.onToggleHideSpace && (
        <MenuItem icon={s.isSpaceHidden ? Eye : EyeOff} iconClass={s.isSpaceHidden ? 'text-lira-blue' : undefined} onClick={close(s.onToggleHideSpace)}>
          <span>{s.isSpaceHidden ? 'Unhide space' : 'Hide space'}</span>
        </MenuItem>
      )}
      {s.onToggleArchiveSpace && (
        <MenuItem icon={s.isSpaceArchived ? ArchiveRestore : Archive} iconClass={s.isSpaceArchived ? 'text-amber-600' : undefined} onClick={close(s.onToggleArchiveSpace)}>
          <span>{s.isSpaceArchived ? 'Unarchive space' : 'Archive space'}</span>
        </MenuItem>
      )}
    </>
  );
}

function OverflowMenu({ s, menuRef }: { s: ActionBarState; menuRef: ActionBarState['overflowRef'] }) {
  return (
    <div className="relative ml-auto" ref={menuRef}>
      <button onClick={() => s.setShowOverflow(!s.showOverflow)} className="p-1.5 rounded hover:bg-gray-100 text-lira-muted transition-colors" title="More options">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {s.showOverflow && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-lira-border rounded-xl shadow-lg z-30 py-1 min-w-[220px]">
          <MenuItem icon={Settings} onClick={s.handleBoardSettings}>Board settings</MenuItem>
          <SpaceItems s={s} />
          <Divider />
          <WipRow s={s} />
          <Divider />
          <MenuItem icon={CheckSquare} onClick={s.handleBulkActions}>Bulk actions</MenuItem>
          <Divider />
          <MenuItem icon={FileJson} onClick={s.handleExportViewJSON}>Export view to JSON</MenuItem>
        </div>
      )}
    </div>
  );
}

/** Search, assignee filter, filters, grouping and the ... menu. */
export function SearchAndFilterBar(s: ActionBarState) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2">
      <SearchBox value={s.searchQuery} onChange={s.onSearchChange} />
      <button
        onClick={s.onFilterAssigneeToggle}
        className={`flex items-center gap-1 transition-all rounded-full p-0.5 ${s.filterAssignee ? 'ring-2 ring-lira-blue ring-offset-1' : 'opacity-70 hover:opacity-100'}`}
        title={s.filterAssignee ? 'Show all assignees' : 'Filter by me (VY)'}
      >
        <Avatar initials={currentUser().initials} size="sm" color={PALETTE.brand} />
      </button>

      {/* One small dropdown each, with a checkbox per value */}
      <FilterMultiSelect label="Priority" icon={<SlidersHorizontal className="w-3.5 h-3.5" />} options={PRIORITIES} selected={s.filterPriorities} onToggle={s.handlePriorityToggle} onClear={() => s.handleClearGroup('priorities')} />
      <FilterMultiSelect label="Status" options={STATUS_OPTIONS} selected={s.filterStatuses} onToggle={s.handleStatusToggle} onClear={() => s.handleClearGroup('statuses')} />
      <FilterMultiSelect
        label="Labels"
        icon={<Tag className="w-3.5 h-3.5" />}
        options={s.availableLabels.map(l => ({ value: l, label: l }))}
        selected={s.filterLabels}
        onToggle={s.handleLabelToggle}
        onClear={() => s.handleClearGroup('labels')}
        searchable
        searchPlaceholder="Search labels"
        emptyText="No labels in this space yet"
      />
      {s.activeFilterCount > 0 && (
        <button onClick={s.handleClearFilters} className="text-xs font-medium text-lira-muted hover:text-red-500 transition-colors px-1 cursor-pointer" data-testid="clear-filters">Clear filters</button>
      )}
      <GroupMenu s={s} menuRef={s.groupRef} />
      <OverflowMenu s={s} menuRef={s.overflowRef} />
    </div>
  );
}
