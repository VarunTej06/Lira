/** The text on a filter button: the "all" text with nothing chosen, otherwise what `many` says about the chosen values. */
const summary = (count: number, all: string, many: (n: number) => string): string => (count === 0 ? all : many(count));

/** One space shows its name (or "1 Space" when it is unknown), several show a count. */
export const spaceSummary = (ids: number[], names: Record<number, { name: string } | undefined>): string =>
  summary(ids.length, 'Space: All', n => (n === 1 ? names[ids[0]]?.name || '1 Space' : `${n} Spaces`));

/** One status shows its id in capitals, several show a count. */
export const statusSummary = (ids: string[]): string => summary(ids.length, 'Status: All', n => (n === 1 ? ids[0].toUpperCase() : `${n} Statuses`));

export const prioritySummary = (ids: string[]): string => summary(ids.length, 'Priority: All', n => `${n} Selected`);
export const typeSummary = (ids: string[]): string => summary(ids.length, 'Type: All', n => `${n} Types`);
export const assigneeSummary = (ids: string[]): string => summary(ids.length, 'Assignee: All', n => `${n} Assignees`);

/** Labels chosen plus one when a team is chosen. */
export const tagCount = (labels: string[], team: string): number => labels.length + (team !== 'all' ? 1 : 0);
export const tagSummary = (count: number): string => summary(count, 'Tags & Team', n => `${n} Active`);
