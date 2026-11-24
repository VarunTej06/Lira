import { describe, expect, it } from 'vitest';
import { addChild, newMap, updateNode, type MindMap } from './mindmap';
import { copyOf, mindStats, visibleMaps } from './mindOverview';

const NOW = Date.parse('2026-11-24T12:00:00Z');
const make = (id: string, name: string, updatedAt: string, extra: Partial<MindMap> = {}): MindMap => ({ ...newMap(id, name, updatedAt, `${id}-root`), updatedAt, ...extra });
const withIdeas = (m: MindMap, ...texts: string[]): MindMap => ({ ...m, nodes: texts.reduce((nodes, t, i) => addChild(nodes, `${m.id}-root`, `${m.id}-${i}`, t), m.nodes) });

describe('the numbers of the mind maps', () => {
  it('counts maps, ideas, ideas linked to a ticket, and maps changed in the last week', () => {
    const a = { ...withIdeas(make('a', 'A', '2026-11-23T00:00:00Z'), 'one', 'two') };
    a.nodes = updateNode(a.nodes, 'a-0', { ticketKey: 'LIRA-1' });
    const b = withIdeas(make('b', 'B', '2026-11-01T00:00:00Z'), 'three');
    expect(mindStats([a, b], NOW)).toEqual({ maps: 2, ideas: 5, tickets: 1, recent: 1 });
    expect(mindStats([], NOW)).toEqual({ maps: 0, ideas: 0, tickets: 0, recent: 0 });
  });
});

describe('which maps are shown', () => {
  const a = make('a', 'Roadmap ideas', '2026-11-20T00:00:00Z', { starred: true });
  const b = withIdeas(make('b', 'Meeting', '2026-11-22T00:00:00Z'), 'Budget review', 'Hiring', 'Launch');
  const c = make('c', 'Brainstorm', '2026-11-21T00:00:00Z');
  const all = [a, b, c];

  it('shows every map, or only the starred ones', () => {
    expect(visibleMaps(all, 'all', '', 'name').map(m => m.id)).toEqual(['c', 'b', 'a']);
    expect(visibleMaps(all, 'starred', '', 'name').map(m => m.id)).toEqual(['a']);
  });
  it('finds a map by any word in its name or in any of its ideas, in any case', () => {
    expect(visibleMaps(all, 'all', 'BUDGET', 'name').map(m => m.id)).toEqual(['b']);
    expect(visibleMaps(all, 'all', 'meeting hiring', 'name').map(m => m.id)).toEqual(['b']);
    expect(visibleMaps(all, 'all', 'nothing like this', 'name')).toEqual([]);
  });
  it('orders by the latest change, by name, or by the number of ideas, and does not change the list it was given', () => {
    expect(visibleMaps(all, 'all', '', 'updated').map(m => m.id)).toEqual(['b', 'c', 'a']);
    expect(visibleMaps(all, 'all', '', 'ideas').map(m => m.id)[0]).toBe('b');
    expect(all.map(m => m.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('a copy of a map', () => {
  it('has new ids throughout with the same shape, a new name, no star, and leaves the first alone', () => {
    let n = 0;
    const first = withIdeas(make('a', 'Plan', '2026-11-01T00:00:00Z', { starred: true }), 'x', 'y');
    const copy = copyOf(first, () => `n${++n}`, '2026-11-24T00:00:00Z');
    expect(copy.name).toBe('Plan (copy)');
    expect(copy.starred).toBe(false);
    expect(copy.createdAt).toBe('2026-11-24T00:00:00Z');
    expect(copy.nodes).toHaveLength(3);
    const ids = new Set(copy.nodes.map(x => x.id));
    expect(ids.size).toBe(3);
    expect(copy.nodes.filter(x => x.parentId === null)).toHaveLength(1);
    expect(copy.nodes.every(x => x.parentId === null || ids.has(x.parentId))).toBe(true);
    expect(copy.nodes.some(x => first.nodes.some(o => o.id === x.id))).toBe(false);
    expect(first.name).toBe('Plan');
  });
  it('cuts a long name to the limit', () => {
    expect(copyOf(make('a', 'x'.repeat(100), 'now'), () => 'z', 'now').name).toHaveLength(100);
  });
});
