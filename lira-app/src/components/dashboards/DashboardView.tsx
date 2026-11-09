import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, CalendarClock, Copy, Download, FileJson, ImageDown, MoreHorizontal, Pencil, Plus, Printer, Share2, Star, Trash2, Check, AlertTriangle, LayoutDashboard } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { AnimatePresence, motion } from '../common/motionPresets';
import { menuPop } from '../common/motionPresets';
import { confirmDialog } from '../common/dialogStore';
import { copyText } from '../common/copyText';
import { notifySaved } from '../common/savedToastStore';
import { duplicateDashboard, removeDashboard, updateDashboard, useDashboards } from '../../utils/dashboards/store';
import { scenarioById, widgetFromEntry } from '../../utils/dashboards/catalog';
import { evaluateGoal, scopeIssues } from '../../utils/dashboards/metrics';
import { dashboardJsonName, downloadText, saveSnapshotFile, snapshotFileName, snapshotMarkdown } from '../../utils/dashboards/snapshot';
import type { Dashboard, DashboardWidget } from '../../utils/dashboards/types';
import { FilterControls } from './FilterControls';
import { DashboardGrid } from './DashboardGrid';
import { DrillModal, GoalsModal, SnapshotModal, WidgetGallery, WidgetSettings } from './DashboardModals';
import { useDashboardData } from './useDashboardData';
import { currentTime } from '../../utils/clock';

interface Props { dashboardId: string; issues: Issue[]; spaces: Space[]; onOpenIssue: (issue: Issue) => void }

const Btn: React.FC<{ onClick: () => void; children: React.ReactNode; active?: boolean; testId?: string; title?: string }> = ({ onClick, children, active, testId, title }) => (
  <button type="button" onClick={onClick} data-testid={testId} title={title}
    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors cursor-pointer ${active ? 'bg-lira-blue text-white border-lira-blue' : 'bg-white text-lira-text border-lira-border hover:bg-gray-50'}`}>
    {children}
  </button>
);

const MENU_PANEL = 'absolute right-0 top-full mt-1 bg-white border border-lira-border rounded-xl shadow-2xl z-30 py-1 text-sm';
const MENU_ITEM = 'w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer text-left';

function MissingDashboard({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8" data-testid="dashboard-missing">
      <LayoutDashboard className="w-10 h-10 text-lira-muted" />
      <h1 className="text-lg font-bold text-lira-text">This dashboard does not exist</h1>
      <p className="text-sm text-lira-muted">It may have been deleted, or the link was made on another computer.</p>
      <button onClick={onBack} className="px-4 py-2 text-sm font-semibold text-white bg-lira-blue hover:bg-lira-blue-hover rounded-lg cursor-pointer">All dashboards</button>
    </div>
  );
}

/** The name (click to rename), the star, the alert badge and the one-line description. */
function DashboardTitle({ dashboard, breached, onChange }: { dashboard: Dashboard; breached: number; onChange: (fn: (d: Dashboard) => Dashboard) => void }) {
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const scenario = scenarioById(dashboard.scenario);
  const commitName = () => {
    const name = nameDraft.trim();
    if (name && name !== dashboard.name) onChange(d => ({ ...d, name }));
    setRenaming(false);
  };
  const widgets = dashboard.widgets.length;
  return (
    <div className="min-w-0 flex-1 basis-[240px]">
      <div className="flex items-center gap-2">
        {renaming ? (
          <input autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)} onBlur={commitName} aria-label="Dashboard name"
            onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { e.stopPropagation(); setRenaming(false); } }}
            className="text-xl font-bold text-lira-text border-b-2 border-lira-blue outline-none bg-transparent min-w-[200px]" data-testid="dashboard-name-input" />
        ) : (
          <h1 className="text-xl font-bold text-lira-text truncate cursor-text hover:bg-gray-100 rounded px-1 -mx-1" onClick={() => { setNameDraft(dashboard.name); setRenaming(true); }} title="Click to rename" data-testid="dashboard-name">{dashboard.name}</h1>
        )}
        <button type="button" aria-label={dashboard.starred ? 'Remove star' : 'Star this dashboard'} aria-pressed={!!dashboard.starred} onClick={() => onChange(d => ({ ...d, starred: !d.starred }))} className={`p-1 rounded cursor-pointer ${dashboard.starred ? 'text-yellow-400' : 'text-lira-muted hover:text-yellow-400'}`}><Star className="w-4 h-4" fill={dashboard.starred ? 'currentColor' : 'none'} /></button>
        {breached > 0 && <span className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5" data-testid="alert-badge"><AlertTriangle className="w-3 h-3" />{breached} alert{breached === 1 ? '' : 's'}</span>}
      </div>
      <p className="text-xs text-lira-muted mt-0.5">{scenario.name}{dashboard.description ? `: ${dashboard.description}` : ` for ${scenario.audience.toLowerCase()}`} · {widgets} widget{widgets === 1 ? '' : 's'}</p>
    </div>
  );
}

/** Picture, print, Markdown and JSON exports. */
function ExportMenu({ open, onToggle, onClose, onPng, onMarkdown, onJson }: { open: boolean; onToggle: () => void; onClose: () => void; onPng: () => void; onMarkdown: () => void; onJson: () => void }) {
  return (
    <div className="relative">
      <Btn onClick={onToggle} testId="export-menu"><Download className="w-4 h-4" /> Export</Btn>
      <AnimatePresence>{open && (
        <motion.div {...menuPop} className={`${MENU_PANEL} w-56`} role="menu" style={{ transformOrigin: 'top right' }}>
          <button role="menuitem" onClick={onPng} data-testid="export-png" className={MENU_ITEM}><ImageDown className="w-4 h-4 text-lira-muted" /> Picture (PNG)</button>
          <button role="menuitem" onClick={() => { onClose(); window.print(); }} data-testid="export-print" className={MENU_ITEM}><Printer className="w-4 h-4 text-lira-muted" /> Print or save as PDF</button>
          <button role="menuitem" onClick={() => { onClose(); onMarkdown(); }} className={MENU_ITEM}><Download className="w-4 h-4 text-lira-muted" /> Markdown summary</button>
          <button role="menuitem" onClick={() => { onClose(); onJson(); }} className={MENU_ITEM}><FileJson className="w-4 h-4 text-lira-muted" /> Dashboard file (JSON)</button>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}

/** Duplicate and delete (delete asks first). */
function MoreMenu({ open, onToggle, onDuplicate, onDelete }: { open: boolean; onToggle: () => void; onDuplicate: () => void; onDelete: () => void }) {
  return (
    <div className="relative">
      <button type="button" aria-label="More" onClick={onToggle} className="p-2 rounded-lg border border-lira-border bg-white hover:bg-gray-50 text-lira-muted cursor-pointer" data-testid="more-menu"><MoreHorizontal className="w-4 h-4" /></button>
      <AnimatePresence>{open && (
        <motion.div {...menuPop} className={`${MENU_PANEL} w-48`} role="menu" style={{ transformOrigin: 'top right' }}>
          <button role="menuitem" onClick={onDuplicate} className={MENU_ITEM}><Copy className="w-4 h-4 text-lira-muted" /> Duplicate</button>
          <button role="menuitem" data-testid="delete-dashboard" onClick={onDelete} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-red-50 text-red-600 cursor-pointer text-left"><Trash2 className="w-4 h-4" /> Delete</button>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}

/** One chip per alert: red when breached, green when fine. */
function GoalChips({ goals }: { goals: ReturnType<typeof evaluateGoal>[] }) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="goal-chips" role="status">
      {goals.map(g => (
        <span key={g.goal.metric + g.goal.op + g.goal.value} className={`flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 border ${g.breached ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`} title={g.text}>
          {g.breached ? <AlertTriangle className="w-3 h-3" /> : <Check className="w-3 h-3" />}{g.text}
        </span>
      ))}
    </div>
  );
}

/** Saves the dashboard area as a PNG picture. Says whether it worked. */
async function savePicture(node: HTMLElement, fileName: string): Promise<boolean> {
  try {
    const { toPng } = await import('html-to-image');
    const bg = getComputedStyle(document.body).backgroundColor || '#ffffff';
    const url = await toPng(node, { pixelRatio: 2, backgroundColor: bg, filter: n => !(n as HTMLElement).classList?.contains('no-print') });
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    return true;
  } catch {
    return false;
  }
}

export const DashboardView: React.FC<Props> = ({ dashboardId, issues, spaces, onOpenIssue }) => {
  const navigate = useNavigate();
  const { dashboards } = useDashboards();
  const dashboard = dashboards.find(d => d.id === dashboardId);
  const ctx = useDashboardData(issues, spaces);
  const printRef = useRef<HTMLDivElement>(null);

  const [editing, setEditing] = useState(false);
  const [gallery, setGallery] = useState(false);
  const [settings, setSettings] = useState<DashboardWidget | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [snapOpen, setSnapOpen] = useState(false);
  const [drill, setDrill] = useState<{ title: string; issues: Issue[] } | null>(null);
  const [menu, setMenu] = useState<'export' | 'more' | null>(null);

  const change = useCallback((fn: (d: Dashboard) => Dashboard) => updateDashboard(dashboardId, fn), [dashboardId]);
  const goals = useMemo(() => (dashboard ? dashboard.goals.map(g => evaluateGoal(g, scopeIssues(issues, dashboard.filters, ctx), ctx.now)) : []), [dashboard, issues, ctx]);

  if (!dashboard) return <MissingDashboard onBack={() => navigate('/dashboards')} />;

  const openIssue = (i: Issue) => { setDrill(null); onOpenIssue(i); };
  const markdown = () => downloadText(snapshotFileName(dashboard, new Date()), snapshotMarkdown(dashboard, ctx));
  const toggle = (which: 'export' | 'more') => setMenu(m => (m === which ? null : which));

  const takeSnapshot = async (): Promise<string | undefined> => {
    const r = await saveSnapshotFile(snapshotFileName(dashboard, new Date()), snapshotMarkdown(dashboard, ctx));
    if (r.ok) change(d => ({ ...d, snapshot: { ...(d.snapshot ?? { enabled: false, day: 1, hour: 9 }), lastRun: new Date().toISOString() } }));
    return r.ok ? r.file : undefined;
  };
  const exportPng = async () => {
    setMenu(null);
    if (!printRef.current) return;
    const ok = await savePicture(printRef.current, `${snapshotFileName(dashboard, new Date()).replace(/\.md$/, '')}.png`);
    notifySaved(ok ? 'Picture saved' : 'Could not make the picture');
  };
  const share = async () => {
    if (await copyText(`${window.location.origin}/dashboards/${dashboard.id}`)) notifySaved('Link copied');
  };
  const deleteDashboard = async () => {
    setMenu(null);
    const ok = await confirmDialog({ title: 'Delete dashboard', message: `Delete "${dashboard.name}"? The widgets and alerts on it are removed. Your tickets are not touched.`, confirmLabel: 'Delete dashboard', tone: 'danger' });
    if (ok) { removeDashboard(dashboard.id); navigate('/dashboards'); }
  };
  const duplicate = () => {
    setMenu(null);
    const c = duplicateDashboard(dashboard.id);
    if (c) navigate(`/dashboards/${c.id}`);
  };

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-lira-bg" data-testid="dashboard-view">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-5 space-y-4">
        <div className="no-print flex flex-wrap items-start gap-3">
          <button type="button" onClick={() => navigate('/dashboards')} aria-label="All dashboards" className="mt-1 p-1.5 rounded-lg hover:bg-gray-100 text-lira-muted cursor-pointer"><ArrowLeft className="w-4 h-4" /></button>
          <DashboardTitle dashboard={dashboard} breached={goals.filter(g => g.breached).length} onChange={change} />
          <div className="flex flex-wrap items-center gap-2">
            {editing && <Btn onClick={() => setGallery(true)} testId="add-widget"><Plus className="w-4 h-4" /> Add widget</Btn>}
            <Btn onClick={() => setEditing(e => !e)} active={editing} testId="customise">{editing ? <><Check className="w-4 h-4" /> Done</> : <><Pencil className="w-4 h-4" /> Customise</>}</Btn>
            <Btn onClick={() => setGoalsOpen(true)} testId="open-alerts"><Bell className="w-4 h-4" /> Alerts</Btn>
            <Btn onClick={() => setSnapOpen(true)} testId="open-snapshot" title="Weekly snapshot"><CalendarClock className="w-4 h-4" /> Snapshot</Btn>
            <ExportMenu
              open={menu === 'export'} onToggle={() => toggle('export')} onClose={() => setMenu(null)} onPng={() => void exportPng()} onMarkdown={markdown}
              onJson={() => downloadText(dashboardJsonName(dashboard.name), JSON.stringify(dashboard, null, 2), 'application/json')}
            />
            <Btn onClick={() => void share()} testId="share-link" title="Copy a link to this dashboard"><Share2 className="w-4 h-4" /> Share</Btn>
            <MoreMenu open={menu === 'more'} onToggle={() => toggle('more')} onDuplicate={duplicate} onDelete={() => void deleteDashboard()} />
          </div>
        </div>

        <div className="no-print"><FilterControls value={dashboard.filters} onChange={f => change(d => ({ ...d, filters: f }))} issues={issues} spaces={spaces} /></div>

        {goals.length > 0 && <GoalChips goals={goals} />}

        {/* What is exported and printed */}
        <div ref={printRef} className="lira-print-area space-y-4 bg-lira-bg">
          <div className="hidden print:block"><h1 className="text-xl font-bold">{dashboard.name}</h1><p className="text-xs text-gray-600">{currentTime().toLocaleString()}</p></div>
          <DashboardGrid
            dashboard={dashboard} ctx={ctx} editing={editing}
            onChangeWidgets={widgets => change(d => ({ ...d, widgets }))}
            onSettings={setSettings}
            onDrill={(title, list) => setDrill({ title, issues: list })}
            onOpenIssue={openIssue}
          />
        </div>
      </div>

      <WidgetGallery open={gallery} onClose={() => setGallery(false)} onAdd={entry => { const w = widgetFromEntry(entry); if (w) change(d => ({ ...d, widgets: [...d.widgets, w] })); }} />
      <WidgetSettings widget={settings} dashboardFilters={dashboard.filters} issues={issues} spaces={spaces} onClose={() => setSettings(null)} onSave={w => { change(d => ({ ...d, widgets: d.widgets.map(x => (x.id === w.id ? w : x)) })); setSettings(null); notifySaved('Widget saved'); }} />
      <GoalsModal open={goalsOpen} goals={dashboard.goals} onClose={() => setGoalsOpen(false)} onSave={g => { change(d => ({ ...d, goals: g })); setGoalsOpen(false); notifySaved('Alerts saved'); }} />
      <SnapshotModal open={snapOpen} schedule={dashboard.snapshot} onClose={() => setSnapOpen(false)} onSchedule={s => change(d => ({ ...d, snapshot: { ...s, lastRun: d.snapshot?.lastRun } }))} onTakeNow={takeSnapshot} onDownload={markdown} />
      <DrillModal drill={drill} onClose={() => setDrill(null)} onOpen={openIssue} />
    </div>
  );
};
