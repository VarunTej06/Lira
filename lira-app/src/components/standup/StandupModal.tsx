import React, { useEffect, useMemo, useState } from 'react';
import {
  Video, CalendarPlus, Download, Mail, Copy, Check, Trash2, Plus, Users, ListChecks, AlertTriangle,
  Clock, Ban, Sparkles, ExternalLink, UserRound, Calendar,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Avatar } from '../common/Avatar';
import { useAllIssues } from '../../hooks/useIssues';
import type { Issue } from '../../types/issue';
import { ISSUE_TYPE_CONFIG } from '../../types/issue';
import {
  type Standup, type StandupScope, type TeamMember, type Platform, type Repeat,
  PLATFORM_LABEL, REPEAT_LABEL, CALL_EVENT, CALL_TITLE, agendaText, buildAgenda, downloadText, googleCalendarUrl, icsFile,
  inviteDescription, issuesForScope, loadDirectory, loadNotes, loadStandups, mailtoUrl, personKey,
  saveDirectory, saveNotes, saveStandups, teamFromIssues, teamsUrl, defaultName, startEnd,
  loadScopeExtras, addScopeExtra, removeScopeExtra,
} from '../../utils/standupUtils';

interface StandupModalProps {
  isOpen: boolean;
  onClose: () => void;
  scope: StandupScope;
}

type Tab = 'agenda' | 'schedule' | 'team';
const todayStr = () => new Date().toISOString().slice(0, 10);
const nextWeekday = () => {
  const d = new Date();
  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Standup hub: today's agenda from live tickets, plus scheduling a recurring call with calendar invites for the team. */
export const StandupModal: React.FC<StandupModalProps> = ({ isOpen, onClose, scope }) => {
  const everything = useAllIssues() || [];
  const scoped = useMemo(() => issuesForScope(everything, scope), [everything, scope]);
  const agenda = useMemo(() => buildAgenda(scoped, everything), [scoped, everything]);

  const [tab, setTab] = useState<Tab>('agenda');
  const [view, setView] = useState<'status' | 'person'>('status');
  const [dir, setDir] = useState<Record<string, TeamMember>>({});
  const [extras, setExtras] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Standup[]>([]);
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(nextWeekday());
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState(15);
  const [repeat, setRepeat] = useState<Repeat>('weekdays');
  const [platform, setPlatform] = useState<Platform>('meet');
  const [link, setLink] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Load persisted state each time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setTab('agenda');
    setDir(loadDirectory());
    setExtras(loadScopeExtras(scope));
    setSaved(loadStandups().filter(s => s.scopeId === scope.id));
    setNotes(loadNotes(scope.id, todayStr()));
    setTitle(`${scope.name} · ${CALL_EVENT[scope.type]}`);
    setMsg(null);
  }, [isOpen, scope.id, scope.name]);

  const members: TeamMember[] = useMemo(() => {
    const fromTickets = teamFromIssues(scoped, dir);
    const manual = extras.map(k => dir[k]).filter((m): m is TeamMember => !!m);
    const seen = new Set<string>();
    return [...fromTickets, ...manual].filter(m => (seen.has(m.key) ? false : (seen.add(m.key), true)));
  }, [scoped, dir, extras]);

  // Everyone is invited by default; the user can untick people
  useEffect(() => {
    setSelected(prev => {
      const next = new Set(prev);
      members.forEach(m => { if (!prev.has(m.key) && !(prev.size > 0 && prev.has('__init'))) next.add(m.key); });
      next.add('__init');
      return next;
    });
  }, [members]);

  const invited = members.filter(m => selected.has(m.key));
  const invitedEmails = invited.map(m => m.email).filter(e => EMAIL_RE.test(e));
  const missingEmail = invited.filter(m => !EMAIL_RE.test(m.email));

  const flash = (t: string) => { setMsg(t); window.setTimeout(() => setMsg(null), 4000); };

  const updateMember = (m: TeamMember, patch: Partial<TeamMember>) => {
    const next = { ...dir, [m.key]: { ...m, ...patch } };
    setDir(next);
    saveDirectory(next);
  };

  const addExtra = () => {
    const email = newEmail.trim();
    if (!EMAIL_RE.test(email)) { flash('Enter a valid email address'); return; }
    const member: TeamMember = { key: email, name: newName.trim() || email.split('@')[0], email };
    const next = { ...dir, [email]: member };
    setDir(next);
    saveDirectory(next);
    addScopeExtra(scope, email);
    setExtras(loadScopeExtras(scope));
    setSelected(prev => new Set(prev).add(email));
    setNewName(''); setNewEmail('');
  };

  const removeExtra = (key: string) => {
    removeScopeExtra(scope, key);
    setExtras(loadScopeExtras(scope));
  };

  const draft = (): Standup => ({
    id: `standup-${Date.now()}`,
    scopeId: scope.id, title: title.trim() || `${scope.name} · ${CALL_EVENT[scope.type]}`,
    startDate, time, duration, repeat, platform, link: link.trim(),
    memberKeys: invited.map(m => m.key), createdAt: new Date().toISOString(),
  });

  const persist = (s: Standup) => {
    const all = [s, ...loadStandups()];
    saveStandups(all);
    setSaved(all.filter(x => x.scopeId === scope.id));
  };

  const description = (s: Standup) => inviteDescription(scope.name, agenda, s.platform, s.link, CALL_EVENT[scope.type]);

  const guard = (): boolean => {
    if (invited.length === 0) { flash('Select at least one team member'); setTab('team'); return false; }
    if (invitedEmails.length === 0) { flash('Add email addresses for the team so the invite can reach them'); setTab('team'); return false; }
    return true;
  };

  const sendGoogle = () => {
    if (!guard()) return;
    const s = { ...draft(), platform: 'meet' as Platform };
    persist(s);
    window.open(googleCalendarUrl(s, invitedEmails, description(s)), '_blank', 'noopener');
    flash(`Google Calendar opened with ${invitedEmails.length} guest${invitedEmails.length > 1 ? 's' : ''} — press Save to send the Meet invite.`);
  };
  const sendTeams = () => {
    if (!guard()) return;
    const s = { ...draft(), platform: 'teams' as Platform };
    persist(s);
    window.open(teamsUrl(s, invitedEmails, description(s)), '_blank', 'noopener');
    flash(`Teams scheduler opened with ${invitedEmails.length} attendee${invitedEmails.length > 1 ? 's' : ''} — press Send there.`);
  };
  const downloadIcs = () => {
    if (!guard()) return;
    const s = draft();
    persist(s);
    downloadText(`${scope.name.replace(/\W+/g, '-')}-standup.ics`, icsFile(s, invited, description(s)));
    flash('Calendar file downloaded — open it in Outlook, Apple Calendar or Google Calendar to send it.');
  };
  const emailTeam = () => {
    if (!guard()) return;
    const s = draft();
    window.location.href = mailtoUrl(s, invitedEmails, `${description(s)}\n\nWhen: ${startEnd(s).start.toLocaleString()} (${REPEAT_LABEL[s.repeat]}, ${s.duration} min)`);
  };
  const saveOnly = () => { persist(draft()); flash('Saved'); };

  const removeSaved = (id: string) => {
    const all = loadStandups().filter(s => s.id !== id);
    saveStandups(all);
    setSaved(all.filter(x => x.scopeId === scope.id));
  };

  const openIssue = (issue: Issue) => {
    onClose();
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('lira-open-issue', { detail: issue })), 120);
  };

  const copyAgenda = async () => {
    try {
      await navigator.clipboard.writeText(agendaText(scope.name, agenda, notes));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { flash('Could not copy — select the text manually'); }
  };

  // ── per-person view data ──
  const people = useMemo(() => {
    const keys = new Set<string>();
    scoped.forEach(i => { const k = personKey(i); if (k) keys.add(k); });
    const rows = Array.from(keys).sort().map(k => {
      const mine = scoped.filter(i => personKey(i) === k);
      return {
        key: k,
        name: dir[k]?.name || defaultName(k),
        done: agenda.doneRecently.filter(i => personKey(i) === k),
        doing: mine.filter(i => i.status?.toLowerCase() === 'inprogress'),
        next: mine.filter(i => i.status?.toLowerCase() === 'todo').slice(0, 3),
        blocked: agenda.blocked.filter(b => personKey(b.issue) === k),
        stale: agenda.needsUpdate.filter(n => personKey(n.issue) === k),
      };
    });
    if (agenda.unassigned.length) rows.push({ key: '—', name: 'Unassigned', done: [], doing: agenda.unassigned.filter(i => i.status?.toLowerCase() === 'inprogress'), next: agenda.unassigned.filter(i => i.status?.toLowerCase() === 'todo').slice(0, 3), blocked: [], stale: agenda.needsUpdate.filter(n => !personKey(n.issue)) });
    return rows;
  }, [scoped, agenda, dir]);

  // ── small UI helpers ──
  const Row: React.FC<{ issue: Issue; note?: string; tone?: string }> = ({ issue, note, tone }) => (
    <button onClick={() => openIssue(issue)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 border-b border-jira-border last:border-0 transition-colors cursor-pointer">
      <span className="text-sm">{(ISSUE_TYPE_CONFIG[issue.type] ?? ISSUE_TYPE_CONFIG.task).symbol}</span>
      <span className="font-mono text-[11px] text-jira-muted w-20 flex-shrink-0">{issue.key}</span>
      <span className="flex-1 min-w-0 text-sm text-jira-text truncate">{issue.title}</span>
      {note && <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${tone || 'bg-gray-100 text-gray-600'}`}>{note}</span>}
      <Avatar initials={issue.assigneeInitials} size="xs" />
    </button>
  );

  const Section: React.FC<{ title: string; icon: React.ReactNode; count: number; empty: string; children: React.ReactNode }> = ({ title, icon, count, empty, children }) => (
    <section className="border border-jira-border rounded-2xl overflow-hidden bg-white">
      <header className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-jira-border">
        {icon}<h3 className="text-xs font-semibold text-jira-text uppercase tracking-wide">{title}</h3>
        <span className="text-[11px] text-jira-muted">{count}</span>
      </header>
      {count === 0 ? <p className="px-3 py-4 text-xs text-jira-muted">{empty}</p> : children}
    </section>
  );

  const sevTone = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-gray-100 text-gray-600' };
  const scopeLabel = { space: 'Space', project: 'Project', sprint: 'Sprint' }[scope.type];
  const field = 'w-full text-sm border border-jira-border rounded-xl px-3 py-2 bg-white text-jira-text focus:outline-none focus:border-jira-blue';
  const lbl = 'block text-[11px] font-semibold text-jira-muted mb-1 uppercase tracking-wide';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={CALL_TITLE[scope.type]} size="xl">
      <div className="flex flex-col max-h-[78vh]">
        {/* Header strip */}
        <div className="px-6 pt-4 pb-3 border-b border-jira-border flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-blue-50 text-jira-blue">{scopeLabel}</span>
          <h2 className="text-base font-semibold text-jira-text truncate">{scope.name}</h2>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Beta</span>
          <span className="text-xs text-jira-muted ml-auto">{scoped.length} tickets · {members.length} people</span>
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-1 border-b border-jira-border">
          {([['agenda', 'Agenda', <ListChecks key="a" className="w-3.5 h-3.5" />], ['schedule', 'Schedule & invite', <CalendarPlus key="s" className="w-3.5 h-3.5" />], ['team', `Team (${members.length})`, <Users key="t" className="w-3.5 h-3.5" />]] as const).map(([id, label, icon]) => (
            <button key={id} onClick={() => setTab(id as Tab)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${tab === id ? 'text-jira-blue border-jira-blue' : 'text-jira-muted border-transparent hover:text-jira-text'}`}>
              {icon}{label}
            </button>
          ))}
        </div>

        {msg && <div className="mx-6 mt-3 text-xs rounded-xl bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2">{msg}</div>}

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* ───────── AGENDA ───────── */}
          {tab === 'agenda' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { l: 'Need an update', v: agenda.needsUpdate.length, c: 'text-red-600' },
                  { l: 'In progress', v: agenda.inProgress.length, c: 'text-jira-blue' },
                  { l: 'Blocked', v: agenda.blocked.length, c: 'text-amber-600' },
                  { l: 'To do / backlog', v: agenda.upNext.length + agenda.backlog.length, c: 'text-jira-text' },
                  { l: 'Done · 24h', v: agenda.doneRecently.length, c: 'text-emerald-600' },
                ].map(t => (
                  <div key={t.l} className="border border-jira-border rounded-xl px-3 py-2 bg-white">
                    <div className={`text-xl font-semibold ${t.c}`}>{t.v}</div>
                    <div className="text-[11px] text-jira-muted">{t.l}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-xl border border-jira-border overflow-hidden text-xs">
                  {(['status', 'person'] as const).map(v => (
                    <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 cursor-pointer ${view === v ? 'bg-jira-blue text-white' : 'bg-white text-jira-muted hover:text-jira-text'}`}>
                      {v === 'status' ? 'By status' : 'By person'}
                    </button>
                  ))}
                </div>
                <button onClick={copyAgenda} className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-jira-border bg-white hover:bg-gray-50 text-jira-text cursor-pointer">
                  {copied ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy call notes</>}
                </button>
              </div>

              {view === 'status' ? (
                <div className="space-y-3">
                  <Section title="Needs an update" icon={<AlertTriangle className="w-3.5 h-3.5 text-red-500" />} count={agenda.needsUpdate.length} empty="Everything is up to date 🎉">
                    {agenda.needsUpdate.map(n => <Row key={n.issue.id} issue={n.issue} note={n.reason} tone={sevTone[n.severity]} />)}
                  </Section>
                  <Section title="Blocked" icon={<Ban className="w-3.5 h-3.5 text-amber-500" />} count={agenda.blocked.length} empty="Nothing is blocked.">
                    {agenda.blocked.map(b => <Row key={b.issue.id} issue={b.issue} note={`blocked by ${b.blockedBy.map(x => x.key).join(', ')}`} tone="bg-amber-100 text-amber-700" />)}
                  </Section>
                  <Section title="In progress" icon={<Clock className="w-3.5 h-3.5 text-jira-blue" />} count={agenda.inProgress.length} empty="Nothing in progress.">
                    {agenda.inProgress.map(i => <Row key={i.id} issue={i} />)}
                  </Section>
                  <Section title="Done in the last 24 hours" icon={<Sparkles className="w-3.5 h-3.5 text-emerald-500" />} count={agenda.doneRecently.length} empty="Nothing finished yet.">
                    {agenda.doneRecently.map(i => <Row key={i.id} issue={i} />)}
                  </Section>
                  <Section title="Up next · To do" icon={<ListChecks className="w-3.5 h-3.5 text-jira-muted" />} count={agenda.upNext.length} empty="Nothing waiting.">
                    {agenda.upNext.slice(0, 8).map(i => <Row key={i.id} issue={i} />)}
                  </Section>
                  <Section title="Backlog (top)" icon={<ListChecks className="w-3.5 h-3.5 text-jira-muted" />} count={agenda.backlog.length} empty="Backlog is empty.">
                    {agenda.backlog.slice(0, 6).map(i => <Row key={i.id} issue={i} />)}
                  </Section>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {people.length === 0 && <p className="text-sm text-jira-muted">No assigned tickets in this scope.</p>}
                  {people.map(p => (
                    <div key={p.key} className="border border-jira-border rounded-2xl bg-white overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-jira-border">
                        <Avatar initials={p.key === '—' ? '?' : p.key} size="sm" />
                        <span className="text-sm font-semibold text-jira-text">{p.name}</span>
                        {p.stale.length > 0 && <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">{p.stale.length} need update</span>}
                      </div>
                      {[['Yesterday', p.done], ['Today', p.doing], ['Next', p.next]].map(([label, list]) => (
                        <div key={label as string} className="px-3 py-1.5 border-b border-jira-border last:border-0">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-jira-muted mb-0.5">{label as string}</div>
                          {(list as Issue[]).length === 0 ? <div className="text-xs text-jira-muted">—</div> : (list as Issue[]).map(i => (
                            <button key={i.id} onClick={() => openIssue(i)} className="block w-full text-left text-xs text-jira-text truncate hover:text-jira-blue cursor-pointer py-0.5">
                              <span className="font-mono text-jira-muted mr-1.5">{i.key}</span>{i.title}
                            </button>
                          ))}
                        </div>
                      ))}
                      {p.blocked.length > 0 && (
                        <div className="px-3 py-1.5 bg-amber-50/60">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-0.5">Blockers</div>
                          {p.blocked.map(b => <div key={b.issue.id} className="text-xs text-amber-800 truncate">{b.issue.key} ← {b.blockedBy.map(x => x.key).join(', ')}</div>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className={lbl}>Notes & action items (saved for today)</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => { setNotes(e.target.value); saveNotes(scope.id, todayStr(), e.target.value); }}
                  placeholder="Decisions, blockers to chase, parking lot…"
                  className={field}
                />
              </div>
            </>
          )}

          {/* ───────── SCHEDULE ───────── */}
          {tab === 'schedule' && (
            <>
              {saved.length > 0 && (
                <section className="border border-jira-border rounded-2xl overflow-hidden bg-white">
                  <header className="px-3 py-2 bg-gray-50 border-b border-jira-border text-xs font-semibold text-jira-text uppercase tracking-wide">Scheduled calls</header>
                  {saved.map(s => (
                    <div key={s.id} className="flex items-center gap-3 px-3 py-2 border-b border-jira-border last:border-0">
                      <Video className="w-4 h-4 text-jira-blue flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-jira-text truncate">{s.title}</div>
                        <div className="text-[11px] text-jira-muted">{REPEAT_LABEL[s.repeat]} · {s.time} · {s.duration} min · {PLATFORM_LABEL[s.platform]} · {s.memberKeys.length} people</div>
                      </div>
                      {s.link && (
                        <a href={s.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-jira-blue text-white hover:bg-jira-blue-hover">
                          Join <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <button onClick={() => removeSaved(s.id)} className="p-1.5 rounded-lg text-jira-muted hover:text-red-600 hover:bg-red-50 cursor-pointer" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </section>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className={lbl}>Title</label>
                  <input className={field} value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Start date</label>
                  <input type="date" className={field} value={startDate} min={todayStr()} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Time</label>
                    <input type="time" className={field} value={time} onChange={e => setTime(e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Length</label>
                    <select className={field} value={duration} onChange={e => setDuration(Number(e.target.value))}>
                      {[10, 15, 20, 30, 45, 60].map(m => <option key={m} value={m}>{m} min</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={lbl}>Repeats</label>
                  <select className={field} value={repeat} onChange={e => setRepeat(e.target.value as Repeat)}>
                    {(Object.keys(REPEAT_LABEL) as Repeat[]).map(r => <option key={r} value={r}>{REPEAT_LABEL[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Meeting tool your team uses</label>
                  <select className={field} value={platform} onChange={e => setPlatform(e.target.value as Platform)}>
                    {(Object.keys(PLATFORM_LABEL) as Platform[]).map(p => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={lbl}>Meeting link (optional — paste it after creating the invite so “Join” works)</label>
                  <input className={field} value={link} onChange={e => setLink(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" />
                </div>
              </div>

              <div className="rounded-2xl border border-jira-border bg-gray-50 px-4 py-3 text-xs text-jira-muted">
                Inviting the <strong className="text-jira-text">{scope.name}</strong> team: <strong className="text-jira-text">{invitedEmails.length}</strong> of {invited.length} people have an email
                {missingEmail.length > 0 && <> — missing: {missingEmail.map(m => m.name).join(', ')} (<button className="text-jira-blue underline cursor-pointer" onClick={() => setTab('team')}>add emails</button>)</>}.
                Lira opens a pre-filled invite for everyone; you confirm it in your calendar, which then emails the whole team.
              </div>

              <div className="grid sm:grid-cols-2 gap-2">
                <button onClick={sendGoogle} className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-jira-border bg-white hover:border-jira-blue hover:bg-blue-50/40 transition-colors text-left cursor-pointer">
                  <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><Video className="w-4 h-4" /></span>
                  <span><span className="block text-sm font-semibold text-jira-text">Google Meet invite</span><span className="block text-[11px] text-jira-muted">Pre-filled Google Calendar event, whole team as guests</span></span>
                </button>
                <button onClick={sendTeams} className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-jira-border bg-white hover:border-jira-blue hover:bg-blue-50/40 transition-colors text-left cursor-pointer">
                  <span className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center"><Video className="w-4 h-4" /></span>
                  <span><span className="block text-sm font-semibold text-jira-text">Microsoft Teams invite</span><span className="block text-[11px] text-jira-muted">Pre-filled Teams meeting with all attendees</span></span>
                </button>
                <button onClick={downloadIcs} className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-jira-border bg-white hover:border-jira-blue hover:bg-blue-50/40 transition-colors text-left cursor-pointer">
                  <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center"><Download className="w-4 h-4" /></span>
                  <span><span className="block text-sm font-semibold text-jira-text">Download .ics</span><span className="block text-[11px] text-jira-muted">Works with Outlook, Apple Calendar and others</span></span>
                </button>
                <button onClick={emailTeam} className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-jira-border bg-white hover:border-jira-blue hover:bg-blue-50/40 transition-colors text-left cursor-pointer">
                  <span className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center"><Mail className="w-4 h-4" /></span>
                  <span><span className="block text-sm font-semibold text-jira-text">Email the team</span><span className="block text-[11px] text-jira-muted">Draft with time and tickets that need updates</span></span>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <button onClick={() => window.open('https://meet.google.com/new', '_blank', 'noopener')} className="text-xs text-jira-blue hover:underline cursor-pointer flex items-center gap-1">
                  <Video className="w-3.5 h-3.5" /> Start an instant Google Meet now
                </button>
                <button onClick={saveOnly} className="text-sm px-4 py-2 rounded-xl bg-jira-blue text-white hover:bg-jira-blue-hover cursor-pointer flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> Save call
                </button>
              </div>
            </>
          )}

          {/* ───────── TEAM ───────── */}
          {tab === 'team' && (
            <>
              <div className="rounded-2xl border border-jira-border bg-gray-50 px-4 py-3 text-xs text-jira-muted space-y-1">
                <p>
                  <strong className="text-jira-text">Invites go to the team assigned to this {scopeLabel.toLowerCase()}.</strong>{' '}
                  {scope.type === 'sprint'
                    ? 'The sprint team is everyone with a ticket in it, plus anyone added to its space.'
                    : scope.type === 'project'
                      ? 'The project team is everyone with a ticket in it, plus anyone added to the project or its space.'
                      : 'The space team is everyone with a ticket in it, plus anyone added here.'}
                </p>
                <p>Dedicated Teams (named groups per space and project) are coming in a later version — they will replace this automatic list. Emails are remembered for every space, project and sprint.</p>
              </div>
              <section className="border border-jira-border rounded-2xl overflow-hidden bg-white">
                {members.length === 0 && <p className="px-4 py-6 text-sm text-jira-muted">No assignees yet — add people below.</p>}
                {members.map(m => (
                  <div key={m.key} className="flex items-center gap-3 px-3 py-2 border-b border-jira-border last:border-0">
                    <input type="checkbox" checked={selected.has(m.key)} onChange={() => setSelected(prev => { const n = new Set(prev); n.has(m.key) ? n.delete(m.key) : n.add(m.key); return n; })} className="cursor-pointer" aria-label={`Invite ${m.name}`} />
                    <Avatar initials={m.key.length <= 3 ? m.key : m.name.slice(0, 2).toUpperCase()} size="sm" />
                    <input className="text-sm border border-transparent hover:border-jira-border focus:border-jira-blue rounded-lg px-2 py-1 bg-transparent text-jira-text w-40 outline-none" value={m.name} onChange={e => updateMember(m, { name: e.target.value })} />
                    <input
                      className={`flex-1 text-sm border rounded-lg px-2 py-1 bg-white text-jira-text outline-none focus:border-jira-blue ${m.email && !EMAIL_RE.test(m.email) ? 'border-red-300' : 'border-jira-border'}`}
                      placeholder="email@company.com" value={m.email} onChange={e => updateMember(m, { email: e.target.value })}
                    />
                    {extras.includes(m.key) && <button onClick={() => removeExtra(m.key)} className="p-1.5 rounded-lg text-jira-muted hover:text-red-600 hover:bg-red-50 cursor-pointer" title="Remove from this team"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                ))}
              </section>
              <div className="flex gap-2 items-end">
                <div className="w-44"><label className={lbl}>Name</label><input className={field} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Teammate" /></div>
                <div className="flex-1"><label className={lbl}>Email</label><input className={field} value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="name@company.com" onKeyDown={e => e.key === 'Enter' && addExtra()} /></div>
                <button onClick={addExtra} className="flex items-center gap-1 text-sm px-3 py-2 rounded-xl border border-jira-border bg-white hover:bg-gray-50 text-jira-text cursor-pointer"><Plus className="w-4 h-4" /> Add</button>
              </div>
              <p className="text-[11px] text-jira-muted flex items-center gap-1"><UserRound className="w-3 h-3" /> Emails are stored only in this browser.</p>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
