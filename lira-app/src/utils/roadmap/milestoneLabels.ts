/** Roughly how wide a milestone label is drawn: its icon, title and short date. */
const labelWidth = (title: string) => title.length * 6 + 70;
const GAP = 8;

/**
 * Puts milestone labels in rows ("tiers") so that none overlaps another: each label takes the first row where it starts
 * after the previous label of that row has ended, and a new row is added when there is none. Give the labels in date order.
 */
export function stackMilestones<T extends { title: string; x: number }>(labels: T[]): { labels: (T & { tier: number })[]; tiers: number } {
  const rowEnd: number[] = []; // right edge of the last label placed on each row
  const placed = labels.map(label => {
    let tier = rowEnd.findIndex(end => label.x > end + GAP);
    if (tier < 0) tier = rowEnd.length;
    rowEnd[tier] = label.x + labelWidth(label.title);
    return { ...label, tier };
  });
  return { labels: placed, tiers: rowEnd.length };
}
