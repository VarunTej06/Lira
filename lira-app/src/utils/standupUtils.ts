import type { Issue } from '../types/issue';
import { isDone, getIssueSprint } from './sprintUtils';
import { appStorage } from './appStorage';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ScopeType = 'space' | 'project' | 'sprint';
export type Platform = 'meet' | 'teams' | 'other';
export type Repeat = 'none' | 'weekdays' | 'daily' | 'weekly';

/** What a standup is about: a whole space, a project, or one monthly sprint (optionally within a space). */
export interface StandupScope {
  type: ScopeType;
  id: string;            // stable key, e.g. "space:6", "project:proj-lira-core", "sprint:2026-11:all"
  name: string;          // shown in titles
  spaceId?: number;
  projectKey?: string;   // projects also match tickets by key prefix
  sprint?: string;       // YYYY-MM
}

export interface TeamMember {
  key: string;           // initials or email — unique id
  name: string;
  email: string;
}

export interface Standup {
  id: string;
  scopeId: string;
  title: string;
  startDate: string;     // YYYY-MM-DD
  time: string;          // HH:mm (local)
  duration: number;      // minutes
  repeat: Repeat;
  platform: Platform;
  link: string;          // meeting link pasted after the invite is created (optional)
  memberKeys: string[];
  createdAt: string;
}

// ─── Storage ─────────────────────────────────────────────────────────────────

const DIR_KEY = 'lira_team_directory';
const STANDUPS_KEY = 'lira_standups';
const NOTES_KEY = 'lira_standup_notes';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = appStorage.get(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try { appStorage.set(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export const loadDirectory = () => read<Record<string, TeamMember>>(DIR_KEY, {});
export const saveDirectory = (d: Record<string, TeamMember>) => write(DIR_KEY, d);
export const loadStandups = () => read<Standup[]>(STANDUPS_KEY, []);
export const saveStandups = (list: Standup[]) => write(STANDUPS_KEY, list);
export const loadNotes = (scopeId: string, day: string) => read<Record<string, string>>(NOTES_KEY, {})[`${scopeId}:${day}`] || '';
export function saveNotes(scopeId: string, day: string, text: string) {
  const all = read<Record<string, string>>(NOTES_KEY, {});
  all[`${scopeId}:${day}`] = text;
  write(NOTES_KEY, all);
}

// ─── Scope + people ──────────────────────────────────────────────────────────

export function issuesForScope(all: Issue[], scope: StandupScope): Issue[] {
  const work = all.filter(i => i.type !== 'epic');
  return work.filter(i => {
    if (scope.type === 'space') return i.spaceId === scope.spaceId;
    if (scope.type === 'project') {
      return (scope.spaceId !== undefined && i.spaceId === scope.spaceId) ||
        (!!scope.projectKey && i.key.startsWith(`${scope.projectKey}-`));
    }
    // sprint: ticket's sprint, optionally narrowed to one space
    const sprint = getIssueSprint(i);
    return sprint === scope.sprint && (scope.spaceId === undefined || i.spaceId === scope.spaceId);
  });
}

// ── Team assignment ─────────────────────────────────────────────────────────
// Invites go to the team assigned to the space / project / sprint. A dedicated Teams feature is planned;
// until then a scope's team is: everyone assigned to its tickets + people added to the owning space/project.
// People added at space level are inherited by that space's projects and sprints.

const TEAM_PREFIX = 'lira_scope_team:';

/** Storage owners for a scope, most specific first. Additions are saved to the first one. */
export function ownerKeys(scope: StandupScope): string[] {
  if (scope.type === 'space') return [scope.id];
  if (scope.type === 'project') return [scope.id, ...(scope.spaceId !== undefined ? [`space:${scope.spaceId}`] : [])];
  return scope.spaceId !== undefined ? [`space:${scope.spaceId}`] : ['global'];
}

function allTeamStorageKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(TEAM_PREFIX)) keys.push(k.slice(TEAM_PREFIX.length));
    }
  } catch { /* storage unavailable */ }
  return keys;
}

export function loadScopeExtras(scope: StandupScope): string[] {
  // A sprint across all spaces includes the added people of every space
  const owners = scope.type === 'sprint' && scope.spaceId === undefined ? allTeamStorageKeys() : ownerKeys(scope);
  const out = new Set<string>();
  owners.forEach(o => read<string[]>(TEAM_PREFIX + o, []).forEach(k => out.add(k)));
  return Array.from(out);
}

export function addScopeExtra(scope: StandupScope, memberKey: string) {
  const owner = ownerKeys(scope)[0];
  write(TEAM_PREFIX + owner, Array.from(new Set([...read<string[]>(TEAM_PREFIX + owner, []), memberKey])));
}

export function removeScopeExtra(scope: StandupScope, memberKey: string) {
  const owners = scope.type === 'sprint' && scope.spaceId === undefined ? allTeamStorageKeys() : ownerKeys(scope);
  owners.forEach(o => write(TEAM_PREFIX + o, read<string[]>(TEAM_PREFIX + o, []).filter(k => k !== memberKey)));
}

export function personKey(i: Issue): string | undefined {
  return i.assigneeInitials || i.assignee || undefined;
}

export function defaultName(key: string): string {
  if (key.toUpperCase() === 'VY') return 'Varun Tej';
  return key;
}

/** Everyone who has a ticket in scope, merged with saved directory details. */
export function teamFromIssues(issues: Issue[], dir: Record<string, TeamMember>): TeamMember[] {
  const keys = new Set<string>();
  issues.forEach(i => { const k = personKey(i); if (k) keys.add(k); });
  return Array.from(keys).sort().map(k => dir[k] || { key: k, name: defaultName(k), email: '' });
}

// ─── Agenda ──────────────────────────────────────────────────────────────────

const DAY = 86_400_000;
interface AgendaItem { issue: Issue; reason: string; severity: 'high' | 'medium' | 'low' }

interface Agenda {
  needsUpdate: AgendaItem[];
  inProgress: Issue[];
  blocked: { issue: Issue; blockedBy: Issue[] }[];
  overdue: Issue[];
  upNext: Issue[];        // to do
  backlog: Issue[];
  doneRecently: Issue[];  // finished in the last 24h
  unassigned: Issue[];
}

export function buildAgenda(scoped: Issue[], everything: Issue[], now = Date.now()): Agenda {
  const byId = new Map(everything.map(i => [i.id!, i]));
  const open = scoped.filter(i => !isDone(i));
  const status = (i: Issue) => i.status?.toLowerCase();
  const touched = (i: Issue) => new Date(i.updatedAt || i.createdAt).getTime();
  const priorityRank = (i: Issue) => ['highest', 'high', 'medium', 'low', 'lowest'].indexOf(i.priority);

  const needsUpdate: AgendaItem[] = [];
  open.forEach(i => {
    const idleDays = Math.floor((now - touched(i)) / DAY);
    const due = i.dueDate ? new Date(i.dueDate).getTime() : undefined;
    if (due !== undefined && due < now) {
      needsUpdate.push({ issue: i, reason: `Overdue by ${Math.max(1, Math.ceil((now - due) / DAY))}d`, severity: 'high' });
    } else if (status(i) === 'inprogress' && idleDays >= 2) {
      needsUpdate.push({ issue: i, reason: `In progress, no update for ${idleDays}d`, severity: idleDays >= 5 ? 'high' : 'medium' });
    } else if (due !== undefined && due - now <= 2 * DAY) {
      needsUpdate.push({ issue: i, reason: 'Due within 2 days', severity: 'medium' });
    } else if (status(i) === 'inprogress' && !personKey(i)) {
      needsUpdate.push({ issue: i, reason: 'In progress but unassigned', severity: 'medium' });
    } else if ((status(i) === 'todo' || status(i) === 'backlog') && idleDays >= 14) {
      needsUpdate.push({ issue: i, reason: `Stale — untouched for ${idleDays}d`, severity: 'low' });
    }
  });
  const sev = { high: 0, medium: 1, low: 2 } as const;
  needsUpdate.sort((a, b) => sev[a.severity] - sev[b.severity]);

  const blocked = open.map(i => ({
    issue: i,
    blockedBy: [
      ...(i.blockedByIds ?? []).map(id => byId.get(id)),
      ...(i.linkedIssues || []).filter(l => l.linkType === 'blocked_by').map(l => byId.get(l.issueId)),
    ].filter((x, n, all): x is Issue => !!x && !isDone(x) && all.indexOf(x) === n),
  })).filter(b => b.issue.blocked || b.blockedBy.length > 0); // switched to Blocked, or linked to an open blocker

  return {
    needsUpdate,
    inProgress: open.filter(i => status(i) === 'inprogress').sort((a, b) => priorityRank(a) - priorityRank(b)),
    blocked,
    overdue: open.filter(i => i.dueDate && new Date(i.dueDate).getTime() < now),
    upNext: open.filter(i => status(i) === 'todo').sort((a, b) => priorityRank(a) - priorityRank(b)),
    backlog: open.filter(i => status(i) === 'backlog').sort((a, b) => priorityRank(a) - priorityRank(b)),
    doneRecently: scoped.filter(i => isDone(i) && now - touched(i) <= DAY),
    unassigned: open.filter(i => !personKey(i)),
  };
}

export function agendaText(scopeName: string, a: Agenda, notes: string): string {
  const line = (i: Issue) => `  - ${i.key} ${i.title}${personKey(i) ? ` (${personKey(i)})` : ''}`;
  const block = (title: string, list: string[]) => (list.length ? `${title}\n${list.join('\n')}\n` : '');
  return [
    `Call notes — ${scopeName} — ${new Date().toLocaleDateString()}\n`,
    block('Needs an update:', a.needsUpdate.map(x => `  - ${x.issue.key} ${x.issue.title} — ${x.reason}`)),
    block('Blocked:', a.blocked.map(b => `  - ${b.issue.key} ${b.issue.title} ← ${b.blockedBy.map(x => x.key).join(', ')}`)),
    block('In progress:', a.inProgress.map(line)),
    block('Done in the last 24h:', a.doneRecently.map(line)),
    block('Up next (To do):', a.upNext.slice(0, 8).map(line)),
    block('Backlog (top):', a.backlog.slice(0, 5).map(line)),
    notes.trim() ? `Notes:\n${notes.trim()}\n` : '',
  ].filter(Boolean).join('\n');
}

// ─── Invites ─────────────────────────────────────────────────────────────────

export function startEnd(s: Pick<Standup, 'startDate' | 'time' | 'duration'>) {
  const [y, m, d] = s.startDate.split('-').map(Number);
  const [hh, mm] = s.time.split(':').map(Number);
  const start = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
  return { start, end: new Date(start.getTime() + s.duration * 60_000) };
}

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export function rrule(repeat: Repeat, start: Date): string | undefined {
  if (repeat === 'weekdays') return 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
  if (repeat === 'daily') return 'RRULE:FREQ=DAILY';
  if (repeat === 'weekly') return `RRULE:FREQ=WEEKLY;BYDAY=${WEEKDAY_CODES[start.getDay()]}`;
  return undefined;
}

export function inviteDescription(scopeName: string, a: Agenda, platform: Platform, link: string, callName = 'Daily standup'): string {
  const top = a.needsUpdate.slice(0, 6).map(x => `• ${x.issue.key} ${x.issue.title} — ${x.reason}`);
  return [
    `${callName} for ${scopeName} (scheduled from Lira).`,
    link ? `Join: ${link}` : platform === 'meet' ? 'A Google Meet link is added by Google Calendar.' : '',
    '',
    'Please update your tickets before the call. Each person: what I finished, what I am doing next, what blocks me.',
    top.length ? `\nTickets needing an update:\n${top.join('\n')}` : '',
    `\nIn progress: ${a.inProgress.length} · Blocked: ${a.blocked.length} · Overdue: ${a.overdue.length}`,
  ].filter(l => l !== undefined).join('\n');
}

export function googleCalendarUrl(s: Standup, emails: string[], description: string): string {
  const { start, end } = startEnd(s);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: s.title,
    dates: `${utc(start)}/${utc(end)}`,
    details: description,
    add: emails.join(','),
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const r = rrule(s.repeat, start);
  if (r) params.set('recur', r);
  if (s.link) params.set('location', s.link);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const localIso = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
};

export function teamsUrl(s: Standup, emails: string[], description: string): string {
  const { start, end } = startEnd(s);
  const params = new URLSearchParams({
    subject: s.title,
    startTime: localIso(start),
    endTime: localIso(end),
    content: description,
  });
  if (emails.length) params.set('attendees', emails.join(','));
  return `https://teams.microsoft.com/l/meeting/new?${params.toString()}`;
}

const icsEscape = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export function icsFile(s: Standup, members: TeamMember[], description: string): string {
  const { start, end } = startEnd(s);
  const r = rrule(s.repeat, start);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lira//Standup//EN', 'CALSCALE:GREGORIAN', 'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${s.id}@lira.local`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(start)}`,
    `DTEND:${utc(end)}`,
    `SUMMARY:${icsEscape(s.title)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    ...(s.link ? [`LOCATION:${icsEscape(s.link)}`, `URL:${s.link}`] : []),
    ...(r ? [r] : []),
    ...members.filter(m => m.email).map(m => `ATTENDEE;CN=${icsEscape(m.name)};ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${m.email}`),
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

export function mailtoUrl(s: Standup, emails: string[], body: string): string {
  return `mailto:${emails.join(',')}?subject=${encodeURIComponent(s.title)}&body=${encodeURIComponent(body)}`;
}

export function downloadText(filename: string, text: string, mime = 'text/calendar') {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Same feature, named for where it is used: spaces keep "Standup", projects and sprints get their own names. */
export const CALL_SHORT: Record<ScopeType, string> = { space: 'Standup', project: 'Project sync', sprint: 'Sprint call' };
export const CALL_TITLE: Record<ScopeType, string> = { space: 'Standup call', project: 'Project sync call', sprint: 'Sprint call' };
export const CALL_EVENT: Record<ScopeType, string> = { space: 'Daily standup', project: 'Project sync', sprint: 'Sprint call' };

export const REPEAT_LABEL: Record<Repeat, string> = { none: 'One time', weekdays: 'Every weekday', daily: 'Every day', weekly: 'Every week' };
export const PLATFORM_LABEL: Record<Platform, string> = { meet: 'Google Meet', teams: 'Microsoft Teams', other: 'Other link' };
