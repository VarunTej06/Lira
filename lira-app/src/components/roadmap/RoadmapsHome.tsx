import { roadmapLink } from '../../utils/links';
import { confirmDialog, promptDialog } from '../common/dialogs';
import React, { useMemo, useState } from 'react';
import {
  Archive, ArchiveRestore, CalendarRange, Copy, Flag, Layers, Map, MoreHorizontal, Pencil, Plus, Search, Star, Target, Trash2, AlertTriangle,
} from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { useRoadmaps } from '../../hooks/useRoadmaps';
import { STATUS_META, duplicateRoadmap, fmtShort, laneColor, roadmapSpan, summarize, type Roadmap, type RoadmapStatus } from '../../utils/roadmapUtils';
import { NewRoadmapModal } from './RoadmapModals';

type Tab = 'active' | 'starred' | 'archived';
type Sort = 'updated' | 'name' | 'progress';
const select = 'border border-lira-border rounded-lg px-2.5 py-1.5 text-xs bg-lira-surface text-lira-text focus:outline-none focus:ring-2 focus:ring-lira-blue/40 cursor-pointer';

interface Props { issues: Issue[]; spaces: Space[]; onOpen: (id: string) => void }

/** All roadmaps as cards. Create, star, rename, duplicate, archive or delete here; open one to see its views. */
export const RoadmapsHome: React.FC<Props> = ({ issues, spaces, onOpen }) => {
  const { roadmaps, update, add, remove } = useRoadmaps();
  const [tab, setTab] = useState<Tab>('active');
  const [sort, setSort] = useState<Sort>('updated');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const today = useMemo(() => new Date(), []);

  const cards = useMemo(() => roadmaps.map(rm => ({ rm, summary: summarize(rm, issues, today), span: roadmapSpan(rm) })), [roadmaps, issues, today]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards
      .filter(c => (tab === 'archived' ? !!c.rm.archived : !c.rm.archived && (tab === 'starred' ? !!c.rm.starred : true)))
      .filter(c => !q || `${c.rm.name} ${c.rm.description || ''} ${c.rm.spaceKey || ''}`.toLowerCase().includes(q))
      .sort((a, b) => sort === 'name' ? a.rm.name.localeCompare(b.rm.name)
        : sort === 'progress' ? b.summary.percent - a.summary.percent
        : (b.rm.updatedAt || b.rm.createdAt).localeCompare(a.rm.updatedAt || a.rm.createdAt));
  }, [cards, tab, sort, search]);

  const active = cards.filter(c => !c.rm.archived);
  const totals = {
    roadmaps: active.length,
    items: active.reduce((a, c) => a + c.summary.total, 0),
    percent: active.length ? Math.round(active.reduce((a, c) => a + c.summary.percent, 0) / active.length) : 0,
    attention: active.reduce((a, c) => a + c.summary.overdue + c.summary.byStatus.blocked, 0),
  };
  const counts = { active: active.length, starred: active.filter(c => c.rm.starred).length, archived: cards.length - active.length };

  const patch = (rm: Roadmap, p: Partial<Roadmap>) => update(rm.id, r => ({ ...r, ...p }));

  const tiles = [
    { label: 'Roadmaps', value: totals.roadmaps, sub: `${counts.archived} archived`, icon: <Map className="w-4 h-4" />, tone: 'text-orange-600 bg-orange-50' },
    { label: 'Epics planned', value: totals.items, sub: 'across all roadmaps', icon: <Layers className="w-4 h-4" />, tone: 'text-violet-600 bg-violet-50' },
    { label: 'Average progress', value: `${totals.percent}%`, sub: 'weighted by duration', icon: <Target className="w-4 h-4" />, tone: 'text-lira-blue bg-blue-50' },
    { label: 'Needs attention', value: totals.attention, sub: 'late or blocked epics', icon: <AlertTriangle className="w-4 h-4" />, tone: 'text-amber-600 bg-amber-50' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-lira-bg" onClick={() => setMenuFor(null)}>
      <div className="max-w-[1400px] mx-auto p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-lira-text flex items-center gap-2"><Map className="w-5 h-5 text-orange-500" /> Roadmaps</h1>
            <p className="text-xs text-lira-muted mt-0.5">Plan work over time. Every item on a roadmap is an epic in Lira. Open a roadmap for the timeline, planner, Now/Next/Later and table views.</p>
          </div>
          <button onClick={() => setShowNew(true)} className="text-sm px-4 py-2 bg-lira-blue text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-1.5 font-semibold"><Plus className="w-4 h-4" /> Create roadmap</button>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {tiles.map(t => (
            <div key={t.label} className="rounded-2xl border border-lira-border bg-lira-surface p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-lira-muted">{t.label}</span>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.tone}`}>{t.icon}</span>
              </div>
              <div className="text-2xl font-semibold text-lira-text mt-1">{t.value}</div>
              <div className="text-[11px] text-lira-muted">{t.sub}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-lira-border overflow-hidden bg-lira-surface">
            {(['active', 'starred', 'archived'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-xs capitalize cursor-pointer ${tab === t ? 'bg-lira-blue text-white' : 'text-lira-text hover:bg-lira-bg'}`}>{t} <span className="opacity-70">{counts[t]}</span></button>
            ))}
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-lira-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search roadmaps" className={`${select} pl-8 w-52`} />
          </div>
          <select className={`${select} ml-auto`} value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Sort roadmaps">
            <option value="updated">Recently updated</option><option value="name">Name</option><option value="progress">Progress</option>
          </select>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-lira-border bg-lira-surface py-14 text-center">
            <Map className="w-9 h-9 mx-auto text-lira-muted mb-2" />
            <p className="text-sm text-lira-text font-medium">{cards.length === 0 ? 'No roadmaps yet' : 'No roadmaps match'}</p>
            <p className="text-xs text-lira-muted mt-1">{cards.length === 0 ? 'Create one, or start from the Lira product roadmap template.' : 'Try another tab or search.'}</p>
            {cards.length === 0 && <button onClick={() => setShowNew(true)} className="mt-4 px-4 py-2 text-sm font-semibold bg-lira-blue text-white rounded-lg cursor-pointer">Create roadmap</button>}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map(({ rm, summary, span }) => {
              const space = spaces.find(s => s.key === rm.spaceKey);
              return (
                <div
                  key={rm.id}
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); onOpen(rm.id); }} {...roadmapLink(rm.id)}
                  onKeyDown={e => { if (e.key === 'Enter') onOpen(rm.id); }}
                  className={`group relative rounded-2xl border border-lira-border bg-lira-surface p-4 cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all ${rm.archived ? 'opacity-75' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/15 text-orange-500 flex items-center justify-center flex-shrink-0"><Map className="w-4.5 h-4.5" /></div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-lira-text truncate">{rm.name}</h3>
                      <div className="text-[11px] text-lira-muted flex items-center gap-1.5 mt-0.5">
                        {space ? <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{space.name}</span> : <span>No space</span>}
                        {rm.archived && <span className="px-1.5 rounded-full bg-lira-border/60">Archived</span>}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); patch(rm, { starred: !rm.starred }); }} className={`p-1 rounded-md cursor-pointer ${rm.starred ? 'text-yellow-400' : 'text-lira-muted opacity-0 group-hover:opacity-100'} hover:bg-lira-bg`} aria-label={rm.starred ? 'Remove star' : 'Star roadmap'}>
                      <Star className={`w-4 h-4 ${rm.starred ? 'fill-yellow-400' : ''}`} />
                    </button>
                    <div className="relative">
                      <button onClick={e => { e.stopPropagation(); setMenuFor(menuFor === rm.id ? null : rm.id); }} className="p-1 rounded-md text-lira-muted hover:text-lira-text hover:bg-lira-bg cursor-pointer" aria-label="Roadmap actions"><MoreHorizontal className="w-4 h-4" /></button>
                      {menuFor === rm.id && (
                        <div className="absolute right-0 mt-1 w-44 rounded-lg border border-lira-border bg-lira-surface shadow-dropdown z-30 py-1 text-xs" onClick={e => e.stopPropagation()}>
                          <MenuItem icon={<Pencil className="w-3.5 h-3.5" />} label="Rename" onClick={async () => { setMenuFor(null); const n = await promptDialog({ title: 'Rename roadmap', label: 'Name', defaultValue: rm.name, confirmLabel: 'Rename' }); if (n) patch(rm, { name: n }); }} />
                          <MenuItem icon={<Copy className="w-3.5 h-3.5" />} label="Duplicate" onClick={() => { setMenuFor(null); add(duplicateRoadmap(rm)); }} />
                          <MenuItem icon={rm.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />} label={rm.archived ? 'Unarchive' : 'Archive'} onClick={() => { setMenuFor(null); patch(rm, { archived: !rm.archived }); }} />
                          <MenuItem danger icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete" onClick={async () => { setMenuFor(null); if (await confirmDialog({ title: 'Delete roadmap', message: `Delete the roadmap "${rm.name}"? Its epics stay in Lira.`, confirmLabel: 'Delete roadmap', tone: 'danger' })) remove(rm.id); }} />
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-lira-muted mt-2 line-clamp-2 min-h-[32px]">{rm.description || 'No description'}</p>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] mb-1"><span className="text-lira-muted">{summary.byStatus.done} of {summary.total} epics done</span><span className="font-semibold text-lira-text">{summary.percent}%</span></div>
                    <div className="h-1.5 rounded-full bg-lira-border/60 overflow-hidden"><div className="h-full rounded-full bg-lira-blue" style={{ width: `${summary.percent}%` }} /></div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(Object.keys(STATUS_META) as RoadmapStatus[]).filter(s => summary.byStatus[s] > 0).map(s => (
                      <span key={s} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: STATUS_META[s].color + '22', color: STATUS_META[s].color }}>{summary.byStatus[s]} {STATUS_META[s].label.toLowerCase()}</span>
                    ))}
                    {summary.total === 0 && <span className="text-[10px] text-lira-muted">Empty roadmap</span>}
                  </div>

                  <div className="flex items-center gap-1 mt-3">
                    {rm.lanes.slice(0, 8).map(l => <span key={l} className="w-2 h-2 rounded-sm" style={{ background: laneColor(rm, l) }} title={l} />)}
                    <span className="text-[10px] text-lira-muted ml-1">{rm.lanes.length} lanes</span>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-lira-border/60 text-[11px] text-lira-muted">
                    <span className="flex items-center gap-1"><CalendarRange className="w-3 h-3" />{span.start ? `${fmtShort(span.start)} → ${fmtShort(span.end!)}` : 'No dates'}</span>
                    {summary.nextMilestone && <span className="flex items-center gap-1 truncate max-w-[50%]" title={summary.nextMilestone.title}><Flag className="w-3 h-3" />{summary.daysToNextMilestone === 0 ? 'today' : `${summary.daysToNextMilestone}d`}: {summary.nextMilestone.title}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {showNew && <NewRoadmapModal spaces={spaces} onClose={() => setShowNew(false)} onCreate={rm => { add(rm); setShowNew(false); onOpen(rm.id); }} />}
    </div>
  );
};

const MenuItem: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }> = ({ icon, label, onClick, danger }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer ${danger ? 'text-red-500 hover:bg-red-500/10' : 'text-lira-text hover:bg-lira-bg'}`}>{icon}{label}</button>
);
