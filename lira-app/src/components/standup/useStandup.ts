import { useEffect, useMemo, useState } from 'react';
import { notifySaved } from '../common/SavedToast';
import { useAllIssues } from '../../hooks/useIssues';
import type { Issue } from '../../types/issue';
import {
  type Standup, type StandupScope, type TeamMember, type Platform, type Repeat,
  REPEAT_LABEL, CALL_EVENT, agendaText, buildAgenda, downloadText, googleCalendarUrl, icsFile,
  inviteDescription, issuesForScope, loadDirectory, loadNotes, loadStandups, mailtoUrl, personKey,
  saveDirectory, saveNotes, saveStandups, teamFromIssues, teamsUrl, defaultName, startEnd,
  loadScopeExtras, addScopeExtra, removeScopeExtra,
} from '../../utils/standupUtils';

export type Tab = 'agenda' | 'schedule' | 'team';
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const todayStr = () => new Date().toISOString().slice(0, 10);
const nextWeekday = () => {
  const d = new Date();
  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const isStatus = (i: Issue, status: string) => i.status?.toLowerCase() === status;
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/** All the state and actions of the standup window: the agenda, the saved calls, the team and the invites. */
export function useStandup(isOpen: boolean, scope: StandupScope, onClose: () => void) {
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

  // The call being planned
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(nextWeekday());
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState(15);
  const [repeat, setRepeat] = useState<Repeat>('weekdays');
  const [platform, setPlatform] = useState<Platform>('meet');
  const [link, setLink] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Load what was saved each time the window opens
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

  // Everyone is invited by default; the person can untick people
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
  const toggleMember = (key: string) => setSelected(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const updateMember = (m: TeamMember, patch: Partial<TeamMember>) => {
    const next = { ...dir, [m.key]: { ...m, ...patch } };
    setDir(next);
    saveDirectory(next);
  };

  const addExtra = () => {
    const email = newEmail.trim();
    if (!EMAIL_RE.test(email)) { flash('Enter a valid email address'); return; }
    const next = { ...dir, [email]: { key: email, name: newName.trim() || email.split('@')[0], email } };
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

  /** The invite buttons need at least one person with an email. */
  const canInvite = (): boolean => {
    const problem = invited.length === 0 ? 'Select at least one team member'
      : invitedEmails.length === 0 ? 'Add email addresses for the team so the invite can reach them' : '';
    if (problem) { flash(problem); setTab('team'); }
    return !problem;
  };

  const sendGoogle = () => {
    if (!canInvite()) return;
    const s = { ...draft(), platform: 'meet' as Platform };
    persist(s);
    window.open(googleCalendarUrl(s, invitedEmails, description(s)), '_blank', 'noopener');
    flash(`Google Calendar opened with ${plural(invitedEmails.length, 'guest')} — press Save to send the Meet invite.`);
  };
  const sendTeams = () => {
    if (!canInvite()) return;
    const s = { ...draft(), platform: 'teams' as Platform };
    persist(s);
    window.open(teamsUrl(s, invitedEmails, description(s)), '_blank', 'noopener');
    flash(`Teams scheduler opened with ${plural(invitedEmails.length, 'attendee')} — press Send there.`);
  };
  const downloadIcs = () => {
    if (!canInvite()) return;
    const s = draft();
    persist(s);
    downloadText(`${scope.name.replace(/\W+/g, '-')}-standup.ics`, icsFile(s, invited, description(s)));
    flash('Calendar file downloaded — open it in Outlook, Apple Calendar or Google Calendar to send it.');
  };
  const emailTeam = () => {
    if (!canInvite()) return;
    const s = draft();
    window.location.href = mailtoUrl(s, invitedEmails, `${description(s)}\n\nWhen: ${startEnd(s).start.toLocaleString()} (${REPEAT_LABEL[s.repeat]}, ${s.duration} min)`);
  };
  const saveOnly = () => { persist(draft()); notifySaved('Standup saved'); };

  const removeSaved = (id: string) => {
    const all = loadStandups().filter(s => s.id !== id);
    saveStandups(all);
    setSaved(all.filter(x => x.scopeId === scope.id));
  };

  const openIssue = (issue: Issue) => {
    onClose();
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('lira-open-issue', { detail: issue })), 120);
  };

  const changeNotes = (text: string) => { setNotes(text); saveNotes(scope.id, todayStr(), text); };
  const copyAgenda = async () => {
    try {
      await navigator.clipboard.writeText(agendaText(scope.name, agenda, notes));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { flash('Could not copy — select the text manually'); }
  };

  // The "by person" view: what each person did, is doing, and does next
  const people = useMemo(() => {
    const row = (key: string, name: string, mine: Issue[], done: Issue[], blocked: typeof agenda.blocked, stale: typeof agenda.needsUpdate) => ({
      key, name, done, blocked, stale,
      doing: mine.filter(i => isStatus(i, 'inprogress')),
      next: mine.filter(i => isStatus(i, 'todo')).slice(0, 3),
    });
    const keys = Array.from(new Set(scoped.map(personKey).filter((k): k is string => !!k))).sort();
    const rows = keys.map(k => row(
      k, dir[k]?.name || defaultName(k), scoped.filter(i => personKey(i) === k),
      agenda.doneRecently.filter(i => personKey(i) === k), agenda.blocked.filter(b => personKey(b.issue) === k), agenda.needsUpdate.filter(n => personKey(n.issue) === k),
    ));
    if (agenda.unassigned.length) rows.push(row('—', 'Unassigned', agenda.unassigned, [], [], agenda.needsUpdate.filter(n => !personKey(n.issue))));
    return rows;
  }, [scoped, agenda, dir]);

  return {
    scope, scoped, agenda, people, members, invited, invitedEmails, missingEmail, extras, selected, saved,
    tab, setTab, view, setView, msg, copied, notes, changeNotes, copyAgenda,
    title, setTitle, startDate, setStartDate, time, setTime, duration, setDuration, repeat, setRepeat, platform, setPlatform, link, setLink,
    newName, setNewName, newEmail, setNewEmail,
    toggleMember, updateMember, addExtra, removeExtra, removeSaved, openIssue,
    sendGoogle, sendTeams, downloadIcs, emailTeam, saveOnly,
  };
}

export type StandupState = ReturnType<typeof useStandup>;
