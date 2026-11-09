import type { Space } from '../../types/space';

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolves a space from user text dynamically (by name, key, significant words, or common aliases).
 * Works automatically for all existing and any future spaces created in Lira.
 */
export function findTargetSpace(text: string, allSpaces: Space[]): Space | undefined {
  const t = text.toLowerCase();

  // 1. Exact match on space key with word boundaries (e.g. "in AP", "AP tasks", "tickets for FIN")
  for (const s of allSpaces) {
    const keyLower = s.key.toLowerCase();
    const keyRegex = new RegExp(`(^|[^a-z0-9])${escapeRegex(keyLower)}([^a-z0-9]|$)`, 'i');
    if (keyRegex.test(t)) {
      return s;
    }
  }

  // 2. Exact match on full space name (e.g. "Atmos - Weather App", "Interview Guide", "Cloud Infrastructure")
  for (const s of allSpaces) {
    const nameLower = s.name.toLowerCase();
    if (t.includes(nameLower)) {
      return s;
    }
  }

  // 3. Significant word token matching for any multi-word space name (present or future):
  const stopWords = new Set([
    'app', 'space', 'project', 'projects', 'hub', 'board', 'team',
    'the', 'and', 'for', 'with', 'task', 'tasks', 'ticket', 'tickets',
    'issue', 'issues', 'item', 'items', 'all', 'show', 'list', 'what', 'give'
  ]);
  for (const s of allSpaces) {
    const words = s.name.toLowerCase().split(/[\s\-_/]+/).filter(w => w.length >= 3 && !stopWords.has(w));
    for (const w of words) {
      const wordRegex = new RegExp(`(^|[^a-z0-9])${escapeRegex(w)}([^a-z0-9]|$)`, 'i');
      if (wordRegex.test(t)) {
        return s;
      }
    }
  }

  // 4. Common shorthand aliases for existing spaces
  for (const s of allSpaces) {
    const keyLower = s.key.toLowerCase();
    if (keyLower === 'ap' && (t.includes('atmos') || t.includes('weather'))) return s;
    if (keyLower === 'ig' && (t.includes('interview') || t.includes('guide'))) return s;
    if (keyLower === 'ai' && (t.includes('ai project') || t.includes('ai-project') || t.includes('machine learning') || t.includes('ai space'))) return s;
    if (keyLower === 'cert' && (t.includes('certification') || t.includes('certs') || t.includes('cert '))) return s;
    if (keyLower === 'crs' && (t.includes('course') || t.includes('courses') || t.includes('class'))) return s;
    if (keyLower === 'cre' && (t.includes('creator') || t.includes('hub'))) return s;
    if (keyLower === 'gen' && (t.includes('general') || t.includes('general tasks'))) return s;
    if (keyLower === 'lira' && t.includes('lira')) return s;
  }

  return undefined;
}
