import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Copy, LayoutDashboard, Plus, Sparkles, Star, Trash2, Upload, Wand2 } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { confirmDialog, alertDialog } from '../common/dialogStore';
import { notifySaved } from '../common/savedToastStore';
import { addDashboard, buildDashboard, duplicateDashboard, normalizeDashboard, removeDashboard, updateDashboard, useDashboards } from '../../utils/dashboards/store';
import { SCENARIOS, entryById, scenarioById } from '../../utils/dashboards/catalog';
import { evaluateGoal, scopeIssues } from '../../utils/dashboards/metrics';
import { planFromPrompt, type DashboardPlan } from '../../utils/dashboards/promptBuilder';
import { newId } from '../../utils/dashboards/catalog';
import { linkProps } from '../../utils/links';
import { ScenarioIcon } from './scenarioIcons';
import { useDashboardData } from './useDashboardData';

const EXAMPLES = [
  'What is blocked in the current sprint and who is overloaded',
  'My overdue and due soon tickets this week',
  'Bug trend and open bugs by priority',
  'Project and epic progress with the roadmap',
];

export const DashboardsHome: React.FC<{ issues: Issue[]; spaces: Space[] }> = ({ issues, spaces }) => {
  const navigate = useNavigate();
  const { dashboards } = useDashboards();
  const ctx = useDashboardData(issues, spaces);
  const [text, setText] = useState('');
  const [plan, setPlan] = useState<DashboardPlan | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sorted = useMemo(() => [...dashboards].sort((a, b) => Number(!!b.starred) - Number(!!a.starred) || b.updatedAt.localeCompare(a.updatedAt)), [dashboards]);
  const alertsFor = (id: string) => {
    const d = dashboards.find(x => x.id === id);
    if (!d || !d.goals.length) return 0;
    const scoped = scopeIssues(issues, d.filters, ctx);
    return d.goals.filter(g => evaluateGoal(g, scoped, ctx.now).breached).length;
  };

  const make = (p: DashboardPlan) => {
    const d = addDashboard(buildDashboard({ name: p.name, scenario: p.scenario, filters: p.filters, entryIds: p.entries }));
    notifySaved('Dashboard created');
    navigate(`/dashboards/${d.id}`);
  };

  const importFile = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      if (!raw || !Array.isArray(raw.widgets)) throw new Error('not a dashboard');
      const d = normalizeDashboard({ ...raw, id: newId('dash'), widgets: raw.widgets.map((w: { id: string }) => ({ ...w, id: newId('w') })), snapshot: undefined });
      addDashboard(d);
      notifySaved('Dashboard imported');
      navigate(`/dashboards/${d.id}`);
    } catch {
      await alertDialog({ title: 'Could not import', message: 'That file is not a Lira dashboard file. Use a file made with Export, then Dashboard file (JSON).' });
    }
  };

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-lira-bg" data-testid="dashboards-home">
      <div className="max-w-[1300px] mx-auto px-4 sm:px-6 py-6 space-y-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-lira-blue-light text-lira-blue flex items-center justify-center"><LayoutDashboard className="w-6 h-6" /></span>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-lira-text">Dashboards</h1>
            <p className="text-sm text-lira-muted">See your work the way you need it: pick a goal, choose what to show, and save it.</p>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" aria-label="Import a dashboard file" data-testid="import-input" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importFile(f); }} />
          <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-lira-border bg-white rounded-lg hover:bg-gray-50 cursor-pointer"><Upload className="w-4 h-4" /> Import</button>
          <button type="button" onClick={() => navigate('/dashboards/new')} data-testid="new-dashboard" className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-lira-on-blue bg-lira-blue hover:bg-lira-blue-hover rounded-lg shadow-xs cursor-pointer"><Plus className="w-4 h-4" /> New dashboard</button>
        </div>

        {/* Describe it */}
        <section className="rounded-2xl border border-lira-border bg-white p-5 shadow-xs" aria-labelledby="describe-h">
          <h2 id="describe-h" className="flex items-center gap-2 text-sm font-bold text-lira-text"><Sparkles className="w-4 h-4 text-lira-blue" /> Build one from a description</h2>
          <p className="text-xs text-lira-muted mt-0.5">Say what you want to see. Lira picks the widgets and filters, and shows you what it understood before it creates anything.</p>
          <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); if (text.trim()) setPlan(planFromPrompt(text, spaces)); }}>
            <input value={text} onChange={e => { setText(e.target.value); setPlan(null); }} placeholder="For example: what is blocked in this sprint and who is overloaded" aria-label="Describe the dashboard" data-testid="describe-input"
              className="flex-1 min-w-0 text-sm border border-lira-border rounded-lg px-3 py-2.5 bg-white text-lira-text focus:outline-none focus:border-lira-blue focus:ring-1 focus:ring-lira-blue" />
            <button type="submit" disabled={!text.trim()} data-testid="describe-go" className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-lira-on-blue bg-lira-blue hover:bg-lira-blue-hover rounded-lg cursor-pointer disabled:opacity-50"><Wand2 className="w-4 h-4" /> Plan it</button>
          </form>
          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLES.map(x => <button key={x} type="button" onClick={() => { setText(x); setPlan(planFromPrompt(x, spaces)); }} className="px-2.5 py-1 text-xs rounded-full border border-lira-border text-lira-muted hover:text-lira-blue hover:border-lira-blue cursor-pointer">{x}</button>)}
          </div>
          {plan && (
            <div className="mt-4 rounded-xl border border-lira-border bg-lira-blue-light/50 p-4" data-testid="plan-card">
              <h3 className="text-sm font-bold text-lira-text">{plan.name}</h3>
              <ul className="mt-1 text-xs text-lira-muted space-y-0.5">{plan.understood.map((u, i) => <li key={i}>{u}</li>)}</ul>
              <p className="mt-2 text-xs text-lira-text"><span className="font-semibold">Widgets:</span> {plan.entries.map(id => entryById(id)?.title).filter(Boolean).join(', ')}</p>
              <div className="flex gap-2 mt-3">
                <button type="button" onClick={() => make(plan)} data-testid="plan-create" className="px-4 py-2 text-sm font-semibold text-lira-on-blue bg-lira-blue hover:bg-lira-blue-hover rounded-lg cursor-pointer">Create dashboard</button>
                <button type="button" onClick={() => navigate('/dashboards/new', { state: { plan } })} className="px-4 py-2 text-sm font-medium border border-lira-border bg-white rounded-lg hover:bg-gray-50 cursor-pointer">Adjust in the wizard</button>
              </div>
            </div>
          )}
        </section>

        {/* Mine */}
        <section aria-labelledby="mine-h">
          <h2 id="mine-h" className="text-sm font-bold uppercase tracking-wider text-lira-muted mb-3">My dashboards <span className="font-normal normal-case">({sorted.length})</span></h2>
          {sorted.length === 0 ? (
            <div className="rounded-xl border border-dashed border-lira-border bg-white/60 p-8 text-center text-sm text-lira-muted" data-testid="no-dashboards">You have no dashboards yet. Start from a template below, describe one above, or choose New dashboard.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="dashboard-cards">
              {sorted.map(d => {
                const sc = scenarioById(d.scenario);
                const alerts = alertsFor(d.id);
                return (
                  <div key={d.id} className="group relative rounded-xl border border-lira-border bg-white p-4 shadow-xs hover:border-lira-blue hover:shadow-md transition-all" data-testid="dashboard-card">
                    <button type="button" onClick={() => navigate(`/dashboards/${d.id}`)} {...linkProps(`/dashboards/${d.id}`)} className="w-full text-left cursor-pointer" aria-label={`Open ${d.name}`}>
                      <div className="flex items-start gap-3">
                        <ScenarioIcon icon={sc.icon} />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-lira-text truncate">{d.name}</h3>
                          <p className="text-xs text-lira-muted truncate">{sc.name} · {d.widgets.length} widget{d.widgets.length === 1 ? '' : 's'}</p>
                          <p className="text-2xs text-lira-muted mt-1">Updated {new Date(d.updatedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {alerts > 0 && <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5"><AlertTriangle className="w-3 h-3" />{alerts} alert{alerts === 1 ? '' : 's'}</span>}
                    </button>
                    <div className="absolute top-3 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button type="button" aria-label={d.starred ? 'Remove star' : 'Star'} onClick={() => updateDashboard(d.id, x => ({ ...x, starred: !x.starred }))} className={`p-1.5 rounded hover:bg-gray-100 cursor-pointer ${d.starred ? 'text-yellow-400' : 'text-lira-muted'}`}><Star className="w-3.5 h-3.5" fill={d.starred ? 'currentColor' : 'none'} /></button>
                      <button type="button" aria-label="Duplicate" onClick={() => { duplicateDashboard(d.id); notifySaved('Dashboard duplicated'); }} className="p-1.5 rounded hover:bg-gray-100 text-lira-muted cursor-pointer"><Copy className="w-3.5 h-3.5" /></button>
                      <button type="button" aria-label="Delete" onClick={async () => { if (await confirmDialog({ title: 'Delete dashboard', message: `Delete "${d.name}"?`, confirmLabel: 'Delete dashboard', tone: 'danger' })) removeDashboard(d.id); }} className="p-1.5 rounded hover:bg-red-50 text-lira-muted hover:text-red-600 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    {d.starred && <Star className="absolute top-3 right-3 w-3.5 h-3.5 text-yellow-400 group-hover:hidden" fill="currentColor" aria-hidden />}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Templates */}
        <section aria-labelledby="tpl-h">
          <h2 id="tpl-h" className="text-sm font-bold uppercase tracking-wider text-lira-muted mb-3">Start from a template</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="template-cards">
            {SCENARIOS.map(s => (
              <button key={s.id} type="button" onClick={() => navigate(`/dashboards/new?scenario=${s.id}`)} data-testid={`template-${s.id}`}
                className="text-left rounded-xl border border-lira-border bg-white p-4 shadow-xs hover:border-lira-blue hover:shadow-md transition-all cursor-pointer group">
                <div className="flex items-start gap-3">
                  <ScenarioIcon icon={s.icon} />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-lira-text">{s.name}</h3>
                    <p className="text-xs text-lira-muted mt-0.5">{s.tagline}</p>
                    <p className="text-2xs text-lira-muted mt-1.5">For: {s.audience}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-lira-muted group-hover:text-lira-blue flex-shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

