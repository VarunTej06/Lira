import { describe, expect, it } from 'vitest';
import { makeIssue } from '../test/factories';
import { newBox, type StoryBox } from './storybox';
import { boxRows, chartRows, headline, localSummary } from './storyOverview';

const box = (id: string, over: Partial<StoryBox> = {}): StoryBox => ({ ...newBox(id, id, { type: 'space', spaceId: 1 }, `2026-11-0${id}T00:00:00Z`, 'A', 5), ...over });
const issues = [makeIssue({ id: 1, spaceId: 1 }), makeIssue({ id: 2, spaceId: 1 }), makeIssue({ id: 3, spaceId: 1, type: 'epic' }), makeIssue({ id: 4, spaceId: 2 })];

describe('what a local box has sized', () => {
  it('counts the confirmed rounds and their points, and ignores rounds still being voted on', () => {
    const b = box('1', { localRounds: { 1: { endsAt: 'x', revealed: true, finalPoints: 5 }, 2: { endsAt: 'x', revealed: true, finalPoints: 3 }, 3: { endsAt: 'x', revealed: false } } });
    expect(localSummary(b)).toEqual({ sized: 2, points: 8 });
    expect(localSummary(box('2'))).toEqual({ sized: 0, points: 0 });
  });
});

describe('a line for each box', () => {
  it('counts the tickets in its scope without epics, takes what it sized from the summaries, and gives the percent', () => {
    const rows = boxRows([box('1'), box('2')], issues, new Map([['1', { sized: 1, points: 5 }]]));
    expect(rows[0]).toMatchObject({ total: 2, sized: 1, points: 5, percent: 50 });
    expect(rows[1]).toMatchObject({ sized: 0, points: 0, percent: 0 });
  });
  it('never goes above 100 percent when more were sized than there are tickets now, and is 0 with no tickets', () => {
    expect(boxRows([box('1')], issues, new Map([['1', { sized: 9, points: 40 }]]))[0].percent).toBe(100);
    expect(boxRows([box('1', { scope: { type: 'space', spaceId: 9 } })], issues, new Map())[0]).toMatchObject({ total: 0, percent: 0 });
  });
});

describe('the headline numbers', () => {
  it('counts open and closed boxes and adds up what was sized and the points', () => {
    const rows = boxRows([box('1'), box('2', { status: 'closed' }), box('3', { status: 'closed' })], issues, new Map([['1', { sized: 1, points: 5 }], ['2', { sized: 2, points: 8 }]]));
    expect(headline(rows)).toEqual({ open: 1, closed: 2, sized: 3, points: 13 });
    expect(headline([])).toEqual({ open: 0, closed: 0, sized: 0, points: 0 });
  });
});

describe('the chart of points per box', () => {
  it('keeps only boxes that sized something, oldest first, and the last six', () => {
    const boxes = Array.from({ length: 8 }, (_, i) => box(String(i + 1)));
    const sums = new Map(boxes.map((b, i) => [b.id, { sized: 1, points: i === 0 ? 0 : i }]));
    const rows = chartRows(boxRows(boxes, issues, sums));
    expect(rows.map(r => r.box.id)).toEqual(['3', '4', '5', '6', '7', '8']);
  });
});
