import type { Issue } from '../types/issue';
import type { Space } from '../types/space';
import { spacePath } from '../routes';

export type CommandGroup = 'Go to' | 'Spaces' | 'Tickets' | 'Actions';
export const GROUP_ORDER: readonly CommandGroup[] = ['Go to', 'Spaces', 'Tickets', 'Actions'];

export interface Command { id: string; group: CommandGroup; label: string; detail?: string; keywords?: string; run: () => void }

/** How well one word matches some text: 0 for no match, more for a text that starts with it, then a word that starts with it, then a text that contains it, then (for the visible label only) letters in order. */
function wordScore(text: string, word: string, fuzzy = false): number {
  const t = text.toLowerCase();
  if (t.startsWith(word)) return 100;
  if (t.split(/[\s\-_/:.]+/).some(w => w.startsWith(word))) return 80;
  if (t.includes(word)) return 60;
  if (!fuzzy || word.length < 3) return 0; // letters in order are a guess, so only the label that is on the screen is guessed at
  let at = 0;
  for (const ch of word) { at = t.indexOf(ch, at) + 1; if (at === 0) return 0; }
  return 20;
}

/** The score of a command for a search: every word must match somewhere (label, detail or keywords), and the label counts most. 0 means no match. */
export function scoreOf(command: Pick<Command, 'label' | 'detail' | 'keywords'> & { group?: CommandGroup }, query: string): number {
  const fuzzy = command.group !== 'Tickets'; // a long ticket title would match almost any word by chance
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  let total = 0;
  for (const w of words) {
    const best = Math.max(wordScore(command.label, w, fuzzy) * 2, wordScore(command.detail ?? '', w), wordScore(command.keywords ?? '', w));
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

/** The commands that match, best first within each group, groups in a fixed order. With no search the first `perGroup` of each are listed. */
export function rank(commands: readonly Command[], query: string, perGroup = 8): Command[] {
  const searching = query.trim() !== '';
  const scored = commands.map((c, i) => ({ c, i, s: scoreOf(c, query) })).filter(x => x.s > 0);
  const out: Command[] = [];
  for (const group of GROUP_ORDER) {
    const list = scored.filter(x => x.c.group === group).sort((a, b) => (searching ? b.s - a.s : 0) || a.i - b.i);
    out.push(...list.slice(0, perGroup).map(x => x.c));
  }
  return out;
}

/** The pages. The hosted edition also has Calls and Teams and access. */
export function pageCommands(go: (path: string) => void, hosted: boolean): Command[] {
  const pages: [string, string, string][] = [
    ['For you', '/for-you', 'home start overview'], ['Projects', '/projects', ''], ['Sprints', '/sprints', 'iteration'], ['All tickets', '/tickets', 'work items issues'],
    ['Roadmaps', '/roadmaps', 'plan timeline'], ['Dashboards', '/dashboards', 'charts reports'], ['Mind maps', '/mindmaps', 'storyboard brainstorm'], ['Story boxes', '/storyboxes', 'estimate points planning poker'],
    ['Filters', '/filters', 'search find'],
    ...(hosted ? [['Calls', '/calls', 'stand-up meeting'], ['Teams and access', '/teams', 'people invite import permissions']] as [string, string, string][] : []),
  ];
  return pages.map(([label, path, keywords]) => ({ id: `page:${path}`, group: 'Go to' as const, label, keywords, run: () => go(path) }));
}

export const spaceCommands = (spaces: readonly Space[], go: (path: string) => void): Command[] =>
  spaces.map(s => ({ id: `space:${s.id}`, group: 'Spaces' as const, label: s.name, detail: s.key, keywords: 'board space', run: () => go(spacePath(s.key)) }));

/** Tickets are listed only for a search, by key or title (the key counts as the label so an exact key is found first). */
export function ticketCommands(issues: readonly Issue[], query: string, open: (issue: Issue) => void): Command[] {
  if (query.trim() === '') return [];
  return issues.map(i => ({ id: `ticket:${i.id}`, group: 'Tickets' as const, label: `${i.key} ${i.title}`, detail: i.status, run: () => open(i) }));
}

export const actionCommands = (actions: { createTicket: () => void; createSpace: () => void }): Command[] => [
  { id: 'action:create-ticket', group: 'Actions', label: 'Create a ticket', keywords: 'new add issue task bug', run: actions.createTicket },
  { id: 'action:create-space', group: 'Actions', label: 'Create a space', keywords: 'new add board', run: actions.createSpace },
];
