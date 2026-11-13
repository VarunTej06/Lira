import { AnimatedValue } from '../common/motion';
import { confirmDialog, promptDialog } from '../common/dialogStore';
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Layers, Map, Plus, Search, Target } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { useRoadmaps } from '../../hooks/useRoadmaps';
import { duplicateRoadmap, roadmapSpan, summarize, type Roadmap } from '../../utils/roadmapUtils';
import { NewRoadmapModal } from './RoadmapModals';
import { RoadmapCard } from './RoadmapCard';
import { homeTotals, visibleCards, type Sort, type Tab } from './roadmapHomeRules';
import { currentTime } from '../../utils/clock';

const select = 'border border-lira-border rounded-lg px-2.5 py-1.5 text-xs bg-lira-surface text-lira-text focus:outline-none focus:ring-2 focus:ring-lira-blue/40 cursor-pointer';
const TABS: Tab[] = ['active', 'starred', 'archived'];

interface Props { issues: Issue[]; spaces: Space[]; onOpen: (id: string) => void }

type Totals = ReturnType<typeof homeTotals>;

/** The four numbers above the cards. */
function Tiles({ totals }: { totals: Totals }) {
  const tiles = [
    { label: 'Roadmaps', value: totals.roadmaps, sub: `${totals.counts.archived} archived`, icon: <Map className="w-4 h-4" />, tone: 'text-orange-600 bg-orange-50' },
    { label: 'Epics planned', value: totals.items, sub: 'across all roadmaps', icon: <Layers className="w-4 h-4" />, tone: 'text-violet-600 bg-violet-50' },
    { label: 'Average progress', value: `${totals.percent}%`, sub: 'weighted by duration', icon: <Target className="w-4 h-4" />, tone: 'text-lira-blue bg-lira-blue-light' },
    { label: 'Needs attention', value: totals.attention, sub: 'late or blocked epics', icon: <AlertTriangle className="w-4 h-4" />, tone: 'text-amber-600 bg-amber-50' },
  ];
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {tiles.map(t => (
        <div key={t.label} className="rounded-2xl border border-lira-border bg-lira-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-lira-muted">{t.label}</span>
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.tone}`}>{t.icon}</span>
          </div>
          <div className="text-2xl font-semibold text-lira-text mt-1"><AnimatedValue value={t.value} /></div>
          <div className="text-2xs text-lira-muted">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ none, onCreate }: { none: boolean; onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-lira-border bg-lira-surface py-14 text-center">
      <Map className="w-9 h-9 mx-auto text-lira-muted mb-2" />
      <p className="text-sm text-lira-text font-medium">{none ? 'No roadmaps yet' : 'No roadmaps match'}</p>
      <p className="text-xs text-lira-muted mt-1">{none ? 'Create one, or start from the Lira product roadmap template.' : 'Try another tab or search.'}</p>
      {none && <button onClick={onCreate} className="mt-4 px-4 py-2 text-sm font-semibold bg-lira-blue text-lira-on-blue rounded-lg cursor-pointer">Create roadmap</button>}
    </div>
  );
}

/** All roadmaps as cards. Create, star, rename, duplicate, archive or delete here; open one to see its views. */
export const RoadmapsHome: React.FC<Props> = ({ issues, spaces, onOpen }) => {
  const { roadmaps, update, add, remove } = useRoadmaps();
  const [tab, setTab] = useState<Tab>('active');
  const [sort, setSort] = useState<Sort>('updated');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const today = useMemo(() => currentTime(), []);

  const cards = useMemo(() => roadmaps.map(rm => ({ rm, summary: summarize(rm, issues, today), span: roadmapSpan(rm) })), [roadmaps, issues, today]);
  const visible = useMemo(() => visibleCards(cards, tab, sort, search), [cards, tab, sort, search]);
  const totals = homeTotals(cards);

  const patch = (rm: Roadmap, p: Partial<Roadmap>) => update(rm.id, r => ({ ...r, ...p }));
  const rename = async (rm: Roadmap) => {
    setMenuFor(null);
    const name = await promptDialog({ title: 'Rename roadmap', label: 'Name', defaultValue: rm.name, confirmLabel: 'Rename' });
    if (name) patch(rm, { name });
  };
  const askDelete = async (rm: Roadmap) => {
    setMenuFor(null);
    if (await confirmDialog({ title: 'Delete roadmap', message: `Delete the roadmap "${rm.name}"? Its epics stay in Lira.`, confirmLabel: 'Delete roadmap', tone: 'danger' })) remove(rm.id);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-lira-bg" onClick={() => setMenuFor(null)}>
      <div className="max-w-[1400px] mx-auto p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-lira-text flex items-center gap-2"><Map className="w-5 h-5 text-orange-500" /> Roadmaps</h1>
            <p className="text-xs text-lira-muted mt-0.5">Plan work over time. Every item on a roadmap is an epic in Lira. Open a roadmap for the timeline, planner, Now/Next/Later and table views.</p>
          </div>
          <button onClick={() => setShowNew(true)} className="text-sm px-4 py-2 bg-lira-blue text-lira-on-blue rounded-lg hover:bg-lira-blue-hover cursor-pointer flex items-center gap-1.5 font-semibold"><Plus className="w-4 h-4" /> Create roadmap</button>
        </div>

        <Tiles totals={totals} />

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-lira-border overflow-hidden bg-lira-surface">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-xs capitalize cursor-pointer ${tab === t ? 'bg-lira-blue text-lira-on-blue' : 'text-lira-text hover:bg-lira-bg'}`}>{t} <span className="opacity-70">{totals.counts[t]}</span></button>
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
          <EmptyState none={cards.length === 0} onCreate={() => setShowNew(true)} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map(card => (
              <RoadmapCard
                key={card.rm.id} card={card} space={spaces.find(s => s.key === card.rm.spaceKey)} menuOpen={menuFor === card.rm.id}
                onOpen={() => onOpen(card.rm.id)} onToggleStar={() => patch(card.rm, { starred: !card.rm.starred })}
                onToggleMenu={() => setMenuFor(menuFor === card.rm.id ? null : card.rm.id)}
                onRename={() => void rename(card.rm)} onDelete={() => void askDelete(card.rm)}
                onDuplicate={() => { setMenuFor(null); add(duplicateRoadmap(card.rm)); }}
                onToggleArchive={() => { setMenuFor(null); patch(card.rm, { archived: !card.rm.archived }); }}
              />
            ))}
          </div>
        )}
      </div>
      {showNew && <NewRoadmapModal spaces={spaces} onClose={() => setShowNew(false)} onCreate={rm => { add(rm); setShowNew(false); onOpen(rm.id); }} />}
    </div>
  );
};
