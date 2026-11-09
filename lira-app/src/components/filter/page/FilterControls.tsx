import type { ReactNode, Dispatch, SetStateAction } from 'react';
import { PriorityIcon, TypeIcon } from '../../common/Icons';
import { Search, Filter, X, ChevronDown, Check, Clock, CheckCircle2, Zap, Tag, Layers, User as UserIcon } from 'lucide-react';
import { Avatar } from '../../common/Avatar';
import type { FiltersState } from './useFiltersState';
import { PALETTE } from '../../../theme/palette';
import { assigneeSummary, prioritySummary, spaceSummary, statusSummary, tagCount, tagSummary, typeSummary } from './facetSummaries';

const PRESETS = [
  { id: 'all', label: 'All Issues', key: 'all', icon: <Filter className="w-3 h-3" /> },
  { id: 'open', label: 'Open Issues', key: 'open', icon: <Clock className="w-3 h-3" /> },
  { id: 'completed', label: 'Completed', key: 'completed', icon: <CheckCircle2 className="w-3 h-3" /> },
  { id: 'recent', label: 'Recently Updated', key: 'recent', icon: <Zap className="w-3 h-3" /> },
] as const;

const STATUSES = [
  { id: 'backlog', label: 'Backlog', color: 'bg-slate-100 text-slate-800' },
  { id: 'todo', label: 'To Do', color: 'bg-blue-100 text-blue-800' },
  { id: 'inprogress', label: 'In Progress', color: 'bg-amber-100 text-amber-800' },
  { id: 'blocked', label: 'Blocked (flag)', color: 'bg-red-100 text-red-800' },
  { id: 'done', label: 'Done', color: 'bg-emerald-100 text-emerald-800' },
];
const PRIORITIES = ['highest', 'high', 'medium', 'low', 'lowest'];
const TYPES = ['epic', 'task', 'bug', 'subtask'];
const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Adds the value to the list, or takes it out when it is already there. */
const toggle = <T,>(set: Dispatch<SetStateAction<T[]>>, value: T) =>
  set(prev => (prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value]));

const HEADING = 'text-3xs font-bold text-gray-400 uppercase tracking-wider';

/** A button that opens a small panel. Only one panel is open at a time (the page keeps which). */
function Facet({ id, open, onToggle, active, summary, icon, width, align = 'left', panelClass = 'p-2 space-y-1', children }: {
  id: string; open: string | null; onToggle: (id: string | null) => void; active: boolean; summary: string; icon?: ReactNode;
  width: string; align?: 'left' | 'right'; panelClass?: string; children: ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onToggle(open === id ? null : id)}
        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${active ? 'bg-blue-50/60 border-lira-blue text-lira-blue font-semibold' : 'bg-white border-lira-border text-gray-700 hover:bg-gray-100'}`}
      >
        <span className="flex items-center gap-1.5 truncate">{icon}<span className="truncate">{summary}</span></span>
        <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
      </button>
      {open === id && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1 ${width} bg-white border border-lira-border rounded-xl shadow-xl z-50 animate-scale-in ${panelClass}`}>
          {children}
        </div>
      )}
    </div>
  );
}

/** One choice in a panel, with a tick when chosen. */
function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${active ? 'bg-blue-50 text-lira-blue font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}
    >
      {children}
      {active && <Check className="w-3.5 h-3.5 text-lira-blue" />}
    </button>
  );
}

const Heading = ({ children }: { children: ReactNode }) => <div className={`${HEADING} px-2 py-1`}>{children}</div>;

/** Row 1, left: the search box with a small x that clears it. */
function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="md:col-span-5 lg:col-span-5 relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-lira-muted" />
      <input
        type="text"
        placeholder="Search key (AI-18), title, description, or label…"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full pl-9 pr-8 py-2 text-xs bg-gray-50/70 border border-lira-border rounded-lg focus:outline-none focus:bg-white focus:border-lira-blue focus:ring-1 focus:ring-lira-blue transition-all"
      />
      {value && <button onClick={() => onChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>}
    </div>
  );
}

/** Row 1, middle: the quick presets, each with how many tickets it shows. */
function PresetButtons({ active, counts, onApply }: { active: string; counts: FiltersState['presetCounts']; onApply: (id: string) => void }) {
  return (
    <div className="md:col-span-5 lg:col-span-5 flex items-center gap-1.5 overflow-x-auto py-0.5">
      {PRESETS.map(preset => {
        const isActive = active === preset.id;
        return (
          <button
            key={preset.id}
            onClick={() => onApply(preset.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${isActive ? 'bg-lira-blue text-white shadow-xs' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
          >
            <span>{preset.icon}</span>
            <span>{preset.label}</span>
            <span className={`text-3xs px-1.5 py-0.2 rounded-full font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>{counts[preset.key]}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Row 1, right: "N of M" and a Reset button while any filter is on. */
function ResultCount({ shown, total, filters, onReset }: { shown: number; total: number; filters: number; onReset: () => void }) {
  return (
    <div className="md:col-span-2 lg:col-span-2 flex items-center justify-end gap-2 text-xs">
      <span className="text-lira-muted text-2xs whitespace-nowrap"><strong className="text-lira-text font-bold">{shown}</strong> of {total}</span>
      {filters > 0 && (
        <button onClick={onReset} className="flex items-center gap-1 text-red-600 hover:text-red-700 font-semibold px-2 py-1 hover:bg-red-50 rounded transition-colors cursor-pointer text-xs">
          <X className="w-3 h-3" />Reset
        </button>
      )}
    </div>
  );
}

/** The Tags & Team panel: a team picker and one button per label, each shown only when there is something to pick. */
function TagsPanel({ s }: { s: FiltersState }) {
  return (
    <>
      {s.allTeams.length > 0 && (
        <div>
          <div className={`${HEADING} mb-1`}>Team Filter</div>
          <select value={s.selectedTeam} onChange={e => s.setSelectedTeam(e.target.value)} className="w-full bg-gray-50 text-gray-700 rounded-lg p-1.5 text-xs border border-gray-200">
            <option value="all">All Teams</option>
            {s.allTeams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}
      {s.allLabels.length > 0 && (
        <div>
          <div className={`${HEADING} mb-1`}>Labels / Tags</div>
          <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
            {s.allLabels.map(lbl => (
              <button
                key={lbl}
                type="button"
                onClick={() => toggle(s.setSelectedLabels, lbl)}
                className={`px-2 py-0.5 rounded text-2xs font-mono transition-colors cursor-pointer ${s.selectedLabels.includes(lbl) ? 'bg-indigo-600 text-white font-bold' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
              >
                #{lbl}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

const icon = (I: typeof Layers) => <I className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />;

/** Row 2: one dropdown per facet. */
function FacetRow({ s }: { s: FiltersState }) {
  const facet = { open: s.openDropdown, onToggle: s.setOpenDropdown };
  const tags = tagCount(s.selectedLabels, s.selectedTeam);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 p-3 bg-gray-50/70 text-xs">
      <Facet {...facet} id="space" active={s.selectedSpaces.length > 0} icon={icon(Layers)} width="w-56" panelClass="p-2 space-y-1 max-h-56 overflow-y-auto" summary={spaceSummary(s.selectedSpaces, s.spaceMap)}>
        <Heading>Filter by Space</Heading>
        {s.spaces.map(sp => (
          <Choice key={sp.id} active={s.selectedSpaces.includes(sp.id!)} onClick={() => toggle(s.setSelectedSpaces, sp.id!)}>
            <span className="flex items-center gap-2 truncate"><span>{sp.icon}</span><span className="truncate">{sp.name}</span></span>
          </Choice>
        ))}
      </Facet>

      <Facet {...facet} id="status" active={s.selectedStatuses.length > 0} icon={icon(Clock)} width="w-48" summary={statusSummary(s.selectedStatuses)}>
        <Heading>Filter by Status</Heading>
        {STATUSES.map(st => (
          <Choice key={st.id} active={s.selectedStatuses.includes(st.id)} onClick={() => toggle(s.setSelectedStatuses, st.id)}>
            <span className={`px-1.5 py-0.2 rounded text-3xs font-semibold ${st.color}`}>{st.label}</span>
          </Choice>
        ))}
      </Facet>

      <Facet {...facet} id="priority" active={s.selectedPriorities.length > 0} width="w-44" summary={prioritySummary(s.selectedPriorities)}>
        <Heading>Priority Tier</Heading>
        {PRIORITIES.map(p => (
          <Choice key={p} active={s.selectedPriorities.includes(p)} onClick={() => toggle(s.setSelectedPriorities, p)}>
            <span className="inline-flex items-center gap-1.5"><PriorityIcon priority={p} />{capital(p)}</span>
          </Choice>
        ))}
      </Facet>

      <Facet {...facet} id="type" active={s.selectedTypes.length > 0} width="w-44" summary={typeSummary(s.selectedTypes)}>
        <Heading>Work Item Type</Heading>
        {TYPES.map(t => (
          <Choice key={t} active={s.selectedTypes.includes(t)} onClick={() => toggle(s.setSelectedTypes, t)}>
            <span className="inline-flex items-center gap-1.5"><TypeIcon type={t} />{capital(t)}</span>
          </Choice>
        ))}
      </Facet>

      <Facet {...facet} id="assignee" active={s.selectedAssignees.length > 0} icon={icon(UserIcon)} width="w-52" panelClass="p-2 space-y-1 max-h-56 overflow-y-auto" summary={assigneeSummary(s.selectedAssignees)}>
        <Heading>Assignee</Heading>
        {s.allAssignees.map(init => (
          <Choice key={init} active={s.selectedAssignees.includes(init)} onClick={() => toggle(s.setSelectedAssignees, init)}>
            <div className="flex items-center gap-2">
              <Avatar initials={init} size="xs" color={init === 'VY' ? PALETTE.brand : PALETTE.textMuted} />
              <span>{init === 'VY' ? 'Varun Tej (VY)' : init}</span>
            </div>
          </Choice>
        ))}
      </Facet>

      <Facet {...facet} id="tags" align="right" active={tags > 0} icon={icon(Tag)} width="w-60" panelClass="p-2.5 space-y-2.5 max-h-64 overflow-y-auto" summary={tagSummary(tags)}>
        <TagsPanel s={s} />
      </Facet>
    </div>
  );
}

/** Search box and the filter dropdowns. */
export function FilterControls(s: FiltersState) {
  return (
    <div className="bg-white border border-lira-border rounded-xl shadow-xs overflow-visible">
      {/* Row 1: search, the quick filters, and the count */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-3.5 border-b border-lira-border">
        <SearchField value={s.searchQuery} onChange={s.setSearchQuery} />
        <PresetButtons active={s.activePreset} counts={s.presetCounts} onApply={s.applyPreset} />
        <ResultCount shown={s.filteredIssues.length} total={s.issues.length} filters={s.activeFiltersCount} onReset={s.clearAllFilters} />
      </div>
      <FacetRow s={s} />
    </div>
  );
}
