import { describe, expect, it } from 'vitest';
import { addChild, addSibling, childrenOf, fromOutline, layout, MAX_NODES, moveNode, neighbour, newMap, NODE_H, removeNode, rootOf, searchNodes, setAllCollapsed, subtreeIds, toOutline, updateNode, visibleNodes, widthOf, type MindNode } from './mindmap';

const base = (): MindNode[] => newMap('m', 'Plan', '2026-11-24T00:00:00Z', 'r').nodes;
const ids = (nodes: readonly MindNode[]) => nodes.map(n => n.id);
/** r -> a, b; a -> a1, a2 */
const tree = (): MindNode[] => addChild(addChild(addChild(addChild(base(), 'r', 'a', 'A'), 'r', 'b', 'B'), 'a', 'a1', 'A1'), 'a', 'a2', 'A2');

describe('building a mind map', () => {
  it('starts with one central idea named like the map', () => {
    const m = newMap('m', 'Plan', 'now', 'r', 'Asha');
    expect(m).toMatchObject({ id: 'm', name: 'Plan', createdBy: 'Asha', nodes: [{ id: 'r', parentId: null, text: 'Plan' }] });
    expect(rootOf(m.nodes)!.id).toBe('r');
  });

  it('adds an idea under another, and opens the one it went into when it was folded', () => {
    const folded = updateNode(tree(), 'a', { collapsed: true });
    const next = addChild(folded, 'a', 'a3');
    expect(childrenOf(next, 'a').map(n => n.id)).toEqual(['a1', 'a2', 'a3']);
    expect(next.find(n => n.id === 'a')!.collapsed).toBe(false);
    expect(addChild(tree(), 'nope', 'x')).toHaveLength(tree().length); // an unknown parent adds nothing
  });

  it('adds a sibling straight after an idea among its brothers and sisters, and none for the central idea', () => {
    const next = addSibling(tree(), 'a', 'a-next');
    expect(childrenOf(next, 'r').map(n => n.id)).toEqual(['a', 'a-next', 'b']);
    expect(childrenOf(next, 'a').map(n => n.id)).toEqual(['a1', 'a2']); // the branch of a is untouched
    expect(next.find(n => n.id === 'a-next')!.parentId).toBe('r');
    expect(addSibling(tree(), 'r', 'x')).toHaveLength(tree().length);
  });

  it('stops growing at the limit', () => {
    const many: MindNode[] = Array.from({ length: MAX_NODES }, (_, i) => ({ id: `n${i}`, parentId: i === 0 ? null : 'n0', text: 'x' }));
    expect(addChild(many, 'n0', 'extra')).toHaveLength(MAX_NODES);
    expect(addSibling(many, 'n1', 'extra')).toHaveLength(MAX_NODES);
  });
});

describe('changing a mind map', () => {
  it('removes an idea with everything under it, and never the central idea', () => {
    expect(ids(removeNode(tree(), 'a'))).toEqual(['r', 'b']);
    expect(removeNode(tree(), 'r')).toHaveLength(tree().length);
    expect(removeNode(tree(), 'missing')).toHaveLength(tree().length);
  });

  it('changes the text, colour, note and linked ticket of one idea and nothing else', () => {
    const next = updateNode(tree(), 'a1', { text: 'Renamed', color: '#112233', note: 'Why', ticketKey: 'LIRA-4' });
    expect(next.find(n => n.id === 'a1')).toMatchObject({ text: 'Renamed', color: '#112233', note: 'Why', ticketKey: 'LIRA-4', parentId: 'a' });
    expect(next.find(n => n.id === 'a2')!.text).toBe('A2');
  });

  it('moves an idea with its branch under another, and refuses a move into itself, its own branch, its parent, or the central idea', () => {
    const moved = moveNode(tree(), 'a', 'b');
    expect(moved.find(n => n.id === 'a')!.parentId).toBe('b');
    expect(moved.find(n => n.id === 'a1')!.parentId).toBe('a'); // the branch went along
    for (const [id, to] of [['a', 'a'], ['a', 'a1'], ['a1', 'a'], ['r', 'b'], ['a', 'missing'], ['missing', 'b']] as const) expect(moveNode(tree(), id, to), `${id} -> ${to}`).toEqual(tree());
  });

  it('folds and unfolds, hides what is under a folded idea, and folds every branch at once', () => {
    const folded = updateNode(tree(), 'a', { collapsed: true });
    expect(ids(visibleNodes(folded))).toEqual(['r', 'a', 'b']);
    expect(ids(visibleNodes(setAllCollapsed(tree(), true)))).toEqual(['r', 'a', 'b']);
    expect(ids(visibleNodes(setAllCollapsed(setAllCollapsed(tree(), true), false)))).toEqual(ids(tree()));
    expect(setAllCollapsed(tree(), true).find(n => n.id === 'b')!.collapsed).toBeUndefined(); // a leaf has nothing to fold
  });

  it('finds a branch', () => {
    expect([...subtreeIds(tree(), 'a')].sort()).toEqual(['a', 'a1', 'a2']);
    expect([...subtreeIds(tree(), 'b')]).toEqual(['b']);
  });
});

describe('placing the ideas', () => {
  it('puts each level in a column to the right and each idea in the middle of its own branch', () => {
    const boxes = layout(tree());
    const [r, a, b, a1, a2] = ['r', 'a', 'b', 'a1', 'a2'].map(i => boxes.get(i)!);
    expect(r.x).toBe(0);
    expect(a.x).toBeGreaterThan(r.x + r.w);
    expect(a1.x).toBeGreaterThan(a.x + a.w);
    expect(a1.x).toBe(a2.x);
    expect(a.y + NODE_H / 2).toBeCloseTo((a1.y + a2.y + NODE_H) / 2, 5); // a sits at the middle of its children
    expect(b.y).toBeGreaterThan(a2.y); // the next branch starts below the whole of the first
    expect(r.y + NODE_H / 2).toBeGreaterThan(a.y + NODE_H / 2); // the central idea sits between its two branches
    expect(r.y + NODE_H / 2).toBeLessThan(b.y + NODE_H / 2);
  });

  it('never lets two ideas overlap, however the map grows', () => {
    let nodes = base();
    for (let i = 0; i < 40; i++) nodes = addChild(nodes, i % 3 === 0 ? 'r' : nodes[Math.floor(i / 2)].id, `n${i}`, `Idea ${i}`.repeat(1 + (i % 4)));
    const list = [...layout(nodes).values()];
    for (const a of list) for (const b of list) {
      if (a === b) continue;
      const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
      expect(apart).toBe(true);
    }
  });

  it('leaves out what is folded, and sizes a box to its text within limits', () => {
    expect([...layout(updateNode(tree(), 'a', { collapsed: true })).keys()]).toEqual(['r', 'a', 'b']);
    expect(widthOf('')).toBe(96);
    expect(widthOf('x'.repeat(1000))).toBe(260);
    expect(widthOf('x'.repeat(20))).toBe(172);
    expect(layout([]).size).toBe(0);
  });
});

describe('outlines', () => {
  it('writes the map as an indented list with the ticket after the idea and the note under it', () => {
    const nodes = updateNode(updateNode(tree(), 'a1', { ticketKey: 'LIRA-4' }), 'a', { note: 'line one\nline two' });
    expect(toOutline(nodes)).toBe('- Plan\n  - A\n    > line one\n    > line two\n    - A1 [LIRA-4]\n    - A2\n  - B');
    expect(toOutline([])).toBe('');
  });

  it('reads an indented list back: the first line is the central idea, deeper lines go under the line above', () => {
    let n = 0;
    const nodes = fromOutline('- Plan\n  - A\n    - A1\n    - A2\n  - B\n', () => `i${++n}`);
    expect(nodes.map(x => [x.text, x.parentId])).toEqual([['Plan', null], ['A', 'i1'], ['A1', 'i2'], ['A2', 'i2'], ['B', 'i1']]);
  });

  it('reads stars, numbers, tabs and plain lines, puts a second top line under the central idea, and treats a big jump as one level', () => {
    let n = 0;
    const nodes = fromOutline('Plan\n* Top two\n1. Numbered\n\t\tTabbed\n          Deep jump\n\n', () => `i${++n}`);
    expect(nodes.map(x => [x.text, x.parentId])).toEqual([['Plan', null], ['Top two', 'i1'], ['Numbered', 'i1'], ['Tabbed', 'i3'], ['Deep jump', 'i4']]);
    expect(fromOutline('   \n\n', () => 'x')).toEqual([]);
  });

  it('round-trips what it writes, and cuts a very long line', () => {
    let n = 0;
    const back = fromOutline(toOutline(tree()), () => `i${++n}`);
    expect(back.map(x => x.text)).toEqual(['Plan', 'A', 'A1', 'A2', 'B']);
    expect(fromOutline('x'.repeat(500), () => 'i')[0].text).toHaveLength(200);
  });
});

describe('searching and moving about', () => {
  it('finds ideas by any of the words in their text, note or ticket, in any case', () => {
    const nodes = updateNode(updateNode(tree(), 'a1', { note: 'Budget review' }), 'b', { ticketKey: 'LIRA-9' });
    expect([...searchNodes(nodes, 'budget REVIEW')]).toEqual(['a1']);
    expect([...searchNodes(nodes, 'lira-9')]).toEqual(['b']);
    expect(searchNodes(nodes, '   ').size).toBe(0);
    expect(searchNodes(nodes, 'nothing here').size).toBe(0);
  });

  it('moves the selection by arrows: left to the parent, right to the first child, up and down among siblings', () => {
    const t = tree();
    expect(neighbour(t, 'a1', 'left')).toBe('a');
    expect(neighbour(t, 'a', 'right')).toBe('a1');
    expect(neighbour(t, 'a1', 'down')).toBe('a2');
    expect(neighbour(t, 'a2', 'up')).toBe('a1');
    expect(neighbour(t, 'a2', 'down')).toBeNull();
    expect(neighbour(t, 'r', 'down')).toBeNull();
    expect(neighbour(t, 'r', 'left')).toBeNull();
    expect(neighbour(updateNode(t, 'a', { collapsed: true }), 'a', 'right')).toBeNull();
    expect(neighbour(t, 'missing', 'left')).toBeNull();
  });
});
