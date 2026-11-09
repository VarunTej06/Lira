import type { Issue } from '../../types/issue';
import { matchesStatusFilter, type SpaceFilters } from '../../utils/spaceFilters';
import { isMine } from '../../utils/currentUser';

export type GroupBy = 'status' | 'assignee' | 'priority' | 'epic';
interface BoardColumnDef { id: string; title: string; accentColor: string }

const STATUS_COLUMNS: BoardColumnDef[] = [
  { id: 'backlog', title: 'Backlog', accentColor: '#6B778C' },
  { id: 'todo', title: 'To Do', accentColor: '#172B4D' },
  { id: 'inprogress', title: 'In Progress', accentColor: '#0052CC' },
  { id: 'done', title: 'Done', accentColor: '#006644' },
];

const PRIORITY_COLUMNS: BoardColumnDef[] = [
  { id: 'highest', title: 'Highest', accentColor: '#FF0000' },
  { id: 'high', title: 'High', accentColor: '#FF5630' },
  { id: 'medium', title: 'Medium', accentColor: '#FF8B00' },
  { id: 'low', title: 'Low', accentColor: '#36B37E' },
  { id: 'lowest', title: 'Lowest', accentColor: '#00B8D9' },
];

const ASSIGNEE_COLORS = ['#0052CC', '#6554C0', '#00B8D9', '#36B37E', '#FF8B00', '#FF5630', '#8777D9'];
const GREY = '#6B778C';

/** The columns for "group by assignee": everyone with a ticket, you, and Unassigned. */
function assigneeColumns(issues: Issue[]): BoardColumnDef[] {
  const names = new Set(issues.map(i => i.assignee?.trim()).filter((n): n is string => !!n));
  names.add('Varun Tej');
  names.add('Unassigned');
  return Array.from(names).map((name, idx) => ({
    id: name, title: name, accentColor: name === 'Unassigned' ? GREY : ASSIGNEE_COLORS[idx % ASSIGNEE_COLORS.length],
  }));
}

/** One column per epic, plus one for tickets without an epic. */
function epicColumns(issues: Issue[]): BoardColumnDef[] {
  return [
    ...issues.filter(i => i.type === 'epic').map(e => ({ id: `epic-${e.id}`, title: `${e.key}: ${e.title}`, accentColor: '#6554C0' })),
    { id: 'no-epic', title: 'No Epic / Standalone', accentColor: GREY },
  ];
}

export function columnsFor(groupBy: GroupBy, issues: Issue[]): BoardColumnDef[] {
  if (groupBy === 'priority') return PRIORITY_COLUMNS;
  if (groupBy === 'assignee') return assigneeColumns(issues);
  if (groupBy === 'epic') return epicColumns(issues);
  return STATUS_COLUMNS;
}

/** The column a ticket sits in for this grouping. */
export function columnIdFor(issue: Issue, groupBy: GroupBy): string {
  if (groupBy === 'priority') return issue.priority || 'medium';
  if (groupBy === 'assignee') return issue.assignee?.trim() || 'Unassigned';
  if (groupBy === 'epic') return issue.epicId ? `epic-${issue.epicId}` : 'no-epic';
  return issue.status || 'todo';
}

/** The search box, the "only mine" switch and the priority, status and label filters. */
export function filterBoardIssues(issues: Issue[], searchQuery: string, onlyMine: boolean, filters?: SpaceFilters): Issue[] {
  const q = searchQuery.trim().toLowerCase();
  return issues.filter(i =>
    (!q || i.title.toLowerCase().includes(q) || i.key.toLowerCase().includes(q) || i.labels.some(l => l.toLowerCase().includes(q))) &&
    (!onlyMine || isMine(i)) &&
    (!filters?.priorities?.length || filters.priorities.includes(i.priority)) &&
    matchesStatusFilter(i, filters?.statuses) &&
    (!filters?.labels?.length || i.labels.some(l => filters.labels.includes(l))),
  );
}

/** Tickets per column, each column in rank order. A ticket in a column nobody defined still gets one. */
export function groupIntoColumns(columns: BoardColumnDef[], issues: Issue[], groupBy: GroupBy, moved: Record<number, string>): Record<string, Issue[]> {
  const byColumn: Record<string, Issue[]> = Object.fromEntries(columns.map(c => [c.id, [] as Issue[]]));
  for (const issue of issues) {
    const id = moved[issue.id!] || columnIdFor(issue, groupBy);
    (byColumn[id] ??= []).push(issue);
  }
  for (const list of Object.values(byColumn)) list.sort((a, b) => a.rank - b.rank);
  return byColumn;
}

/** The rank for a card dropped at `index` among `siblings` (the column without the card itself). */
export function rankForDrop(siblings: Issue[], index: number): number {
  if (siblings.length === 0) return 1000;
  if (index <= 0) return (siblings[0]?.rank ?? 1000) - 100;
  if (index >= siblings.length) return (siblings[siblings.length - 1]?.rank ?? 1000) + 100;
  const before = siblings[index - 1]?.rank ?? 1000;
  const after = siblings[index]?.rank ?? before + 200;
  const middle = Math.floor((before + after) / 2);
  return middle === before || middle === after ? before + 0.5 : middle;
}

/** The WIP limits saved in settings (also reads the older "true" + config format). */
export function loadWipLimits(): Record<string, number> {
  try {
    const raw = localStorage.getItem('lira_wip_limits');
    if (!raw) return {};
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
    if (raw === 'true') {
      const cfg = localStorage.getItem('lira_wip_config');
      if (cfg) return JSON.parse(cfg).limits || {};
    }
    return {};
  } catch {
    return {};
  }
}

/** The limit for a column, looked up by id or by title in any spelling. */
export function wipLimitFor(limits: Record<string, number>, id: string, title: string): number | undefined {
  const lower = title.toLowerCase();
  return [id, id.toLowerCase(), title, lower, lower.replace(/\s+/g, '')].map(k => limits[k]).find(v => typeof v === 'number' && v > 0);
}
