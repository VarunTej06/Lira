import type { Issue, Priority } from '../../types/issue';

/** Suggestions while a ticket is being written: labels, priority, the likely epic, and possible duplicates. All local, no model needed. */

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'this', 'that', 'add', 'create', 'update', 'fix', 'new', 'make', 'set', 'get', 'use', 'when', 'not', 'are', 'can', 'all', 'our', 'your', 'need', 'needs', 'task', 'bug']);

function tokens(text: string): string[] {
  return Array.from(new Set(
    (text.toLowerCase().match(/[a-z0-9][a-z0-9+#.\-/]*/g) || []).filter(w => w.length >= 3 && !STOP.has(w)),
  ));
}

/** Share of words two titles have in common (0 to 1). */
function similarity(a: string, b: string): number {
  const x = tokens(a), y = tokens(b);
  if (!x.length || !y.length) return 0;
  const sy = new Set(y);
  const shared = x.filter(w => sy.has(w)).length;
  return shared / (x.length + y.length - shared);
}

interface TicketSuggestions {
  labels: string[];
  priority?: Priority;
  /** why the priority was suggested */
  priorityReason?: string;
  epic?: Issue;
  duplicates: { issue: Issue; score: number }[];
}

const HIGH = /\b(urgent|asap|blocker|blocking|outage|crash(es|ing)?|production|prod|security|data loss|broken|cannot|can't|fails?)\b/i;
const LOW = /\b(typo|cosmetic|minor|nice to have|polish|rename|wording|someday)\b/i;

/**
 * Looks at the title and description and at the tickets of the same space:
 * - labels that similar tickets already use, plus labels for well-known topics
 * - a priority from urgency words
 * - the epic whose tickets read most like this one
 * - existing open tickets that look like the same thing
 */
export function suggestForTicket(
  title: string,
  description: string,
  type: string,
  existing: Issue[],
  spaceId?: number,
): TicketSuggestions {
  const text = `${title} ${description}`;
  const pool = existing.filter(i => (spaceId === undefined || i.spaceId === spaceId));
  const related = pool
    .filter(i => i.type !== 'epic')
    .map(issue => ({ issue, score: similarity(title, issue.title) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const duplicates = related.filter(x => x.score >= 0.5 && x.issue.status?.toLowerCase() !== 'done').slice(0, 3);

  const counts = new Map<string, number>();
  related.slice(0, 8).forEach(({ issue, score }) => {
    if (score < 0.2) return;
    for (const l of issue.labels || []) if (l !== 'ai-created') counts.set(l, (counts.get(l) || 0) + score);
  });
  const topics: [RegExp, string][] = [
    [/\b(docker|container)/i, 'docker'], [/\b(kubernetes|k8s|helm|aks)/i, 'kubernetes'], [/\b(ci\/cd|pipeline|github action|azure devops)/i, 'ci-cd'],
    [/\b(test|pytest|vitest|coverage)/i, 'testing'], [/\b(doc|readme|guide)/i, 'docs'], [/\b(ui|css|layout|dark mode|theme)/i, 'ui'],
    [/\b(api|endpoint|rest|graphql)/i, 'api'], [/\b(database|sql|migration|schema)/i, 'database'], [/\b(security|auth|token|password)/i, 'security'],
  ];
  topics.forEach(([re, label]) => { if (re.test(text)) counts.set(label, (counts.get(label) || 0) + 1); });
  if (type === 'bug') counts.set('bug', (counts.get('bug') || 0) + 1);
  const labels = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([l]) => l);

  let priority: Priority | undefined, priorityReason: string | undefined;
  const hit = text.match(HIGH);
  if (hit) { priority = type === 'bug' ? 'highest' : 'high'; priorityReason = `mentions "${hit[0]}"`; }
  else if (LOW.test(text)) { priority = 'low'; priorityReason = `mentions "${text.match(LOW)![0]}"`; }

  let epic: Issue | undefined, best = 0.15;
  for (const e of pool.filter(i => i.type === 'epic')) {
    const kids = pool.filter(i => i.type !== 'epic' && (i.parentId === e.id || i.epicId === e.id));
    const score = Math.max(similarity(title, e.title), ...kids.map(k => similarity(title, k.title)) , 0);
    if (score > best) { best = score; epic = e; }
  }

  return { labels, priority, priorityReason, epic, duplicates };
}
