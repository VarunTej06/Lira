import { describe, expect, it } from 'vitest';
import { makeIssue, makeSpace } from '../../test/factories';
import { widgetFromEntry } from './catalog';
import { widgetData, widgetScope } from './data';
import type { DataCtx } from './metrics';
import { DEFAULT_FILTERS } from './types';

const NOW = new Date(2026, 10, 9, 12);
const ctx = (issues: ReturnType<typeof makeIssue>[]): DataCtx => ({ issues, spaces: [makeSpace()], projects: [], roadmaps: [], now: NOW, me: ['vy'] });
const board = { filters: { ...DEFAULT_FILTERS } };

describe('what a widget looks at', () => {
  it('is the dashboard filters with the widget own filters on top', () => {
    const list = [makeIssue({ id: 1, priority: 'high' }), makeIssue({ id: 2, priority: 'low' })];
    const w = widgetFromEntry('stat-open', { filters: { priorities: ['high'] } })!;
    expect(widgetScope(board, w, ctx(list)).map(i => i.id)).toEqual([1]);
    expect(widgetScope({ filters: { ...DEFAULT_FILTERS, priorities: ['low'] } }, widgetFromEntry('stat-open')!, ctx(list)).map(i => i.id)).toEqual([2]);
  });
});

describe('what a widget shows', () => {
  it('gives a number for a stat card', () => {
    const d = widgetData(board, widgetFromEntry('stat-open')!, ctx([makeIssue({ status: 'todo' }), makeIssue({ status: 'done' })]));
    expect(d).toMatchObject({ kind: 'stat', result: { value: 1 } });
  });
  it('gives the right kind of data for a widget, even with no tickets', () => {
    const pairs: [string, string][] = [['stat-open', 'stat'], ['bar-status', 'groups'], ['workload', 'workload'], ['summary', 'summary'], ['due-calendar', 'due'], ['blocked', 'blocked'], ['roadmap', 'roadmap']];
    pairs.forEach(([entry, kind]) => expect(widgetData(board, widgetFromEntry(entry)!, ctx([])).kind, entry).toBe(kind));
  });
});
