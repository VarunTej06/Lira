import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Star } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { notifySaved } from '../common/savedToastStore';
import { FilterMultiSelect } from '../common/FilterMultiSelect';
import { addDashboard, buildDashboard } from '../../utils/dashboards/store';
import { CATALOG, CATEGORY_ORDER, SCENARIOS, scenarioById, scenarioFilters, widgetFromEntry } from '../../utils/dashboards/catalog';
import { type DashboardFilters, type DateRange, type ScenarioId } from '../../utils/dashboards/types';
import type { DashboardPlan } from '../../utils/dashboards/promptBuilder';
import { allSprintKeys, currentSprintKey, sprintName } from '../../utils/sprintUtils';
import { DashboardGrid } from './DashboardGrid';
import { ScenarioIcon } from './scenarioIcons';
import { useDashboardData } from './useDashboardData';

const STEPS = ['Goal', 'Scope', 'Focus', 'Widgets'];
const RANGES: { value: DateRange; label: string }[] = [{ value: 'all', label: 'All time' }, { value: '7d', label: 'Last 7 days' }, { value: '30d', label: 'Last 30 days' }, { value: '90d', label: 'Last 90 days' }];
const PRIORITIES = ['highest', 'high', 'medium', 'low', 'lowest'];
const TYPES = [{ v: 'task', l: 'Tasks' }, { v: 'bug', l: 'Bugs' }, { v: 'subtask', l: 'Subtasks' }, { v: 'epic', l: 'Epics' }];

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

const Chip: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode; testId?: string }> = ({ on, onClick, children, testId }) => (
  <button type="button" aria-pressed={on} onClick={onClick} data-testid={testId}
    className={`px-3 py-1.5 text-sm rounded-full border transition-colors cursor-pointer ${on ? 'bg-lira-blue text-white border-lira-blue' : 'border-lira-border text-lira-text hover:bg-gray-50'}`}>{children}</button>
);

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section className="space-y-2"><div><h3 className="text-sm font-bold text-lira-text">{title}</h3>{hint && <p className="text-xs text-lira-muted">{hint}</p>}</div>{children}</section>
);

/** Four steps: what do you want to see, which work, whose work, which widgets. A live preview shows the result. */
export const DashboardWizard: React.FC<{ issues: Issue[]; spaces: Space[] }> = ({ issues, spaces }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = useDashboardData(issues, spaces);
  const incoming = (location.state as { plan?: DashboardPlan } | null)?.plan;
  const fromUrl = new URLSearchParams(location.search).get('scenario') as ScenarioId | null;

  const [step, setStep] = useState(() => (incoming || fromUrl ? 1 : 0));
  const [scenarioId, setScenarioId] = useState<ScenarioId>(() => incoming?.scenario ?? fromUrl ?? 'executive');
  const [filters, setFilters] = useState<DashboardFilters>(() => incoming?.filters ?? scenarioFilters(scenarioById(fromUrl ?? 'executive')));
  const [entries, setEntries] = useState<string[]>(() => incoming?.entries ?? scenarioById(fromUrl ?? 'executive').widgets);
  const [name, setName] = useState(() => incoming?.name ?? (fromUrl ? scenarioById(fromUrl).name : ''));
  const nameEdited = useRef(!!incoming);

  const scenario = scenarioById(scenarioId);
  const pick = (id: ScenarioId) => {
    const s = scenarioById(id);
    setScenarioId(id);
    setFilters(scenarioFilters(s));
    setEntries(s.widgets);
    if (!nameEdited.current) setName(s.name);
  };
  useEffect(() => { if (!name && !nameEdited.current) setName(scenario.name); }, [name, scenario.name]);

  const set = (p: Partial<DashboardFilters>) => setFilters(f => ({ ...f, ...p }));
  const sprintOptions = useMemo(() => [{ value: 'all', label: 'All sprints' }, { value: 'current', label: `Current (${sprintName(currentSprintKey())})` }, ...allSprintKeys(issues).slice().reverse().map(k => ({ value: k, label: sprintName(k) }))], [issues]);
  const people = useMemo(() => [{ value: 'all', label: 'Everyone' }, { value: 'me', label: 'Just me' }, { value: 'unassigned', label: 'Unassigned' }, ...[...new Set(issues.map(i => i.assignee).filter((n): n is string => !!n))].sort().map(n => ({ value: n, label: n }))], [issues]);
  const labels = useMemo(() => [...new Set(issues.flatMap(i => i.labels || []))].sort().map(l => ({ value: l, label: l })), [issues]);
  const label = (opts: { value: string; label: string }[], v: string) => opts.find(o => o.value === v)?.label ?? v;

  const preview = useMemo(() => ({
    ...buildDashboard({ name: name || scenario.name, scenario: scenarioId, filters, entryIds: [] }),
    widgets: entries.map(id => widgetFromEntry(id)).filter((w): w is NonNullable<typeof w> => !!w),
  }), [name, scenario.name, scenarioId, filters, entries]);

  const create = () => {
    const d = addDashboard(buildDashboard({ name: name.trim() || scenario.name, scenario: scenarioId, filters, entryIds: entries }));
    notifySaved('Dashboard created');
    navigate(`/dashboards/${d.id}`);
  };

  const canNext = step < 3;
  const recommended = new Set(scenario.widgets);

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-lira-bg" data-testid="dashboard-wizard">
      <div className="max-w-[1300px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/dashboards')} aria-label="Back to dashboards" className="p-1.5 rounded-lg hover:bg-gray-100 text-lira-muted cursor-pointer"><ArrowLeft className="w-4 h-4" /></button>
          <h1 className="text-xl font-bold text-lira-text">New dashboard</h1>
        </div>

        <ol className="flex flex-wrap items-center gap-2" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <button type="button" onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined} data-testid={`step-${i}`}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer ${i === step ? 'bg-lira-blue text-white' : i < step ? 'bg-emerald-50 text-emerald-700' : 'bg-white border border-lira-border text-lira-muted'}`}>
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">{i < step ? <Check className="w-3 h-3" /> : i + 1}</span>{s}
              </button>
              {i < STEPS.length - 1 && <span className="w-4 h-px bg-lira-border" />}
            </li>
          ))}
        </ol>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] gap-6">
          <div className="rounded-2xl border border-lira-border bg-white p-5 sm:p-6 shadow-xs space-y-6 self-start">
            {step === 0 && (
              <Section title="What do you want to see?" hint="Pick the closest goal. You can change everything in the next steps.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SCENARIOS.map(s => (
                    <button key={s.id} type="button" onClick={() => pick(s.id)} aria-pressed={scenarioId === s.id} data-testid={`goal-${s.id}`}
                      className={`text-left rounded-xl border p-3.5 flex items-start gap-3 transition-all cursor-pointer ${scenarioId === s.id ? 'border-lira-blue ring-1 ring-lira-blue bg-blue-50/40' : 'border-lira-border hover:border-lira-blue'}`}>
                      <ScenarioIcon icon={s.icon} className="w-9 h-9" />
                      <span className="min-w-0"><span className="block text-sm font-bold text-lira-text">{s.name}</span><span className="block text-xs text-lira-muted">{s.tagline}</span><span className="block text-2xs text-lira-muted mt-1">For: {s.audience}</span></span>
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {step === 1 && (
              <>
                <Section title="Which spaces?" hint="Leave all off to include every space.">
                  <div className="flex flex-wrap gap-2">
                    {spaces.filter(s => s.id).map(s => <Chip key={s.id} on={filters.spaceIds.includes(s.id!)} onClick={() => set({ spaceIds: toggle(filters.spaceIds, s.id!) })} testId={`space-${s.key}`}>{s.icon} {s.name}</Chip>)}
                  </div>
                </Section>
                <Section title="Which sprint?">
                  <FilterMultiSelect single label="Sprint" valueLabel={label(sprintOptions, filters.sprint)} options={sprintOptions} selected={[filters.sprint]} onToggle={v => set({ sprint: v })} />
                </Section>
                <Section title="How far back?" hint="Open work always counts. This limits finished work to the period.">
                  <div className="flex flex-wrap gap-2">{RANGES.map(r => <Chip key={r.value} on={filters.range === r.value} onClick={() => set({ range: r.value })} testId={`range-${r.value}`}>{r.label}</Chip>)}</div>
                </Section>
              </>
            )}

            {step === 2 && (
              <>
                <Section title="Whose work?">
                  <FilterMultiSelect single label="People" valueLabel={label(people, filters.assignee)} options={people} selected={[filters.assignee]} onToggle={v => set({ assignee: v })} />
                </Section>
                <Section title="Priority" hint="Leave all off for every priority.">
                  <div className="flex flex-wrap gap-2">{PRIORITIES.map(p => <Chip key={p} on={filters.priorities.includes(p)} onClick={() => set({ priorities: toggle(filters.priorities, p) })}>{p.charAt(0).toUpperCase() + p.slice(1)}</Chip>)}</div>
                </Section>
                <Section title="Ticket types">
                  <div className="flex flex-wrap gap-2">{TYPES.map(t => <Chip key={t.v} on={filters.types.includes(t.v)} onClick={() => set({ types: toggle(filters.types, t.v) })}>{t.l}</Chip>)}</div>
                </Section>
                <Section title="Labels">
                  <FilterMultiSelect label="Labels" options={labels} selected={filters.labels} onToggle={v => set({ labels: toggle(filters.labels, v) })} onClear={() => set({ labels: [] })} searchable searchPlaceholder="Search labels" emptyText="No labels yet" />
                </Section>
              </>
            )}

            {step === 3 && (
              <>
                <Section title="Name your dashboard">
                  <input value={name} onChange={e => { nameEdited.current = true; setName(e.target.value); }} aria-label="Dashboard name" data-testid="wizard-name" placeholder={scenario.name}
                    className="w-full text-sm border border-lira-border rounded-lg px-3 py-2.5 bg-white text-lira-text focus:outline-none focus:border-lira-blue focus:ring-1 focus:ring-lira-blue" />
                </Section>
                <Section title="Choose the widgets" hint={`${entries.length} selected. Widgets marked recommended fit "${scenario.name}". You can add, remove and rearrange later.`}>
                  <div className="space-y-4 max-h-[48vh] overflow-y-auto pr-1" data-testid="wizard-widgets">
                    {CATEGORY_ORDER.map(cat => (
                      <div key={cat}>
                        <h4 className="text-2xs font-bold uppercase tracking-wider text-lira-muted mb-1.5">{cat}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {CATALOG.filter(c => c.category === cat).map(c => {
                            const on = entries.includes(c.id);
                            return (
                              <label key={c.id} className={`flex items-start gap-2.5 rounded-lg border px-2.5 py-2 cursor-pointer transition-colors ${on ? 'border-lira-blue bg-blue-50/40' : 'border-lira-border hover:bg-gray-50'}`}>
                                <input type="checkbox" className="mt-0.5" checked={on} onChange={() => setEntries(e => toggle(e, c.id))} data-testid={`pick-${c.id}`} />
                                <span className="min-w-0"><span className="flex items-center gap-1.5 text-sm font-medium text-lira-text">{c.title}{recommended.has(c.id) && <span className="inline-flex items-center gap-0.5 text-4xs font-bold uppercase px-1 py-0.5 rounded bg-emerald-100 text-emerald-700"><Star className="w-2.5 h-2.5" />recommended</span>}</span><span className="block text-xs text-lira-muted">{c.description}</span></span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              </>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-lira-border">
              <button type="button" disabled={step === 0} onClick={() => setStep(s => s - 1)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-lira-muted hover:text-lira-text disabled:opacity-40 cursor-pointer"><ArrowLeft className="w-4 h-4" /> Back</button>
              {canNext ? (
                <button type="button" onClick={() => setStep(s => s + 1)} data-testid="wizard-next" className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-lira-blue hover:bg-lira-blue-hover rounded-lg cursor-pointer">Next <ArrowRight className="w-4 h-4" /></button>
              ) : (
                <button type="button" onClick={create} data-testid="wizard-create" className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-lira-blue hover:bg-lira-blue-hover rounded-lg cursor-pointer"><Check className="w-4 h-4" /> Create dashboard</button>
              )}
            </div>
          </div>

          {/* Live preview: the real widgets, shown small */}
          <aside aria-label="Preview" className="self-start rounded-2xl border border-lira-border bg-white p-3 shadow-xs hidden md:block" data-testid="wizard-preview">
            <h2 className="text-xs font-bold uppercase tracking-wider text-lira-muted px-1 pb-2">Preview</h2>
            <div className="overflow-hidden rounded-lg border border-lira-border bg-lira-bg" style={{ height: 520 }}>
              <div className="overflow-y-auto h-full">
                <div style={{ width: '200%', transform: 'scale(0.5)', transformOrigin: 'top left', pointerEvents: 'none' }} aria-hidden>
                  <div className="p-4">
                    <DashboardGrid dashboard={preview} ctx={ctx} onDrill={() => {}} onOpenIssue={() => {}} />
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

