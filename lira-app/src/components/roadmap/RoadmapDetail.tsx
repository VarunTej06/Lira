import { notifySaved } from '../common/SavedToast';
import { confirmDialog, promptDialog } from '../common/dialogs';
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, Download, Flag, 
  Layers, Map, MoreHorizontal, Plus, X,
} from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { useRoadmaps } from '../../hooks/useRoadmaps';
import {
  dependencyIssues, fmtDay, itemChecklist, newId, summarize, toCsv,
  type Roadmap, type RoadmapItem,
} from '../../utils/roadmapUtils';
import { addTicketToEpic, createEpicForItem, ensureTaskForItem, setTicketDate, spaceForRoadmap, syncEpicFromItem, syncTaskFromItem } from '../../services/roadmapEpics';
import { filterRoadmapItems, type RoadmapFilter } from '../../utils/roadmapFilter';
import { RoadmapSummary } from './RoadmapSummary';
import { RoadmapToolbar, type RoadmapPrefs } from './RoadmapToolbar';
import { useEnsureEpics, type Notice } from './useEnsureEpics';
import { TimelineView } from './TimelineView';
import { PlannerView } from './PlannerView';
import { HorizonBoard } from './HorizonBoard';
import { RoadmapTable } from './RoadmapTable';
import { ItemModal, MilestoneModal, blankItem, blankMilestone, type ItemSaveOptions } from './RoadmapModals';

type Prefs = RoadmapPrefs;

const PREFS_KEY = 'lira_roadmap_prefs';
const loadPrefs = (): Prefs => {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return { view: 'timeline', zoom: 'months', showDeps: true, collapsed: [], ...p };
  } catch { return { view: 'timeline', zoom: 'months', showDeps: true, collapsed: [] }; }
};

const openIssueEvent = (issue: Issue) => window.dispatchEvent(new CustomEvent('lira-open-issue', { detail: issue }));

interface Props { roadmapId: string; issues: Issue[]; spaces: Space[]; onBack: () => void }

/** One roadmap: timeline, planner (lane > epic > tickets), Now/Next/Later and table views. */
export const RoadmapDetail: React.FC<Props> = ({ roadmapId, issues, spaces, onBack }) => {
  const { roadmaps, update, remove } = useRoadmaps();
  const roadmap: Roadmap | undefined = roadmaps.find(r => r.id === roadmapId);
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const setPrefs = (patch: Partial<Prefs>) => setPrefsState(p => {
    const next = { ...p, ...patch };
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    return next;
  });

  const [filter, setFilterState] = useState<RoadmapFilter>({ search: '', status: 'all', lane: 'all', owner: 'all', period: 'all' });
  const setFilter = (patch: Partial<RoadmapFilter>) => setFilterState(f => ({ ...f, ...patch }));
  const [editing, setEditing] = useState<{ item: RoadmapItem; isNew: boolean } | null>(null);
  const [editingMs, setEditingMs] = useState<{ ms: ReturnType<typeof blankMilestone>; isNew: boolean } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [todayKey, setTodayKey] = useState(0);
  const [notice, setNotice] = useState<Notice>(null);
  const today = useMemo(() => new Date(), []);
  const space = roadmap ? spaceForRoadmap(roadmap, spaces) : undefined;

  useEnsureEpics(roadmap, spaces, issues, space, update, setNotice);

  const summary = useMemo(() => (roadmap ? summarize(roadmap, issues, today) : undefined), [roadmap, issues, today]);
  const problems = useMemo(() => (roadmap ? dependencyIssues(roadmap.items) : []), [roadmap]);

  const items = useMemo(() => (roadmap ? filterRoadmapItems(roadmap, issues, today, filter) : []), [roadmap, issues, today, filter]);

  if (!roadmap || !summary) {
    return (
      <div className="flex-1 flex items-center justify-center bg-lira-bg">
        <div className="text-center space-y-3">
          <Map className="w-10 h-10 mx-auto text-lira-muted" />
          <p className="text-lira-muted text-sm">This roadmap no longer exists.</p>
          <button onClick={onBack} className="px-4 py-2 text-sm font-semibold bg-lira-blue text-white rounded-lg cursor-pointer">Back to roadmaps</button>
        </div>
      </div>
    );
  }

  const owners = Array.from(new Set(roadmap.items.map(i => i.owner).filter(Boolean))) as string[];

  /** Dates or length changed by dragging: save the item and push the dates to its epic. */
  const changeItem = (item: RoadmapItem) => {
    update(roadmap.id, r => ({ ...r, items: r.items.map(i => (i.id === item.id ? item : i)) }));
    void syncEpicFromItem(item);
  };

  const saveItem = async (item: RoadmapItem, opts: ItemSaveOptions) => {
    let next = item;
    try {
      if (opts.epicMode === 'new') {
        if (!space) throw new Error('This roadmap has no space to create the epic in.');
        const key = await createEpicForItem(item, space, roadmap.name);
        next = { ...item, epicKey: key };
        setNotice({ tone: 'info', text: `Created epic ${key} in ${space.name}. It is in the Backlog.` });
      } else if (opts.epicMode === 'existing' && opts.existingKey) {
        next = { ...item, epicKey: opts.existingKey };
        setNotice({ tone: 'info', text: `Linked epic ${opts.existingKey}.` });
      }
      if (opts.epicMode !== 'new') await syncEpicFromItem(next, { status: opts.statusChanged });
      // the checklist lives on one task under the epic
      if (next.epicKey && next.children.length > 0) {
        const taskKey = await ensureTaskForItem(next, roadmap.name);
        if (taskKey) { next = { ...next, taskKey }; await syncTaskFromItem(next); }
      } else if (next.taskKey) {
        await syncTaskFromItem(next);
      }
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'Could not create the epic.' });
      return;
    }
    update(roadmap.id, r => {
      const lanes = opts.newLane && !r.lanes.includes(opts.newLane) ? [...r.lanes, opts.newLane] : r.lanes;
      const exists = r.items.some(i => i.id === next.id);
      return { ...r, lanes, items: exists ? r.items.map(i => (i.id === next.id ? next : i)) : [...r.items, next] };
    });
    notifySaved('Roadmap item saved');
    setEditing(null);
  };

  const deleteItem = (id: string) => {
    update(roadmap.id, r => ({ ...r, items: r.items.filter(i => i.id !== id).map(i => ({ ...i, deps: i.deps.filter(d => d !== id) })) }));
    setEditing(null);
  };
  const openItem = (id: string) => {
    const item = roadmap.items.find(i => i.id === id);
    if (item) setEditing({ item: { ...item, children: itemChecklist(item, issues) }, isNew: false }); // ticks made on the task show here
  };
  // Opening the epic (or its task) closes the edit dialog first, so the ticket popup is not hidden behind it.
  // The roadmap page stays where it is, and is what you see again when the ticket popup closes.
  const openByKey = (key: string) => {
    const t = issues.find(i => i.key === key);
    setEditing(null);
    if (t) window.setTimeout(() => openIssueEvent(t), 0);
  };
  const saveMs = (m: ReturnType<typeof blankMilestone>) => {
    update(roadmap.id, r => ({ ...r, milestones: r.milestones.some(x => x.id === m.id) ? r.milestones.map(x => (x.id === m.id ? m : x)) : [...r.milestones, { ...m, id: m.id || newId('ms') }] }));
    setEditingMs(null);
    notifySaved('Milestone saved');
  };
  const exportCsv = () => {
    const blob = new Blob([toCsv(roadmap, issues, today)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${roadmap.name.replace(/\s+/g, '-').toLowerCase()}-${fmtDay(today)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const conflicts = problems.filter(p => p.kind !== 'missing').length;
  const toggleLane = (lane: string) => setPrefs({ collapsed: prefs.collapsed.includes(lane) ? prefs.collapsed.filter(l => l !== lane) : [...prefs.collapsed, lane] });

  return (
    <div className="flex-1 overflow-y-auto bg-lira-bg">
      <div className="max-w-[1400px] mx-auto p-6 space-y-5">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-lira-muted hover:text-lira-blue cursor-pointer mb-1.5"><ArrowLeft className="w-3.5 h-3.5" /> All roadmaps</button>
            <h1 className="text-xl font-semibold text-lira-text flex items-center gap-2 flex-wrap">
              <Map className="w-5 h-5 text-orange-500" /> {roadmap.name}
              {space ? (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300 flex items-center gap-1"><Layers className="w-3 h-3" /> Epics in {space.name}</span>
              ) : (
                <select
                  value=""
                  onChange={e => { if (e.target.value) update(roadmap.id, r => ({ ...r, spaceKey: e.target.value })); }}
                  className="text-[11px] font-semibold px-2 py-1 rounded-full border border-amber-400 bg-amber-500/10 text-amber-600 cursor-pointer"
                  aria-label="Choose the space for this roadmap's epics"
                >
                  <option value="">Choose a space for the epics…</option>
                  {spaces.map(s => <option key={s.id} value={s.key}>{s.name} ({s.key})</option>)}
                </select>
              )}
            </h1>
            <p className="text-xs text-lira-muted mt-0.5 max-w-3xl">{roadmap.description || 'Plan work over time, track progress and keep dependencies visible.'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={exportCsv} className="text-xs px-3 py-1.5 border border-lira-border rounded-lg bg-lira-surface text-lira-text hover:bg-lira-bg cursor-pointer flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Export CSV</button>
            <button onClick={() => setEditingMs({ ms: blankMilestone(today), isNew: true })} className="text-xs px-3 py-1.5 border border-lira-border rounded-lg bg-lira-surface text-lira-text hover:bg-lira-bg cursor-pointer flex items-center gap-1.5"><Flag className="w-3.5 h-3.5" /> Milestone</button>
            <button onClick={() => setEditing({ item: blankItem(roadmap, today), isNew: true })} className="text-xs px-3 py-1.5 bg-lira-blue text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-1.5 font-semibold"><Plus className="w-3.5 h-3.5" /> Add epic</button>
            <div className="relative">
              <button onClick={() => setMenuOpen(o => !o)} className="p-1.5 rounded-lg border border-lira-border bg-lira-surface text-lira-muted hover:text-lira-text cursor-pointer" aria-label="Roadmap options"><MoreHorizontal className="w-4 h-4" /></button>
              {menuOpen && (
                <div className="absolute right-0 mt-1 w-48 rounded-lg border border-lira-border bg-lira-surface shadow-dropdown z-40 py-1 text-xs" onMouseLeave={() => setMenuOpen(false)}>
                  <button className="w-full text-left px-3 py-2 hover:bg-lira-bg cursor-pointer text-lira-text" onClick={async () => { setMenuOpen(false); const n = await promptDialog({ title: 'Rename roadmap', label: 'Name', defaultValue: roadmap.name, confirmLabel: 'Rename' }); if (n) update(roadmap.id, r => ({ ...r, name: n })); }}>Rename roadmap</button>
                  <button className="w-full text-left px-3 py-2 hover:bg-lira-bg cursor-pointer text-lira-text" onClick={async () => { setMenuOpen(false); const d = await promptDialog({ title: 'Edit description', label: 'Description', defaultValue: roadmap.description || '', required: false, confirmLabel: 'Save' }); if (d !== null) update(roadmap.id, r => ({ ...r, description: d })); }}>Edit description</button>
                  <button className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-500 cursor-pointer" onClick={async () => { setMenuOpen(false); if (await confirmDialog({ title: 'Delete roadmap', message: `Delete the roadmap "${roadmap.name}"? Its epics stay in Lira.`, confirmLabel: 'Delete roadmap', tone: 'danger' })) { remove(roadmap.id); onBack(); } }}>Delete roadmap</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {notice && (
          <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${notice.tone === 'error' ? 'border-red-300/60 bg-red-500/10 text-red-600' : 'border-emerald-300/50 bg-emerald-500/10 text-emerald-600'}`}>
            <Layers className="w-4 h-4 mt-0.5 flex-shrink-0" /><span className="flex-1">{notice.text}</span>
            <button onClick={() => setNotice(null)} className="cursor-pointer" aria-label="Dismiss"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        <RoadmapSummary summary={summary} conflicts={conflicts} />

        <RoadmapToolbar roadmap={roadmap} owners={owners} prefs={prefs} setPrefs={setPrefs} filter={filter} setFilter={setFilter} onToday={() => setTodayKey(k => k + 1)} />

        {conflicts > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 text-amber-800 px-3 py-2 text-xs">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{conflicts} dependency {conflicts === 1 ? 'problem' : 'problems'}: an epic starts before something it depends on has finished. Shown as red dashed arrows on the timeline.</span>
          </div>
        )}

        {/* view */}
        {prefs.view === 'timeline' && (
          <>
            <TimelineView
              roadmap={roadmap}
              items={items}
              issues={issues}
              zoom={prefs.zoom}
              showDeps={prefs.showDeps}
              collapsedLanes={prefs.collapsed}
              onToggleLane={toggleLane}
              onChangeItem={changeItem}
              onOpenItem={openItem}
              onOpenMilestone={id => { const ms = roadmap.milestones.find(m => m.id === id); if (ms) setEditingMs({ ms, isNew: false }); }}
              scrollToTodayKey={todayKey}
            />
            <p className="text-[11px] text-lira-muted">Drag a bar to reschedule it, drag its edges to change the length, click it to edit. Dashed lines are milestones (violet) and releases (green). Dates are saved on the epic too.</p>
          </>
        )}
        {prefs.view === 'planner' && (
          <PlannerView
            roadmap={roadmap}
            items={items}
            issues={issues}
            collapsedLanes={prefs.collapsed}
            onToggleLane={toggleLane}
            onChangeItem={changeItem}
            onMoveTicket={(issue, date) => { void setTicketDate(issue, date); }}
            onOpenItem={openItem}
            onOpenIssue={openIssueEvent}
            onAddTicket={(epic, title) => { void addTicketToEpic(epic, title); }}
            scrollToTodayKey={todayKey}
          />
        )}
        {prefs.view === 'horizon' && <HorizonBoard roadmap={roadmap} items={items} issues={issues} onOpenItem={openItem} />}
        {prefs.view === 'table' && <RoadmapTable roadmap={roadmap} items={items} issues={issues} onOpenItem={openItem} />}
      </div>

      {editing && <ItemModal roadmap={roadmap} item={editing.item} isNew={editing.isNew} issues={issues} space={space} onSave={saveItem} onDelete={deleteItem} onOpenEpic={openByKey} onClose={() => setEditing(null)} />}
      {editingMs && (
        <MilestoneModal
          milestone={editingMs.ms}
          isNew={editingMs.isNew}
          onSave={saveMs}
          onDelete={id => { update(roadmap.id, r => ({ ...r, milestones: r.milestones.filter(m => m.id !== id) })); setEditingMs(null); }}
          onClose={() => setEditingMs(null)}
        />
      )}
    </div>
  );
};
