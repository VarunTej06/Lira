import { notifySaved } from '../common/savedToastStore';
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Layers, Map, X } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { useRoadmaps } from '../../hooks/useRoadmaps';
import { dependencyIssues, itemChecklist, summarize, toCsv, type Roadmap, type RoadmapItem } from '../../utils/roadmapUtils';
import { addTicketToEpic, setTicketDate, spaceForRoadmap, syncEpicFromItem } from '../../services/roadmapEpics';
import { filterRoadmapItems, type RoadmapFilter } from '../../utils/roadmapFilter';
import { RoadmapSummary } from './RoadmapSummary';
import { RoadmapToolbar, type RoadmapPrefs } from './RoadmapToolbar';
import { RoadmapHeader } from './RoadmapHeader';
import { useEnsureEpics, type Notice } from './useEnsureEpics';
import { TimelineView } from './TimelineView';
import { PlannerView } from './PlannerView';
import { HorizonBoard } from './HorizonBoard';
import { RoadmapTable } from './RoadmapTable';
import { ItemModal, MilestoneModal } from './RoadmapModals';
import type { ItemSaveOptions } from './itemDraft';
import { blankItem, blankMilestone } from './blankItems';
import { csvFileName, downloadCsv, loadPrefs, savePrefs, toggledLane, uniqueOwners, withItem, withMilestone, withoutItem } from './roadmapDetailRules';
import { prepareItemSave } from './saveItemFlow';
import { currentTime } from '../../utils/clock';

const openIssueEvent = (issue: Issue) => window.dispatchEvent(new CustomEvent('lira-open-issue', { detail: issue }));

interface Props { roadmapId: string; issues: Issue[]; spaces: Space[]; onBack: () => void }

function NoticeBar({ notice, onDismiss }: { notice: NonNullable<Notice>; onDismiss: () => void }) {
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${notice.tone === 'error' ? 'border-red-300/60 bg-red-500/10 text-red-600' : 'border-emerald-300/50 bg-emerald-500/10 text-emerald-600'}`}>
      <Layers className="w-4 h-4 mt-0.5 flex-shrink-0" /><span className="flex-1">{notice.text}</span>
      <button onClick={onDismiss} className="cursor-pointer" aria-label="Dismiss"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function ConflictBanner({ count }: { count: number }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 text-amber-800 px-3 py-2 text-xs">
      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{count} dependency {count === 1 ? 'problem' : 'problems'}: an epic starts before something it depends on has finished. Shown as red dashed arrows on the timeline.</span>
    </div>
  );
}

function RoadmapGone({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-lira-bg">
      <div className="text-center space-y-3">
        <Map className="w-10 h-10 mx-auto text-lira-muted" />
        <p className="text-lira-muted text-sm">This roadmap no longer exists.</p>
        <button onClick={onBack} className="px-4 py-2 text-sm font-semibold bg-lira-blue text-lira-on-blue rounded-lg cursor-pointer">Back to roadmaps</button>
      </div>
    </div>
  );
}

/** One roadmap: timeline, planner (lane > epic > tickets), Now/Next/Later and table views. */
export const RoadmapDetail: React.FC<Props> = ({ roadmapId, issues, spaces, onBack }) => {
  const { roadmaps, update, remove } = useRoadmaps();
  const roadmap: Roadmap | undefined = roadmaps.find(r => r.id === roadmapId);
  const [prefs, setPrefsState] = useState<RoadmapPrefs>(loadPrefs);
  const setPrefs = (patch: Partial<RoadmapPrefs>) => setPrefsState(p => {
    const next = { ...p, ...patch };
    savePrefs(next);
    return next;
  });

  const [filter, setFilterState] = useState<RoadmapFilter>({ search: '', status: 'all', lane: 'all', owner: 'all', period: 'all' });
  const setFilter = (patch: Partial<RoadmapFilter>) => setFilterState(f => ({ ...f, ...patch }));
  const [editing, setEditing] = useState<{ item: RoadmapItem; isNew: boolean } | null>(null);
  const [editingMs, setEditingMs] = useState<{ ms: ReturnType<typeof blankMilestone>; isNew: boolean } | null>(null);
  const [todayKey, setTodayKey] = useState(0);
  const [notice, setNotice] = useState<Notice>(null);
  const today = useMemo(() => currentTime(), []);
  const space = roadmap ? spaceForRoadmap(roadmap, spaces) : undefined;

  useEnsureEpics(roadmap, spaces, issues, space, update, setNotice);

  const summary = useMemo(() => (roadmap ? summarize(roadmap, issues, today) : undefined), [roadmap, issues, today]);
  const problems = useMemo(() => (roadmap ? dependencyIssues(roadmap.items) : []), [roadmap]);
  const items = useMemo(() => (roadmap ? filterRoadmapItems(roadmap, issues, today, filter) : []), [roadmap, issues, today, filter]);

  if (!roadmap || !summary) return <RoadmapGone onBack={onBack} />;

  /** Dates or length changed by dragging: save the item and push the dates to its epic. */
  const changeItem = (item: RoadmapItem) => {
    update(roadmap.id, r => ({ ...r, items: r.items.map(i => (i.id === item.id ? item : i)) }));
    void syncEpicFromItem(item);
  };
  const saveItem = async (item: RoadmapItem, opts: ItemSaveOptions) => {
    let saved: Awaited<ReturnType<typeof prepareItemSave>>;
    try {
      saved = await prepareItemSave(item, opts, roadmap, space);
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'Could not create the epic.' });
      return;
    }
    if (saved.notice) setNotice(saved.notice);
    update(roadmap.id, r => withItem(r, saved.item, opts.newLane));
    notifySaved('Roadmap item saved');
    setEditing(null);
  };
  const deleteItem = (id: string) => {
    update(roadmap.id, r => withoutItem(r, id));
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
    update(roadmap.id, r => withMilestone(r, m));
    setEditingMs(null);
    notifySaved('Milestone saved');
  };
  const deleteMs = (id: string) => {
    update(roadmap.id, r => ({ ...r, milestones: r.milestones.filter(m => m.id !== id) }));
    setEditingMs(null);
  };
  const openMilestone = (id: string) => {
    const ms = roadmap.milestones.find(m => m.id === id);
    if (ms) setEditingMs({ ms, isNew: false });
  };

  const conflicts = problems.filter(p => p.kind !== 'missing').length;
  const toggleLane = (lane: string) => setPrefs({ collapsed: toggledLane(prefs.collapsed, lane) });

  return (
    <div className="flex-1 overflow-y-auto bg-lira-bg">
      <div className="max-w-[1400px] mx-auto p-6 space-y-5">
        <RoadmapHeader
          roadmap={roadmap} space={space} spaces={spaces} onBack={onBack}
          onChange={patch => update(roadmap.id, patch)}
          onDelete={() => { remove(roadmap.id); onBack(); }}
          onExport={() => downloadCsv(toCsv(roadmap, issues, today), csvFileName(roadmap.name, today))}
          onAddMilestone={() => setEditingMs({ ms: blankMilestone(today), isNew: true })}
          onAddItem={() => setEditing({ item: blankItem(roadmap, today), isNew: true })}
        />
        {notice && <NoticeBar notice={notice} onDismiss={() => setNotice(null)} />}
        <RoadmapSummary summary={summary} conflicts={conflicts} />
        <RoadmapToolbar roadmap={roadmap} owners={uniqueOwners(roadmap.items)} prefs={prefs} setPrefs={setPrefs} filter={filter} setFilter={setFilter} onToday={() => setTodayKey(k => k + 1)} />
        {conflicts > 0 && <ConflictBanner count={conflicts} />}

        {prefs.view === 'timeline' && (
          <>
            <TimelineView
              roadmap={roadmap} items={items} issues={issues} zoom={prefs.zoom} showDeps={prefs.showDeps} collapsedLanes={prefs.collapsed}
              onToggleLane={toggleLane} onChangeItem={changeItem} onOpenItem={openItem} onOpenMilestone={openMilestone} scrollToTodayKey={todayKey}
            />
            <p className="text-2xs text-lira-muted">Drag a bar to reschedule it, drag its edges to change the length, click it to edit. Dashed lines are milestones (violet) and releases (green). Dates are saved on the epic too.</p>
          </>
        )}
        {prefs.view === 'planner' && (
          <PlannerView
            roadmap={roadmap} items={items} issues={issues} collapsedLanes={prefs.collapsed} onToggleLane={toggleLane} onChangeItem={changeItem}
            onMoveTicket={(issue, date) => { void setTicketDate(issue, date); }} onOpenItem={openItem} onOpenIssue={openIssueEvent}
            onAddTicket={(epic, title) => { void addTicketToEpic(epic, title); }} scrollToTodayKey={todayKey}
          />
        )}
        {prefs.view === 'horizon' && <HorizonBoard roadmap={roadmap} items={items} issues={issues} onOpenItem={openItem} />}
        {prefs.view === 'table' && <RoadmapTable roadmap={roadmap} items={items} issues={issues} onOpenItem={openItem} />}
      </div>

      {editing && <ItemModal roadmap={roadmap} item={editing.item} isNew={editing.isNew} issues={issues} space={space} onSave={saveItem} onDelete={deleteItem} onOpenEpic={openByKey} onClose={() => setEditing(null)} />}
      {editingMs && <MilestoneModal milestone={editingMs.ms} isNew={editingMs.isNew} onSave={saveMs} onDelete={deleteMs} onClose={() => setEditingMs(null)} />}
    </div>
  );
};
