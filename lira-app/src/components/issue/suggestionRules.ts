import type { Priority } from '../../types/issue';

interface Suggestion {
  labels: string[];
  priority?: Priority;
  epic?: { id?: number } | null;
  duplicates: unknown[];
}

/** The labels already typed, lower-cased, as a set. */
export const typedLabels = (labels: string): Set<string> => new Set(labels.split(',').map(l => l.trim().toLowerCase()).filter(Boolean));

/**
 * What is worth showing: label chips not already typed, the suggested priority only when it differs from the current one,
 * the suggested epic only for tasks and bugs that are not already under it, and whether there is anything at all.
 */
export function visibleHints(s: Suggestion, current: { labels: string; priority: Priority; type: string; parentId?: number }) {
  const have = typedLabels(current.labels);
  const labelChips = s.labels.filter(l => !have.has(l.toLowerCase()));
  const showPriority = !!s.priority && s.priority !== current.priority;
  const showEpic = current.type !== 'epic' && current.type !== 'subtask' && !!s.epic && s.epic.id !== current.parentId;
  return { labelChips, showPriority, showEpic, any: s.duplicates.length > 0 || labelChips.length > 0 || showPriority || showEpic };
}
