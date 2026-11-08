import { PriorityIcon, TypeIcon } from '../../common/Icons';
import { Search, Filter, X, ChevronDown, Check, Clock, CheckCircle2, Zap, Tag, Layers, User as UserIcon } from 'lucide-react';
import type {  } from '../../../types/issue';
import type {  } from '../../../types/space';
import { Avatar } from '../../common/Avatar';
import type { FiltersState } from './useFiltersState';

/** Search box and the filter dropdowns. */
export function FilterControls(s: FiltersState) {
  const { issues, spaces, searchQuery, setSearchQuery, selectedSpaces, setSelectedSpaces, selectedStatuses, setSelectedStatuses, selectedPriorities, setSelectedPriorities, selectedTypes, setSelectedTypes, selectedAssignees, setSelectedAssignees, selectedLabels, setSelectedLabels, selectedTeam, setSelectedTeam, activePreset, openDropdown, setOpenDropdown, clearAllFilters, applyPreset, spaceMap, allLabels, allAssignees, allTeams, presetCounts, filteredIssues, activeFiltersCount } = s;
  return (
    <>
        <div className="bg-white border border-lira-border rounded-xl shadow-xs overflow-visible">
          {/* ── ROW 1: Search & Preset Pills (Tailwind Grid) ── */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-3.5 border-b border-lira-border">
            {/* Search Input */}
            <div className="md:col-span-5 lg:col-span-5 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-lira-muted" />
              <input
                type="text"
                placeholder="Search key (AI-18), title, description, or label…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-gray-50/70 border border-lira-border rounded-lg focus:outline-none focus:bg-white focus:border-lira-blue focus:ring-1 focus:ring-lira-blue transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Preset Filter Segmented Pills */}
            <div className="md:col-span-5 lg:col-span-5 flex items-center gap-1.5 overflow-x-auto py-0.5">
              {[
                { id: 'all', label: 'All Issues', count: presetCounts.all, icon: <Filter className="w-3 h-3" /> },
                { id: 'open', label: 'Open Issues', count: presetCounts.open, icon: <Clock className="w-3 h-3" /> },
                { id: 'completed', label: 'Completed', count: presetCounts.completed, icon: <CheckCircle2 className="w-3 h-3" /> },
                { id: 'recent', label: 'Recently Updated', count: presetCounts.recent, icon: <Zap className="w-3 h-3" /> },
              ].map(preset => {
                const isActive = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-lira-blue text-white shadow-xs'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {preset.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Counter & Quick Reset */}
            <div className="md:col-span-2 lg:col-span-2 flex items-center justify-end gap-2 text-xs">
              <span className="text-lira-muted text-[11px] whitespace-nowrap">
                <strong className="text-lira-text font-bold">{filteredIssues.length}</strong> of {issues.length}
              </span>
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 text-red-600 hover:text-red-700 font-semibold px-2 py-1 hover:bg-red-50 rounded transition-colors cursor-pointer text-xs"
                >
                  <X className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* ── ROW 2: Facet Dropdowns (Tailwind Grid) ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 p-3 bg-gray-50/70 text-xs">
            {/* 1. Space Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'space' ? null : 'space')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedSpaces.length > 0
                    ? 'bg-blue-50/60 border-lira-blue text-lira-blue font-semibold'
                    : 'bg-white border-lira-border text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <Layers className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                  <span className="truncate">
                    {selectedSpaces.length === 0
                      ? 'Space: All'
                      : selectedSpaces.length === 1
                      ? spaceMap[selectedSpaces[0]]?.name || '1 Space'
                      : `${selectedSpaces.length} Spaces`}
                  </span>
                </span>
                <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
              </button>

              {openDropdown === 'space' && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-lira-border rounded-xl shadow-xl z-50 p-2 space-y-1 animate-scale-in max-h-56 overflow-y-auto">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">Filter by Space</div>
                  {spaces.map(s => {
                    const active = selectedSpaces.includes(s.id!);
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedSpaces(prev =>
                            active ? prev.filter(id => id !== s.id) : [...prev, s.id!]
                          );
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                          active ? 'bg-blue-50 text-lira-blue font-semibold' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span>{s.icon}</span>
                          <span className="truncate">{s.name}</span>
                        </span>
                        {active && <Check className="w-3.5 h-3.5 text-lira-blue" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Status Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedStatuses.length > 0
                    ? 'bg-blue-50/60 border-lira-blue text-lira-blue font-semibold'
                    : 'bg-white border-lira-border text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                  <span className="truncate">
                    {selectedStatuses.length === 0
                      ? 'Status: All'
                      : selectedStatuses.length === 1
                      ? selectedStatuses[0].toUpperCase()
                      : `${selectedStatuses.length} Statuses`}
                  </span>
                </span>
                <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
              </button>

              {openDropdown === 'status' && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-lira-border rounded-xl shadow-xl z-50 p-2 space-y-1 animate-scale-in">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">Filter by Status</div>
                  {[
                    { id: 'backlog', label: 'Backlog', color: 'bg-slate-100 text-slate-800' },
                    { id: 'todo', label: 'To Do', color: 'bg-blue-100 text-blue-800' },
                    { id: 'inprogress', label: 'In Progress', color: 'bg-amber-100 text-amber-800' },
                    { id: 'done', label: 'Done', color: 'bg-emerald-100 text-emerald-800' },
                  ].map(st => {
                    const active = selectedStatuses.includes(st.id);
                    return (
                      <button
                        key={st.id}
                        onClick={() => {
                          setSelectedStatuses(prev =>
                            active ? prev.filter(x => x !== st.id) : [...prev, st.id]
                          );
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                          active ? 'bg-blue-50 text-lira-blue font-semibold' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${st.color}`}>
                            {st.label}
                          </span>
                        </span>
                        {active && <Check className="w-3.5 h-3.5 text-lira-blue" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Priority Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedPriorities.length > 0
                    ? 'bg-blue-50/60 border-lira-blue text-lira-blue font-semibold'
                    : 'bg-white border-lira-border text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <span className="truncate">
                    {selectedPriorities.length === 0
                      ? 'Priority: All'
                      : `${selectedPriorities.length} Selected`}
                  </span>
                </span>
                <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
              </button>

              {openDropdown === 'priority' && (
                <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-lira-border rounded-xl shadow-xl z-50 p-2 space-y-1 animate-scale-in">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">Priority Tier</div>
                  {[
                    { id: 'highest', label: 'Highest' },
                    { id: 'high', label: 'High' },
                    { id: 'medium', label: 'Medium' },
                    { id: 'low', label: 'Low' },
                    { id: 'lowest', label: 'Lowest' },
                  ].map(p => {
                    const active = selectedPriorities.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedPriorities(prev =>
                            active ? prev.filter(x => x !== p.id) : [...prev, p.id]
                          );
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                          active ? 'bg-blue-50 text-lira-blue font-semibold' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5"><PriorityIcon priority={p.id} />{p.label}</span>
                        {active && <Check className="w-3.5 h-3.5 text-lira-blue" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Issue Type Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedTypes.length > 0
                    ? 'bg-blue-50/60 border-lira-blue text-lira-blue font-semibold'
                    : 'bg-white border-lira-border text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <span className="truncate">
                    {selectedTypes.length === 0
                      ? 'Type: All'
                      : `${selectedTypes.length} Types`}
                  </span>
                </span>
                <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
              </button>

              {openDropdown === 'type' && (
                <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-lira-border rounded-xl shadow-xl z-50 p-2 space-y-1 animate-scale-in">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">Work Item Type</div>
                  {[
                    { id: 'epic', label: 'Epic' },
                    { id: 'task', label: 'Task' },
                    { id: 'bug', label: 'Bug' },
                    { id: 'subtask', label: 'Subtask' },
                  ].map(t => {
                    const active = selectedTypes.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setSelectedTypes(prev =>
                            active ? prev.filter(x => x !== t.id) : [...prev, t.id]
                          );
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                          active ? 'bg-blue-50 text-lira-blue font-semibold' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5"><TypeIcon type={t.id} />{t.label}</span>
                        {active && <Check className="w-3.5 h-3.5 text-lira-blue" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 5. Assignee Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'assignee' ? null : 'assignee')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedAssignees.length > 0
                    ? 'bg-blue-50/60 border-lira-blue text-lira-blue font-semibold'
                    : 'bg-white border-lira-border text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <UserIcon className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                  <span className="truncate">
                    {selectedAssignees.length === 0
                      ? 'Assignee: All'
                      : `${selectedAssignees.length} Assignees`}
                  </span>
                </span>
                <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
              </button>

              {openDropdown === 'assignee' && (
                <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-lira-border rounded-xl shadow-xl z-50 p-2 space-y-1 animate-scale-in max-h-56 overflow-y-auto">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">Assignee</div>
                  {allAssignees.map(init => {
                    const active = selectedAssignees.includes(init);
                    return (
                      <button
                        key={init}
                        onClick={() => {
                          setSelectedAssignees(prev =>
                            active ? prev.filter(x => x !== init) : [...prev, init]
                          );
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                          active ? 'bg-blue-50 text-lira-blue font-semibold' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar initials={init} size="xs" color={init === 'VY' ? '#0052CC' : '#6B778C'} />
                          <span>{init === 'VY' ? 'Varun Tej (VY)' : init}</span>
                        </div>
                        {active && <Check className="w-3.5 h-3.5 text-lira-blue" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 6. Tags & Teams Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'tags' ? null : 'tags')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedLabels.length > 0 || selectedTeam !== 'all'
                    ? 'bg-blue-50/60 border-lira-blue text-lira-blue font-semibold'
                    : 'bg-white border-lira-border text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <Tag className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                  <span className="truncate">
                    {selectedLabels.length === 0 && selectedTeam === 'all'
                      ? 'Tags & Team'
                      : `${selectedLabels.length + (selectedTeam !== 'all' ? 1 : 0)} Active`}
                  </span>
                </span>
                <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
              </button>

              {openDropdown === 'tags' && (
                <div className="absolute right-0 top-full mt-1 w-60 bg-white border border-lira-border rounded-xl shadow-xl z-50 p-2.5 space-y-2.5 animate-scale-in max-h-64 overflow-y-auto">
                  {/* Team Filter */}
                  {allTeams.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Team Filter</div>
                      <select
                        value={selectedTeam}
                        onChange={e => setSelectedTeam(e.target.value)}
                        className="w-full bg-gray-50 text-gray-700 rounded-lg p-1.5 text-xs border border-gray-200"
                      >
                        <option value="all">All Teams</option>
                        {allTeams.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Labels Filter */}
                  {allLabels.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Labels / Tags</div>
                      <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                        {allLabels.map(lbl => {
                          const active = selectedLabels.includes(lbl);
                          return (
                            <button
                              key={lbl}
                              type="button"
                              onClick={() => {
                                setSelectedLabels(prev =>
                                  active ? prev.filter(x => x !== lbl) : [...prev, lbl]
                                );
                              }}
                              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                                active ? 'bg-indigo-600 text-white font-bold' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                              }`}
                            >
                              #{lbl}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
    </>
  );
}
