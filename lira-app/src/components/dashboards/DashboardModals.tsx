import React, { useEffect, useMemo, useState } from 'react';
import { Check, Download, FileText, Plus, Search, Trash2 } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { Modal } from '../common/Modal';
import { TypeIcon } from '../common/Icons';
import { StatusBadge } from '../common/Badge';
import { issueLink } from '../../utils/links';
import { CATALOG, CATEGORY_ORDER } from '../../utils/dashboards/catalog';
import { METRICS, METRIC_IDS, LIST_META } from '../../utils/dashboards/metrics';
import { clampNumber, LIMITED_TYPES, withListKind, withMetric } from './widgetSettingsRules';
import type { DashboardFilters, DashboardGoal, DashboardWidget, GroupBy, ListKind, Measure, ProgressBy, SnapshotSchedule, StatMetric } from '../../utils/dashboards/types';
import { DAY_NAMES, DEFAULT_SCHEDULE, listSnapshotFiles, nextScheduledMoment } from '../../utils/dashboards/snapshot';
import { newId } from '../../utils/dashboards/catalog';
import { FilterControls } from './FilterControls';
import { currentTime } from '../../utils/clock';
import { useResetWhen } from '../../hooks/useResetWhen';

const input = 'w-full text-sm border border-lira-border rounded-lg px-3 py-2 bg-white text-lira-text focus:outline-none focus:border-lira-blue focus:ring-1 focus:ring-lira-blue';
const label = 'block text-xs font-semibold text-lira-muted mb-1.5 uppercase tracking-wide';

// ── Add widget ───────────────────────────────────────────────────────────────

type CatalogEntry = (typeof CATALOG)[number];

/** One widget of the gallery: its name, a short description, and a + (a tick once it was added). */
function GalleryCard({ entry, done, onAdd }: { entry: CatalogEntry; done: boolean; onAdd: () => void }) {
  return (
    <button type="button" data-testid={`add-${entry.id}`} onClick={onAdd}
      className="text-left rounded-lg border border-lira-border p-3 hover:border-lira-blue hover:bg-lira-blue-light/40 transition-colors cursor-pointer">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-lira-text">{entry.title}</span>
        {done ? <Check className="w-4 h-4 text-emerald-600" /> : <Plus className="w-4 h-4 text-lira-muted" />}
      </div>
      <p className="text-xs text-lira-muted mt-0.5">{entry.description}</p>
    </button>
  );
}

const matchesGallerySearch = (c: CatalogEntry, query: string): boolean => {
  const q = query.trim().toLowerCase();
  return !q || `${c.title} ${c.description} ${c.category}`.toLowerCase().includes(q);
};

export const WidgetGallery: React.FC<{ open: boolean; onClose: () => void; onAdd: (entryId: string) => void }> = ({ open, onClose, onAdd }) => {
  const [q, setQ] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  useResetWhen([open], () => { if (open) { setQ(''); setAdded([]); } });
  const entries = useMemo(() => CATALOG.filter(c => matchesGallerySearch(c, q)), [q]);
  return (
    <Modal isOpen={open} onClose={onClose} title="Add a widget" size="xl">
      <div className="p-5 space-y-4" data-testid="widget-gallery">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-lira-muted" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search widgets: blocked, burndown, workload..." aria-label="Search widgets" className={`${input} pl-9`} />
        </div>
        <div className="max-h-[60vh] overflow-y-auto space-y-5 pr-1">
          {CATEGORY_ORDER.map(cat => {
            const list = entries.filter(e => e.category === cat);
            if (!list.length) return null;
            return (
              <section key={cat}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-lira-muted mb-2">{cat}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {list.map(c => <GalleryCard key={c.id} entry={c} done={added.includes(c.id)} onAdd={() => { onAdd(c.id); setAdded(a => [...a, c.id]); }} />)}
                </div>
              </section>
            );
          })}
          {entries.length === 0 && <p className="text-sm text-lira-muted text-center py-8">No widget matches.</p>}
        </div>
        <div className="flex justify-end"><button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-lira-on-blue bg-lira-blue hover:bg-lira-blue-hover rounded-lg cursor-pointer">Done</button></div>
      </div>
    </Modal>
  );
};

// ── Widget settings ──────────────────────────────────────────────────────────

const GROUPS: { v: GroupBy; l: string }[] = [{ v: 'status', l: 'Status' }, { v: 'priority', l: 'Priority' }, { v: 'type', l: 'Type' }, { v: 'assignee', l: 'Person' }, { v: 'label', l: 'Label' }, { v: 'epic', l: 'Epic' }, { v: 'sprint', l: 'Sprint' }, { v: 'space', l: 'Space' }];

type SettingsFieldProps = { w: DashboardWidget; setW: (w: DashboardWidget) => void; cfg: (patch: Partial<DashboardWidget['config']>) => void };

/** A labelled number box that keeps its value between min and max (blank gives 8). */
function NumberField({ id, text, min, max, value, onChange }: { id: string; text: string; min: number; max: number; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <label htmlFor={id} className={label}>{text}</label>
      <input id={id} type="number" min={min} max={max} value={value} onChange={e => onChange(clampNumber(e.target.value, min, max, 8))} className={`${input} w-28`} />
    </div>
  );
}

function StatField({ w, setW }: Pick<SettingsFieldProps, 'w' | 'setW'>) {
  return (
    <div><label htmlFor="ws-metric" className={label}>What to count</label>
      <select id="ws-metric" value={w.config.metric ?? 'open'} onChange={e => setW(withMetric(w, e.target.value as StatMetric))} className={input}>
        {METRIC_IDS.map(m => <option key={m} value={m}>{METRICS[m].label}: {METRICS[m].description}</option>)}
      </select></div>
  );
}

function GroupFields({ w, cfg }: Pick<SettingsFieldProps, 'w' | 'cfg'>) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div><label htmlFor="ws-group" className={label}>Group by</label><select id="ws-group" value={w.config.groupBy ?? 'status'} onChange={e => cfg({ groupBy: e.target.value as GroupBy })} className={input}>{GROUPS.map(g => <option key={g.v} value={g.v}>{g.l}</option>)}</select></div>
      <div><label htmlFor="ws-measure" className={label}>Measure</label><select id="ws-measure" value={w.config.measure ?? 'count'} onChange={e => cfg({ measure: e.target.value as Measure })} className={input}><option value="count">Number of tickets</option><option value="points">Story points</option></select></div>
    </div>
  );
}

function ListField({ w, setW }: Pick<SettingsFieldProps, 'w' | 'setW'>) {
  return (
    <div><label htmlFor="ws-list" className={label}>Which tickets</label>
      <select id="ws-list" value={w.config.list ?? 'attention'} onChange={e => setW(withListKind(w, e.target.value as ListKind))} className={input}>
        {(Object.keys(LIST_META) as ListKind[]).map(k => <option key={k} value={k}>{LIST_META[k].label}: {LIST_META[k].description}</option>)}</select></div>
  );
}

function ProgressField({ w, cfg }: Pick<SettingsFieldProps, 'w' | 'cfg'>) {
  return (
    <div><label htmlFor="ws-prog" className={label}>Progress by</label><select id="ws-prog" value={w.config.progressBy ?? 'epic'} onChange={e => cfg({ progressBy: e.target.value as ProgressBy })} className={input}><option value="epic">Epic</option><option value="project">Project</option><option value="sprint">Sprint</option></select></div>
  );
}

/** The settings that belong to one kind of widget: what to count, how to group, which list, progress by, how many to show. */
function TypeFields({ w, setW, cfg }: SettingsFieldProps) {
  const { type } = w;
  return (
    <>
      {type === 'stat' && <StatField w={w} setW={setW} />}
      {(type === 'bar' || type === 'donut') && <GroupFields w={w} cfg={cfg} />}
      {type === 'list' && <ListField w={w} setW={setW} />}
      {type === 'progress' && <ProgressField w={w} cfg={cfg} />}
      {LIMITED_TYPES.includes(type) && <NumberField id="ws-limit" text="Show at most" min={3} max={30} value={w.config.limit ?? 8} onChange={limit => cfg({ limit })} />}
      {(type === 'trend' || type === 'throughput') && <NumberField id="ws-weeks" text="Weeks shown" min={4} max={26} value={w.config.weeks ?? 8} onChange={weeks => cfg({ weeks })} />}
    </>
  );
}

export const WidgetSettings: React.FC<{
  widget: DashboardWidget | null; dashboardFilters: DashboardFilters; issues: Issue[]; spaces: Space[];
  onClose: () => void; onSave: (w: DashboardWidget) => void;
}> = ({ widget, dashboardFilters, issues, spaces, onClose, onSave }) => {
  const [w, setW] = useState<DashboardWidget | null>(widget);
  useResetWhen([widget], () => setW(widget));
  if (!w) return null;
  const cfg = (patch: Partial<DashboardWidget['config']>) => setW({ ...w, config: { ...w.config, ...patch } });
  const own = !!w.filters;
  return (
    <Modal isOpen={!!widget} onClose={onClose} title="Widget settings" size="lg">
      <div className="p-5 space-y-4" data-testid="widget-settings-dialog">
        <div><label htmlFor="ws-title" className={label}>Title</label><input id="ws-title" value={w.title} onChange={e => setW({ ...w, title: e.target.value })} className={input} /></div>
        <TypeFields w={w} setW={setW} cfg={cfg} />

        <div className="rounded-lg border border-lira-border p-3 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-lira-text cursor-pointer">
            <input type="checkbox" checked={own} onChange={e => setW({ ...w, filters: e.target.checked ? { ...dashboardFilters } : undefined })} data-testid="own-filters" />
            Use different filters for this widget only
          </label>
          {own && <FilterControls value={{ ...dashboardFilters, ...w.filters }} onChange={f => setW({ ...w, filters: f })} issues={issues} spaces={spaces} clearable={false} />}
          {!own && <p className="text-xs text-lira-muted">It follows the filters at the top of the dashboard.</p>}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-lira-muted hover:text-lira-text rounded-lg cursor-pointer">Cancel</button>
          <button onClick={() => onSave(w)} data-testid="widget-settings-save" className="px-4 py-2 text-sm font-semibold text-lira-on-blue bg-lira-blue hover:bg-lira-blue-hover rounded-lg cursor-pointer">Save</button>
        </div>
      </div>
    </Modal>
  );
};

// ── Alerts ───────────────────────────────────────────────────────────────────

/** One alert: "Warn when <number> is <more than / fewer than> <limit>". */
function GoalRow({ goal: g, onChange, onRemove }: { goal: DashboardGoal; onChange: (patch: Partial<DashboardGoal>) => void; onRemove: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-2" data-testid="goal-row">
      <span className="text-sm text-lira-muted">Warn when</span>
      <select aria-label="Number" value={g.metric} onChange={e => onChange({ metric: e.target.value as StatMetric })} className={`${input} w-auto`}>{METRIC_IDS.map(m => <option key={m} value={m}>{METRICS[m].label}</option>)}</select>
      <span className="text-sm text-lira-muted">is</span>
      <select aria-label="More or fewer" value={g.op} onChange={e => onChange({ op: e.target.value as 'above' | 'below' })} className={`${input} w-auto`}><option value="above">more than</option><option value="below">fewer than</option></select>
      <input aria-label="Limit" type="number" min={0} value={g.value} onChange={e => onChange({ value: Math.max(0, Number(e.target.value) || 0) })} className={`${input} w-24`} />
      <button type="button" aria-label="Remove alert" onClick={onRemove} className="p-2 rounded-lg hover:bg-red-50 text-lira-muted hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
    </li>
  );
}

export const GoalsModal: React.FC<{ open: boolean; goals: DashboardGoal[]; onClose: () => void; onSave: (g: DashboardGoal[]) => void }> = ({ open, goals, onClose, onSave }) => {
  const [list, setList] = useState<DashboardGoal[]>(goals);
  useResetWhen([open, goals], () => { if (open) setList(goals); });
  const upd = (id: string, patch: Partial<DashboardGoal>) => setList(l => l.map(g => (g.id === id ? { ...g, ...patch } : g)));
  return (
    <Modal isOpen={open} onClose={onClose} title="Alerts" size="lg">
      <div className="p-5 space-y-4" data-testid="goals-dialog">
        <p className="text-sm text-lira-muted">Get a red warning on this dashboard when a number goes past the limit you set. For example: warn when Blocked is more than 3.</p>
        <ul className="space-y-2">
          {list.map(g => <GoalRow key={g.id} goal={g} onChange={patch => upd(g.id, patch)} onRemove={() => setList(l => l.filter(x => x.id !== g.id))} />)}
          {list.length === 0 && <li className="text-sm text-lira-muted">No alerts yet.</li>}
        </ul>
        <button type="button" onClick={() => setList(l => [...l, { id: newId('goal'), metric: 'blocked', op: 'above', value: 3 }])} data-testid="add-goal" className="flex items-center gap-1.5 text-sm font-semibold text-lira-blue hover:underline cursor-pointer"><Plus className="w-4 h-4" /> Add an alert</button>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-lira-muted hover:text-lira-text rounded-lg cursor-pointer">Cancel</button>
          <button onClick={() => onSave(list)} data-testid="goals-save" className="px-4 py-2 text-sm font-semibold text-lira-on-blue bg-lira-blue hover:bg-lira-blue-hover rounded-lg cursor-pointer">Save alerts</button>
        </div>
      </div>
    </Modal>
  );
};

// ── Snapshots ────────────────────────────────────────────────────────────────

type SnapshotFile = { file: string; size: number; modified: string };

/** "Every <day> at <hour>:00", dimmed and unclickable while the weekly snapshot is off. */
function SchedulePicker({ s, onSchedule }: { s: SnapshotSchedule; onSchedule: (s: SnapshotSchedule) => void }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${s.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
      <span className="text-sm text-lira-muted">Every</span>
      <select aria-label="Day" value={s.day} onChange={e => onSchedule({ ...s, day: Number(e.target.value) })} className={`${input} w-auto`}>{DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
      <span className="text-sm text-lira-muted">at</span>
      <select aria-label="Hour" value={s.hour} onChange={e => onSchedule({ ...s, hour: Number(e.target.value) })} className={`${input} w-auto`}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select>
    </div>
  );
}

/** The snapshot files already saved, each a link that opens it. */
function SavedSnapshots({ files }: { files: SnapshotFile[] }) {
  return (
    <div>
      <h3 className={label}>Saved snapshots</h3>
      {files.length === 0 ? <p className="text-sm text-lira-muted">None yet.</p> : (
        <ul className="divide-y divide-lira-border border border-lira-border rounded-lg max-h-48 overflow-y-auto" data-testid="snapshot-files">
          {files.map(f => (
            <li key={f.file}><a href={`/api/snapshot?file=${encodeURIComponent(f.file)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-lira-text">
              <FileText className="w-4 h-4 text-lira-muted" /><span className="flex-1 truncate">{f.file}</span><span className="text-xs text-lira-muted">{new Date(f.modified).toLocaleString()}</span></a></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const SnapshotModal: React.FC<{
  open: boolean; schedule?: SnapshotSchedule; onClose: () => void; onSchedule: (s: SnapshotSchedule) => void;
  onTakeNow: () => Promise<string | undefined>; onDownload: () => void;
}> = ({ open, schedule, onClose, onSchedule, onTakeNow, onDownload }) => {
  const s = schedule ?? DEFAULT_SCHEDULE;
  const [files, setFiles] = useState<SnapshotFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useResetWhen([open], () => { if (open) setMsg(''); });
  useEffect(() => { if (open) void listSnapshotFiles().then(setFiles); }, [open]);
  const next = nextScheduledMoment(s, currentTime());
  const takeNow = async () => {
    setBusy(true);
    const f = await onTakeNow();
    setBusy(false);
    setMsg(f ? `Saved ${f}` : 'Could not save the file. Use Download instead.');
    void listSnapshotFiles().then(setFiles);
  };
  return (
    <Modal isOpen={open} onClose={onClose} title="Weekly snapshot" size="lg">
      <div className="p-5 space-y-5" data-testid="snapshot-dialog">
        <p className="text-sm text-lira-muted">A snapshot saves this dashboard as a Markdown file in the <code className="font-mono text-xs bg-gray-100 px-1 rounded">data/snapshots</code> folder. While Lira is open, one is taken each week at the time you choose. If Lira was closed then, it is taken the next time you open it.</p>
        <label className="flex items-center gap-2 text-sm font-medium text-lira-text cursor-pointer">
          <input type="checkbox" checked={s.enabled} onChange={e => onSchedule({ ...s, enabled: e.target.checked })} data-testid="snapshot-enabled" /> Take a snapshot every week
        </label>
        <SchedulePicker s={s} onSchedule={onSchedule} />
        {s.enabled && <p className="text-xs text-lira-muted">Next snapshot: {next.toLocaleString()}{s.lastRun ? ` · last taken ${new Date(s.lastRun).toLocaleString()}` : ''}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} data-testid="snapshot-now" onClick={takeNow}
            className="px-4 py-2 text-sm font-semibold text-lira-on-blue bg-lira-blue hover:bg-lira-blue-hover rounded-lg cursor-pointer disabled:opacity-60">Take a snapshot now</button>
          <button type="button" onClick={onDownload} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-lira-border rounded-lg hover:bg-gray-50 cursor-pointer"><Download className="w-4 h-4" /> Download Markdown</button>
        </div>
        {msg && <p className="text-sm text-emerald-700" role="status" data-testid="snapshot-msg">{msg}</p>}
        <SavedSnapshots files={files} />
        <div className="flex justify-end"><button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-lira-on-blue bg-lira-blue hover:bg-lira-blue-hover rounded-lg cursor-pointer">Close</button></div>
      </div>
    </Modal>
  );
};

// ── Tickets behind a number or a bar ─────────────────────────────────────────

export const DrillModal: React.FC<{ drill: { title: string; issues: Issue[] } | null; onClose: () => void; onOpen: (i: Issue) => void }> = ({ drill, onClose, onOpen }) => (
  <Modal isOpen={!!drill} onClose={onClose} title={drill ? `${drill.title} (${drill.issues.length})` : ''} size="lg">
    <div className="p-3 max-h-[65vh] overflow-y-auto" data-testid="drill-dialog">
      {drill && drill.issues.length === 0 && <p className="text-sm text-lira-muted text-center py-8">No tickets.</p>}
      <ul>
        {drill?.issues.map(i => (
          <li key={i.id ?? i.key}>
            <button type="button" onClick={() => onOpen(i)} {...issueLink(i)} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-left cursor-pointer">
              <TypeIcon type={i.type} className="w-4 h-4 flex-shrink-0" />
              <span className="font-mono text-xs font-semibold text-lira-muted w-20 flex-shrink-0">{i.key}</span>
              <span className="flex-1 min-w-0 text-sm text-lira-text truncate">{i.title}</span>
              {i.blocked && <span className="text-3xs font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700">Blocked</span>}
              <StatusBadge status={i.status} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  </Modal>
);

