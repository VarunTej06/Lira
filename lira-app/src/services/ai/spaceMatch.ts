import type { Space } from '../../types/space';

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const STOP_WORDS = new Set([
  'app', 'space', 'project', 'projects', 'hub', 'board', 'team',
  'the', 'and', 'for', 'with', 'task', 'tasks', 'ticket', 'tickets',
  'issue', 'issues', 'item', 'items', 'all', 'show', 'list', 'what', 'give',
]);

/** Short names people use for the built-in spaces: space key -> phrases that mean it. */
const ALIASES = new Map<string, string[]>([
  ['ap', ['atmos', 'weather']],
  ['ig', ['interview', 'guide']],
  ['ai', ['ai project', 'ai-project', 'machine learning', 'ai space']],
  ['cert', ['certification', 'certs', 'cert ']],
  ['crs', ['course', 'courses', 'class']],
  ['cre', ['creator', 'hub']],
  ['gen', ['general', 'general tasks']],
  ['lira', ['lira']],
]);

/** True when `needle` appears as a whole word: letters or digits right next to it do not count. */
const hasWord = (text: string, needle: string) => new RegExp(`(^|[^a-z0-9])${escapeRegex(needle)}([^a-z0-9]|$)`, 'i').test(text);

/** "in AP", "AP tasks", "tickets for FIN" */
const byKey = (t: string, spaces: Space[]) => spaces.find(s => hasWord(t, s.key.toLowerCase()));

/** "Atmos - Weather App", "Interview Guide", "Cloud Infrastructure" */
const byFullName = (t: string, spaces: Space[]) => spaces.find(s => t.includes(s.name.toLowerCase()));

/** Any significant word of a multi-word space name, for spaces present now or added later. */
const byNameWord = (t: string, spaces: Space[]) => spaces.find(s =>
  s.name.toLowerCase().split(/[\s\-_/]+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w)).some(w => hasWord(t, w)));

const byAlias = (t: string, spaces: Space[]) => spaces.find(s => ALIASES.get(s.key.toLowerCase())?.some(phrase => t.includes(phrase)));

/**
 * Resolves a space from user text dynamically (by key, full name, significant name words, or common aliases), in that order.
 * Works automatically for all existing and any future spaces created in Lira.
 */
export function findTargetSpace(text: string, allSpaces: Space[]): Space | undefined {
  const t = text.toLowerCase();
  return byKey(t, allSpaces) ?? byFullName(t, allSpaces) ?? byNameWord(t, allSpaces) ?? byAlias(t, allSpaces);
}
