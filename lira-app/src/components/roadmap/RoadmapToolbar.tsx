import type { ReactNode } from 'react';
import { CalendarRange, ChevronsDownUp, ChevronsUpDown, GanttChartSquare, GitBranch, LayoutGrid, Rows3, Search } from 'lucide-react';
import { STATUS_META, type Roadmap, type RoadmapStatus, type Zoom } from '../../utils/roadmapUtils';
import type { RoadmapFilter } from '../../utils/roadmapFilter';

export type RoadmapView = 'timeline' | 'planner' | 'horizon' | 'table';
export interface RoadmapPrefs { view: RoadmapView; zoom: Zoom; showDeps: boolean; collapsed: string[] }

const SELECT = 'border border-lira-border rounded-lg px-2.5 py-1.5 text-xs bg-lira-surface text-lira-text focus:outline-none focus:ring-2 focus:ring-lira-blue/40 cursor-pointer';
const GHOST = 'px-2.5 py-1.5 text-xs rounded-lg border border-lira-border bg-lira-surface text-lira-text hover:bg-lira-bg cursor-pointer';
const VIEWS: { key: RoadmapView; label: string; icon: ReactNode }[] = [
  { key: 'timeline', label: 'Timeline', icon: <GanttChartSquare className="w-3.5 h-3.5" /> },
  { key: 'planner', label: 'Planner', icon: <CalendarRange className="w-3.5 h-3.5" /> },
  { key: 'horizon', label: 'Now / Next / Later', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
  { key: 'table', label: 'Table', icon: <Rows3 className="w-3.5 h-3.5" /> },
];

interface Props {
  roadmap: Roadmap;
  owners: string[];
  prefs: RoadmapPrefs;
  setPrefs: (patch: Partial<RoadmapPrefs>) => void;
  filter: RoadmapFilter;
  setFilter: (patch: Partial<RoadmapFilter>) => void;
  onToday: () => void;
}

/** View tabs, search, filters and (for the timeline and planner) zoom, dependencies, lanes and Today. */
export function RoadmapToolbar({ roadmap, owners, prefs, setPrefs, filter, setFilter, onToday }: Props) {
  const allCollapsed = roadmap.lanes.length > 0 && roadmap.lanes.every(l => prefs.collapsed.includes(l));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-lira-border overflow-hidden bg-lira-surface">
        {VIEWS.map(v => (
          <button key={v.key} onClick={() => setPrefs({ view: v.key })} className={`px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${prefs.view === v.key ? 'bg-lira-blue text-lira-on-blue' : 'text-lira-text hover:bg-lira-bg'}`}>{v.icon}{v.label}</button>
        ))}
      </div>
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-lira-muted" />
        <input value={filter.search} onChange={e => setFilter({ search: e.target.value })} placeholder="Search roadmap" className={`${SELECT} pl-8 w-44`} />
      </div>
      <select className={SELECT} value={filter.period} onChange={e => setFilter({ period: e.target.value as RoadmapFilter['period'] })} aria-label="Period">
        <option value="all">All time</option><option value="month">This month</option><option value="quarter">This quarter</option>
      </select>
      <select className={SELECT} value={filter.status} onChange={e => setFilter({ status: e.target.value as RoadmapFilter['status'] })} aria-label="Status">
        <option value="all">All statuses</option>
        {(Object.keys(STATUS_META) as RoadmapStatus[]).map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
      </select>
      <select className={SELECT} value={filter.lane} onChange={e => setFilter({ lane: e.target.value })} aria-label="Lane">
        <option value="all">All lanes</option>{roadmap.lanes.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      {owners.length > 1 && (
        <select className={SELECT} value={filter.owner} onChange={e => setFilter({ owner: e.target.value })} aria-label="Owner">
          <option value="all">All owners</option>{owners.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      {(prefs.view === 'timeline' || prefs.view === 'planner') && (
        <div className="flex items-center gap-2 ml-auto">
          {prefs.view === 'timeline' && (
            <>
              <div className="flex rounded-lg border border-lira-border overflow-hidden bg-lira-surface">
                {(['weeks', 'months', 'quarters'] as Zoom[]).map(z => (
                  <button key={z} onClick={() => setPrefs({ zoom: z })} className={`px-2.5 py-1.5 text-xs capitalize cursor-pointer ${prefs.zoom === z ? 'bg-lira-blue text-lira-on-blue' : 'text-lira-text hover:bg-lira-bg'}`}>{z}</button>
                ))}
              </div>
              <button onClick={() => setPrefs({ showDeps: !prefs.showDeps })} className={`px-2.5 py-1.5 text-xs rounded-lg border cursor-pointer flex items-center gap-1.5 ${prefs.showDeps ? 'border-lira-blue text-lira-blue bg-lira-blue-light' : 'border-lira-border text-lira-text bg-lira-surface'}`}><GitBranch className="w-3.5 h-3.5" /> Dependencies</button>
            </>
          )}
          <button onClick={() => setPrefs({ collapsed: allCollapsed ? [] : [...roadmap.lanes] })} className={`${GHOST} flex items-center gap-1.5`}>
            {allCollapsed ? <ChevronsUpDown className="w-3.5 h-3.5" /> : <ChevronsDownUp className="w-3.5 h-3.5" />}{allCollapsed ? 'Expand lanes' : 'Collapse lanes'}
          </button>
          <button onClick={onToday} className={GHOST}>Today</button>
        </div>
      )}
    </div>
  );
}
