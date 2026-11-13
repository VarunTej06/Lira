import type { Issue } from '../../types/issue';
import { matchesStatusFilter, type SpaceFilters } from '../../utils/spaceFilters';
import { isMine } from '../../utils/currentUser';
import { PALETTE } from '../../theme/palette';
import { appStorage } from '../../utils/appStorage';

export type GroupBy = 'status' | 'assignee' | 'priority' | 'epic';
interface BoardColumnDef { id: string; title: string; accentColor: string }

const STATUS_COLUMNS: BoardColumnDef[] = [
  { id: 'backlog', title: 'Backlog', accentColor: PALETTE.textMuted },
  { id: 'todo', title: 'To Do', accentColor: PALETTE.textStrong },
  { id: 'inprogress', title: 'In Progress', accentColor: PALETTE.brand },
  { id: 'done', title: 'Done', accentColor: '#006644' },
];

const PRIORITY_COLUMNS: BoardColumnDef[] = [
  { id: 'highest', title: 'Highest', accentColor: '#FF0000' },
  { id: 'high', title: 'High', accentColor: PALETTE.danger },
  { id: 'medium', title: 'Medium', accentColor: PALETTE.orangeDeep },
  { id: 'low', title: 'Low', accentColor: PALETTE.success },
  { id: 'lowest', title: 'Lowest', accentColor: PALETTE.info },
];

const ASSIGNEE_COLORS = [PALETTE.brand, PALETTE.purple, PALETTE.info, PALETTE.success, PALETTE.orangeDeep, PALETTE.danger, '#8777D9'];
const GREY = PALETTE.textMuted;

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
    ...issues.filter(i => i.type === 'epic').map(e => ({ id: `epic-${e.id}`, title: `${e.key}: ${e.title}`, accentColor: PALETTE.purple })),
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

/** True when there is no search text, or it appears in the title, the key or a label. */
const matchesSearch = (i: Issue, q: string) => !q || i.title.toLowerCase().includes(q) || i.key.toLowerCase().includes(q) || i.labels.some(l => l.toLowerCase().includes(q));
const hasPriority = (i: Issue, f?: SpaceFilters) => !f?.priorities?.length || f.priorities.includes(i.priority);
const hasLabel = (i: Issue, f?: SpaceFilters) => !f?.labels?.length || i.labels.some(l => f.labels.includes(l));

/** The search box, the "only mine" switch and the priority, status and label filters. */
export function filterBoardIssues(issues: Issue[], searchQuery: string, onlyMine: boolean, filters?: SpaceFilters): Issue[] {
  const q = searchQuery.trim().toLowerCase();
  return issues.filter(i =>
    matchesSearch(i, q) && (!onlyMine || isMine(i)) && hasPriority(i, filters) && matchesStatusFilter(i, filters?.statuses) && hasLabel(i, filters),
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
  const rankAt = (k: number, fallback: number) => siblings[k]?.rank ?? fallback;
  if (siblings.length === 0) return 1000;
  if (index <= 0) return rankAt(0, 1000) - 100;
  if (index >= siblings.length) return rankAt(siblings.length - 1, 1000) + 100;
  const before = rankAt(index - 1, 1000);
  const after = rankAt(index, before + 200);
  const middle = Math.floor((before + after) / 2);
  return middle === before || middle === after ? before + 0.5 : middle;
}

/** The WIP limits saved in settings (also reads the older "true" + config format). */
export function loadWipLimits(): Record<string, number> {
  try {
    const raw = appStorage.get('lira_wip_limits');
    if (!raw) return {};
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
    if (raw === 'true') {
      const cfg = appStorage.get('lira_wip_config');
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
