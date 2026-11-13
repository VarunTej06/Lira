import { describe, expect, it } from 'vitest';
import { stackMilestones } from './milestoneLabels';

const m = (title: string, x: number) => ({ title, x });

describe('stackMilestones', () => {
  it('keeps labels that are far apart on one row', () => {
    const { labels, tiers } = stackMilestones([m('Alpha', 0), m('Beta', 500), m('Gamma', 1000)]);
    expect(labels.map(l => l.tier)).toEqual([0, 0, 0]);
    expect(tiers).toBe(1);
  });

  it('moves a label that would overlap down to the next row', () => {
    const { labels, tiers } = stackMilestones([m('Alpha', 0), m('Beta', 20), m('Gamma', 500)]);
    expect(labels.map(l => l.tier)).toEqual([0, 1, 0]);
    expect(tiers).toBe(2);
  });

  it('adds as many rows as it takes: five labels on the same day never share a row', () => {
    const { labels, tiers } = stackMilestones(Array.from({ length: 5 }, (_, i) => m('Milestone ' + i, 100)));
    expect(labels.map(l => l.tier)).toEqual([0, 1, 2, 3, 4]);
    expect(tiers).toBe(5);
  });

  it('a longer title reserves more room', () => {
    expect(stackMilestones([m('A', 0), m('B', 90)]).labels[1].tier).toBe(0);
    expect(stackMilestones([m('A much longer milestone title', 0), m('B', 90)]).labels[1].tier).toBe(1);
  });

  it('keeps everything else about a label, and copes with none', () => {
    expect(stackMilestones([{ id: 'x', title: 'A', x: 5 }]).labels[0]).toEqual({ id: 'x', title: 'A', x: 5, tier: 0 });
    expect(stackMilestones([])).toEqual({ labels: [], tiers: 0 });
  });
});
