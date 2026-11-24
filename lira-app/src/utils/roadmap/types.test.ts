import { describe, expect, it } from 'vitest';
import { laneColor, STATUS_META, type Roadmap } from './types';

const rm = (lanes: string[]): Roadmap => ({ id: 'r', name: 'R', lanes, items: [], milestones: [], createdAt: 'now' });

describe('the look of a roadmap', () => {
  it('has a name and a colour for each of the five statuses', () => {
    expect(Object.keys(STATUS_META)).toEqual(['planned', 'inprogress', 'done', 'atrisk', 'blocked']);
    for (const s of Object.values(STATUS_META)) { expect(s.label).toBeTruthy(); expect(s.color).toMatch(/^#[0-9A-Fa-f]{6}$/); }
    expect(STATUS_META.inprogress.label).toBe('In progress');
  });
  it('gives each lane its own colour in turn, goes round when there are more lanes than colours, and a lane that is not listed the first colour', () => {
    const lanes = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const colours = lanes.map(l => laneColor(rm(lanes), l));
    expect(new Set(colours.slice(0, 7)).size).toBe(7);
    expect(colours[7]).toBe(colours[0]);
    expect(laneColor(rm(lanes), 'zzz')).toBe(colours[0]);
  });
});
