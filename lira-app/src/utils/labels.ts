const key = (label: string) => label.trim().toLowerCase();
const has = (labels: readonly string[], label: string) => labels.some(l => key(l) === key(label));

/** The labels with what was typed added: split at commas, trimmed, and never the same label twice (whatever its capitals). */
export function addLabels(labels: readonly string[] | undefined, typed: string): string[] {
  const out = [...(labels ?? [])];
  for (const part of typed.split(',')) {
    const label = part.trim();
    if (label && !has(out, label)) out.push(label);
  }
  return out;
}

/** The text of a comma-separated label box after Enter: the label being typed is finished and the next can be typed. */
export const endLabel = (typed: string): string => (typed.trim() && !typed.trim().endsWith(',') ? `${typed.trim()}, ` : typed);

type Labelled = { labels?: string[]; inheritedLabels?: string[] };

/**
 * A ticket's labels once it sits under a parent with these labels. `labels` holds everything shown on the ticket;
 * `inheritedLabels` says which of them came from above, so that removing a label from the parent later removes it here too,
 * while a label typed on the ticket itself is kept. With no parent, pass an empty list: only the ticket's own labels remain.
 */
export function inheritLabels(child: Labelled, parentLabels: readonly string[]): { labels: string[]; inheritedLabels: string[] } {
  const was = child.inheritedLabels ?? [];
  const own = (child.labels ?? []).filter(l => !has(was, l));
  const inherited = parentLabels.filter((l, i) => l.trim() && !has(own, l) && !has(parentLabels.slice(0, i), l));
  return { labels: [...own, ...inherited], inheritedLabels: inherited };
}

/** Whether inheriting changed anything worth saving. */
export const sameLabels = (a: Labelled, b: { labels: string[]; inheritedLabels: string[] }): boolean =>
  JSON.stringify(a.labels ?? []) === JSON.stringify(b.labels) && JSON.stringify(a.inheritedLabels ?? []) === JSON.stringify(b.inheritedLabels);
