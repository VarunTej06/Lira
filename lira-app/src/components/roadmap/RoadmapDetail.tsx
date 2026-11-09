import { AnimatedValue } from '../common/motion';
import { notifySaved } from '../common/SavedToast';
import { confirmDialog, promptDialog } from '../common/dialogs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, CalendarClock, CalendarRange, ChevronsDownUp, ChevronsUpDown, Download, Flag, GanttChartSquare, GitBranch,
  LayoutGrid, Layers, Map, MoreHorizontal, Plus, Rows3, Search, Target, X,
} from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { readRoadmaps, useRoadmaps } from '../../hooks/useRoadmaps';
import {
  STATUS_META, dependencyIssues, fmtDay, itemChecklist, newId, parseDay, resolveItem, summarize, toCsv,
  type Roadmap, type RoadmapItem, type RoadmapStatus, type Zoom,
} from '../../utils/roadmapUtils';
import { addTicketToEpic, createEpicForItem, ensureEpics, ensureTaskForItem, setTicketDate, spaceForRoadmap, syncEpicFromItem, syncTaskFromItem } from '../../services/roadmapEpics';
import { TimelineView } from './TimelineView';
import { PlannerView } from './PlannerView';
import { HorizonBoard } from './HorizonBoard';
import { RoadmapTable } from './RoadmapTable';
import { ItemModal, MilestoneModal, blankItem, blankMilestone, type ItemSaveOptions } from './RoadmapModals';

type View = 'timeline' | 'planner' | 'horizon' | 'table';
interface Prefs { view: View; zoom: Zoom; showDeps: boolean; collapsed: string[] }

const PREFS_KEY = 'lira_roadmap_prefs';
const loadPrefs = (): Prefs => {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return { view: 'timeline', zoom: 'months', showDeps: true, collapsed: [], ...p };
  } catch { return { view: 'timeline', zoom: 'months', showDeps: true, collapsed: [] }; }
};

const select = 'border border-lira-border rounded-lg px-2.5 py-1.5 text-xs bg-lira-surface text-lira-text focus:outline-none focus:ring-2 focus:ring-lira-blue/40 cursor-pointer';
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

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RoadmapStatus>('all');
  const [laneFilter, setLaneFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [period, setPeriod] = useState<'all' | 'month' | 'quarter'>('all');
  const [editing, setEditing] = useState<{ item: RoadmapItem; isNew: boolean } | null>(null);
  const [editingMs, setEditingMs] = useState<{ ms: ReturnType<typeof blankMilestone>; isNew: boolean } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [todayKey, setTodayKey] = useState(0);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const today = useMemo(() => new Date(), []);
  const space = roadmap ? spaceForRoadmap(roadmap, spaces) : undefined;

  // Every item must be an epic: create the missing ones (Backlog) as soon as the roadmap opens
  const ensuring = useRef(false);
  useEffect(() => {
    if (!roadmap || spaces.length === 0 || ensuring.current) return;
    const existing = new Set(issues.filter(i => i.type === 'epic').map(i => i.key));
    const tasks = new Set(issues.filter(i => i.type !== 'epic').map(i => i.key));
    const missing = roadmap.items.some(i => !i.epicKey || (issues.length > 0 && !existing.has(i.epicKey))
      || (i.children.length > 0 && (!i.taskKey || (issues.length > 0 && !tasks.has(i.taskKey)))));
    if (!missing) return;
    ensuring.current = true;
    const latest = readRoadmaps().find(r => r.id === roadmap.id) || roadmap; // never act on a stale copy: that could create duplicates
    ensureEpics(latest, spaces).then(res => {
      if (res.error) setNotice({ tone: 'error', text: res.error });
      else if (res.created.length || res.tasks.length) {
        update(roadmap.id, r => ({ ...r, items: r.items.map(i => res.items.find(x => x.id === i.id) || i) }));
        const parts: string[] = [];
        if (res.created.length) parts.push(`${res.created.length} ${res.created.length === 1 ? 'epic' : 'epics'} (${res.created[0]}${res.created.length > 1 ? ` to ${res.created[res.created.length - 1]}` : ''})`);
        if (res.tasks.length) parts.push(`${res.tasks.length} checklist ${res.tasks.length === 1 ? 'task' : 'tasks'}`);
        setNotice({ tone: 'info', text: `Created ${parts.join(' and ')} in ${space?.name}. They are in the Backlog.` });
      }
    }).finally(() => { ensuring.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roadmap?.id, roadmap?.spaceKey, roadmap?.items.length, spaces.length, issues.length]);

  const summary = useMemo(() => (roadmap ? summarize(roadmap, issues, today) : undefined), [roadmap, issues, today]);
  const problems = useMemo(() => (roadmap ? dependencyIssues(roadmap.items) : []), [roadmap]);

  const items = useMemo(() => {
    if (!roadmap) return [];
    const q = search.trim().toLowerCase();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const qStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
    const qEnd = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 + 3, 0);
    return roadmap.items.filter(i => {
      if (q && !`${i.title} ${i.description || ''} ${i.lane} ${i.epicKey || ''}`.toLowerCase().includes(q)) return false;
      if (laneFilter !== 'all' && i.lane !== laneFilter) return false;
      if (ownerFilter !== 'all' && (i.owner || '') !== ownerFilter) return false;
      if (statusFilter !== 'all' && resolveItem(i, issues, today).status !== statusFilter) return false;
      if (period !== 'all') {
        const [a, b] = period === 'month' ? [monthStart, monthEnd] : [qStart, qEnd];
        if (parseDay(i.end) < a || parseDay(i.start) > b) return false;
      }
      return true;
    });
  }, [roadmap, search, laneFilter, ownerFilter, statusFilter, period, issues, today]);

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

  const allCollapsed = roadmap.lanes.length > 0 && roadmap.lanes.every(l => prefs.collapsed.includes(l));
  const conflicts = problems.filter(p => p.kind !== 'missing').length;
  const statusTotal = Math.max(1, summary.total);
  const toggleLane = (lane: string) => setPrefs({ collapsed: prefs.collapsed.includes(lane) ? prefs.collapsed.filter(l => l !== lane) : [...prefs.collapsed, lane] });

  const tiles = [
    { label: 'Overall progress', value: `${summary.percent}%`, sub: `${summary.byStatus.done} of ${summary.total} epics done`, icon: <Target className="w-4 h-4" />, tone: 'text-lira-blue bg-blue-50' },
    { label: 'Next milestone', value: summary.nextMilestone ? (summary.daysToNextMilestone === 0 ? 'Today' : `${summary.daysToNextMilestone}d`) : '—', sub: summary.nextMilestone?.title || 'None scheduled', icon: <Flag className="w-4 h-4" />, tone: 'text-violet-600 bg-violet-50' },
    { label: 'In progress', value: summary.byStatus.inprogress, sub: `${summary.byStatus.planned} planned`, icon: <CalendarClock className="w-4 h-4" />, tone: 'text-teal-600 bg-teal-50' },
    { label: 'Needs attention', value: summary.overdue + summary.byStatus.blocked + conflicts, sub: `${summary.overdue} late · ${summary.byStatus.blocked} blocked · ${conflicts} dependency`, icon: <AlertTriangle className="w-4 h-4" />, tone: 'text-amber-600 bg-amber-50' },
  ];

  const viewTabs: { key: View; label: string; icon: React.ReactNode }[] = [
    { key: 'timeline', label: 'Timeline', icon: <GanttChartSquare className="w-3.5 h-3.5" /> },
    { key: 'planner', label: 'Planner', icon: <CalendarRange className="w-3.5 h-3.5" /> },
    { key: 'horizon', label: 'Now / Next / Later', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
    { key: 'table', label: 'Table', icon: <Rows3 className="w-3.5 h-3.5" /> },
  ];

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
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-500 flex items-center gap-1"><Layers className="w-3 h-3" /> Epics in {space.name}</span>
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

        {/* tiles */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {tiles.map(t => (
            <div key={t.label} className="rounded-2xl border border-lira-border bg-lira-surface p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-lira-muted">{t.label}</span>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.tone}`}>{t.icon}</span>
              </div>
              <div className="text-2xl font-semibold text-lira-text mt-1"><AnimatedValue value={t.value} /></div>
              <div className="text-[11px] text-lira-muted truncate">{t.sub}</div>
            </div>
          ))}
        </div>

        {/* status distribution */}
        <div className="rounded-2xl border border-lira-border bg-lira-surface px-4 py-3">
          <div className="flex h-2.5 rounded-full overflow-hidden bg-lira-border/50">
            {(Object.keys(STATUS_META) as RoadmapStatus[]).map(s => summary.byStatus[s] > 0 && (
              <div key={s} style={{ width: `${(summary.byStatus[s] / statusTotal) * 100}%`, background: STATUS_META[s].color }} title={`${STATUS_META[s].label}: ${summary.byStatus[s]}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-lira-muted">
            {(Object.keys(STATUS_META) as RoadmapStatus[]).map(s => (
              <span key={s} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: STATUS_META[s].color }} />{STATUS_META[s].label} {summary.byStatus[s]}</span>
            ))}
          </div>
        </div>

        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-lira-border overflow-hidden bg-lira-surface">
            {viewTabs.map(v => (
              <button key={v.key} onClick={() => setPrefs({ view: v.key })} className={`px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${prefs.view === v.key ? 'bg-lira-blue text-white' : 'text-lira-text hover:bg-lira-bg'}`}>{v.icon}{v.label}</button>
            ))}
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-lira-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search roadmap" className={`${select} pl-8 w-44`} />
          </div>
          <select className={select} value={period} onChange={e => setPeriod(e.target.value as typeof period)} aria-label="Period">
            <option value="all">All time</option><option value="month">This month</option><option value="quarter">This quarter</option>
          </select>
          <select className={select} value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Status">
            <option value="all">All statuses</option>
            {(Object.keys(STATUS_META) as RoadmapStatus[]).map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
          <select className={select} value={laneFilter} onChange={e => setLaneFilter(e.target.value)} aria-label="Lane">
            <option value="all">All lanes</option>{roadmap.lanes.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          {owners.length > 1 && (
            <select className={select} value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} aria-label="Owner">
              <option value="all">All owners</option>{owners.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
          {(prefs.view === 'timeline' || prefs.view === 'planner') && (
            <div className="flex items-center gap-2 ml-auto">
              {prefs.view === 'timeline' && (
                <>
                  <div className="flex rounded-lg border border-lira-border overflow-hidden bg-lira-surface">
                    {(['weeks', 'months', 'quarters'] as Zoom[]).map(z => (
                      <button key={z} onClick={() => setPrefs({ zoom: z })} className={`px-2.5 py-1.5 text-xs capitalize cursor-pointer ${prefs.zoom === z ? 'bg-lira-blue text-white' : 'text-lira-text hover:bg-lira-bg'}`}>{z}</button>
                    ))}
                  </div>
                  <button onClick={() => setPrefs({ showDeps: !prefs.showDeps })} className={`px-2.5 py-1.5 text-xs rounded-lg border cursor-pointer flex items-center gap-1.5 ${prefs.showDeps ? 'border-lira-blue text-lira-blue bg-blue-50' : 'border-lira-border text-lira-text bg-lira-surface'}`}><GitBranch className="w-3.5 h-3.5" /> Dependencies</button>
                </>
              )}
              <button onClick={() => setPrefs({ collapsed: allCollapsed ? [] : [...roadmap.lanes] })} className="px-2.5 py-1.5 text-xs rounded-lg border border-lira-border bg-lira-surface text-lira-text hover:bg-lira-bg cursor-pointer flex items-center gap-1.5">
                {allCollapsed ? <ChevronsUpDown className="w-3.5 h-3.5" /> : <ChevronsDownUp className="w-3.5 h-3.5" />}{allCollapsed ? 'Expand lanes' : 'Collapse lanes'}
              </button>
              <button onClick={() => setTodayKey(k => k + 1)} className="px-2.5 py-1.5 text-xs rounded-lg border border-lira-border bg-lira-surface text-lira-text hover:bg-lira-bg cursor-pointer">Today</button>
            </div>
          )}
        </div>

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
