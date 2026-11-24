import { Copy, Lightbulb, Link2, Network, Plus, Search, Star, Timer, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStoredList } from '../../hooks/useStoredList';
import { currentTime, currentTimeMs } from '../../utils/clock';
import { copyOf, mindStats, visibleMaps, type MindSort, type MindTab } from '../../utils/mindOverview';
import type { MindMap } from '../../utils/mindmap';
import { AnimatedValue, CountUp } from '../common/motion';
import { confirmDialog } from '../common/dialogStore';
import { MindThumb } from './MindThumb';
import { NewMindMapModal } from './NewMindMapModal';

const KEY = 'lira_mindmaps';
const dateOf = (iso: string): string => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const ICON_BTN = 'p-1.5 rounded-lg text-lira-muted hover:bg-gray-100 hover:text-lira-text cursor-pointer';

function MapCard({ map, onOpen, onStar, onCopy, onDelete }: { map: MindMap; onOpen: () => void; onStar: () => void; onCopy: () => void; onDelete: () => void }) {
  const tickets = map.nodes.filter(n => n.ticketKey).length;
  return (
    <article aria-label={map.name} className="bg-white border border-lira-border rounded-2xl overflow-hidden flex flex-col">
      <button type="button" onClick={onOpen} aria-label={`Open ${map.name}`} className="h-36 bg-lira-bg border-b border-lira-border p-2 cursor-pointer hover:bg-gray-50"><MindThumb nodes={map.nodes} shapes={map.shapes} /></button>
      <div className="p-4 space-y-2 flex-1">
        <div className="flex items-start gap-2">
          <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left text-sm font-semibold text-lira-text truncate cursor-pointer hover:text-lira-blue">{map.name}</button>
          <button type="button" aria-pressed={!!map.starred} aria-label={map.starred ? `Remove the star from ${map.name}` : `Star ${map.name}`} onClick={onStar} className={ICON_BTN}><Star className={`w-4 h-4 ${map.starred ? 'fill-amber-400 text-amber-500' : ''}`} /></button>
        </div>
        <div className="flex flex-wrap gap-2 text-3xs">
          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{map.nodes.length} ideas</span>
          {tickets > 0 && <span className="px-2 py-0.5 rounded-full bg-lira-blue-light text-lira-blue font-medium">{tickets} linked to tickets</span>}
        </div>
      </div>
      <footer className="flex items-center gap-1 px-4 py-2 border-t border-lira-border text-2xs text-lira-muted">
        <span className="flex-1 truncate">Changed {dateOf(map.updatedAt)}{map.createdBy ? `, made by ${map.createdBy}` : ''}</span>
        <button type="button" aria-label={`Copy ${map.name}`} title="Make a copy" onClick={onCopy} className={ICON_BTN}><Copy className="w-3.5 h-3.5" /></button>
        <button type="button" aria-label={`Delete ${map.name}`} title="Delete" onClick={onDelete} className={ICON_BTN}><Trash2 className="w-3.5 h-3.5" /></button>
      </footer>
    </article>
  );
}

/** Storyboards: the numbers, then every map as a card with a small picture of it. A map opens as its own page. */
export function MindMapsPage() {
  const [maps, saveMaps] = useStoredList<MindMap>(KEY);
  const navigate = useNavigate();
  const [tab, setTab] = useState<MindTab>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<MindSort>('updated');
  const [creating, setCreating] = useState(false);
  const stats = mindStats(maps, currentTimeMs());
  const shown = visibleMaps(maps, tab, query, sort);
  const starred = maps.filter(m => m.starred).length;
  const tiles = [
    { label: 'Storyboards', value: stats.maps, sub: `${starred} starred`, icon: <Network className="w-4 h-4" />, tone: 'text-lira-blue bg-lira-blue-light' },
    { label: 'Ideas', value: stats.ideas, sub: 'across every map', icon: <Lightbulb className="w-4 h-4" />, tone: 'text-amber-600 bg-amber-50' },
    { label: 'Linked to tickets', value: stats.tickets, sub: 'ideas that stand for a ticket', icon: <Link2 className="w-4 h-4" />, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Changed this week', value: stats.recent, sub: 'in the last seven days', icon: <Timer className="w-4 h-4" />, tone: 'text-teal-600 bg-teal-50' },
  ];

  async function remove(m: MindMap) {
    if (!(await confirmDialog({ title: `Delete "${m.name}"?`, message: 'The whole storyboard is deleted. This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' }))) return;
    saveMaps(maps.filter(x => x.id !== m.id));
  }
  const copy = (m: MindMap) => { const made = copyOf(m, () => crypto.randomUUID(), currentTime().toISOString()); saveMaps([...maps, made]); navigate(`/mindmaps/${made.id}`); };

  return (
    <div className="flex-1 overflow-y-auto bg-lira-bg">
      <div className="max-w-6xl mx-auto p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-lira-text flex items-center gap-2"><Network className="w-5 h-5 text-lira-blue" /> Storyboards</h1>
            <p className="text-xs text-lira-muted mt-0.5">Think a topic through: a central idea, branches around it, and a ticket on any idea. Open a map to edit it on its own page.</p>
          </div>
          <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-xl bg-lira-blue text-lira-on-blue hover:bg-lira-blue-hover cursor-pointer"><Plus className="w-3.5 h-3.5" /> New storyboard</button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {tiles.map(t => (
            <div key={t.label} className="bg-white border border-lira-border rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${t.tone}`}>{t.icon}</span>
              <div className="min-w-0">
                <div className="text-2xl font-semibold text-lira-text leading-none"><AnimatedValue value={<CountUp value={t.value} />} /></div>
                <div className="text-2xs text-lira-muted mt-1">{t.label}</div>
                <div className="text-3xs text-lira-muted truncate">{t.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Show" className="inline-flex rounded-xl border border-lira-border overflow-hidden text-xs">
            {([['all', `All ${maps.length}`], ['starred', `Starred ${starred}`]] as const).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={tab === v} onClick={() => setTab(v)} className={`px-3 py-1.5 cursor-pointer ${tab === v ? 'bg-lira-blue text-lira-on-blue' : 'bg-white text-lira-muted hover:text-lira-text'}`}>{label}</button>
            ))}
          </div>
          <label className="relative"><Search className="w-3.5 h-3.5 text-lira-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input type="search" aria-label="Search storyboards" placeholder="Search storyboards" value={query} onChange={e => setQuery(e.target.value)} className="w-56 text-sm border border-lira-border rounded-xl pl-8 pr-3 py-1.5 bg-white text-lira-text focus:outline-none focus:border-lira-blue" /></label>
          <select aria-label="Sort" value={sort} onChange={e => setSort(e.target.value as MindSort)} className="ml-auto text-sm border border-lira-border rounded-xl px-3 py-1.5 bg-white text-lira-text">
            <option value="updated">Recently changed</option><option value="name">Name</option><option value="ideas">Most ideas</option>
          </select>
        </div>

        {shown.length === 0 ? (
          <div className="bg-white border border-lira-border rounded-2xl px-4 py-12 text-center text-xs text-lira-muted">
            {maps.length === 0 ? 'Make your first storyboard to start.' : tab === 'starred' && !query ? 'Star a map to find it here.' : 'No storyboard matches.'}
          </div>
        ) : (
          <div aria-label="Storyboards" role="list" className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {shown.map(m => <div key={m.id} role="listitem"><MapCard map={m} onOpen={() => navigate(`/mindmaps/${m.id}`)} onStar={() => saveMaps(maps.map(x => (x.id === m.id ? { ...x, starred: !x.starred } : x)))} onCopy={() => copy(m)} onDelete={() => { void remove(m); }} /></div>)}
          </div>
        )}
      </div>
      <NewMindMapModal isOpen={creating} onClose={() => setCreating(false)} onCreate={made => { saveMaps([...maps, made]); setCreating(false); navigate(`/mindmaps/${made.id}`); }} />
    </div>
  );
}
