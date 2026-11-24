import { describe, expect, it } from 'vitest';
import { MIND_COLORS } from '../theme/palette';
import { boundsOf, colorOf, connector, layoutMap, neighbourOf, ROW_H, strokeOf } from './mindLayout';
import { addChild, newMap, updateNode, type MindNode } from './mindmap';

const base = (): MindNode[] => newMap('m', 'Plan', '2026-11-24T00:00:00Z', 'r').nodes;
/** r -> a, b, c; a -> a1, a2; b -> b1 */
const tree = (): MindNode[] => {
  let n = base();
  for (const [id, parent] of [['a', 'r'], ['b', 'r'], ['c', 'r'], ['a1', 'a'], ['a2', 'a'], ['b1', 'b']] as const) n = addChild(n, parent, id, id.toUpperCase());
  return n;
};

describe('placing the ideas around the centre', () => {
  it('puts the central idea at the middle and its branches alternately to the right and the left', () => {
    const boxes = layoutMap(tree());
    const r = boxes.get('r')!;
    expect(r.x + r.w / 2).toBeCloseTo(0, 5);
    expect(r.y + r.h / 2).toBeCloseTo(0, 5);
    expect(boxes.get('a')).toMatchObject({ side: 'right', depth: 1, branch: 0 });
    expect(boxes.get('b')).toMatchObject({ side: 'left', depth: 1, branch: 1 });
    expect(boxes.get('c')).toMatchObject({ side: 'right', depth: 1, branch: 2 });
    expect(boxes.get('a')!.x).toBeGreaterThan(r.x + r.w);
    expect(boxes.get('b')!.x + boxes.get('b')!.w).toBeLessThan(r.x);
  });

  it('puts the children further out than their parent on the same side, and the parent in the middle of them', () => {
    const boxes = layoutMap(tree());
    const a = boxes.get('a')!; const a1 = boxes.get('a1')!; const a2 = boxes.get('a2')!; const b1 = boxes.get('b1')!; const b = boxes.get('b')!;
    expect(a1.x).toBeGreaterThan(a.x + a.w);
    expect(a1.side).toBe('right');
    expect(a.y + ROW_H / 2).toBeCloseTo((a1.y + a2.y + ROW_H) / 2, 5);
    expect(b1.x + b1.w).toBeLessThan(b.x); // on the left, further out means further left
    expect(b1.side).toBe('left');
  });

  it('never lets two ideas overlap, however the map grows', () => {
    let nodes = tree();
    for (let i = 0; i < 12; i++) nodes = addChild(addChild(nodes, i % 2 ? 'a' : 'b', `x${i}`, `x${i}`), `x${i}`, `y${i}`, `y${i}`);
    const list = [...layoutMap(nodes).values()];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const p = list[i]; const q = list[j];
      expect(p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h, `${i} and ${j}`).toBe(false);
    }
  });

  it('leaves out what is folded, gives nothing for an empty map, and measures the whole', () => {
    expect([...layoutMap(updateNode(tree(), 'a', { collapsed: true })).keys()].sort()).toEqual(['a', 'b', 'b1', 'c', 'r']);
    expect(layoutMap([]).size).toBe(0);
    const bounds = boundsOf(layoutMap(tree()));
    expect(bounds.w).toBeGreaterThan(0);
    expect(bounds.x).toBeLessThan(0);
    expect(boundsOf(new Map())).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

describe('colours', () => {
  it('gives each main branch its own colour from the palette, and its twigs the same', () => {
    const nodes = tree();
    expect(colorOf(nodes, 'a')).toBe(MIND_COLORS[0]);
    expect(colorOf(nodes, 'b')).toBe(MIND_COLORS[1]);
    expect(colorOf(nodes, 'a2')).toBe(MIND_COLORS[0]);
    expect(colorOf(nodes, 'b1')).toBe(MIND_COLORS[1]);
    expect(colorOf(nodes, 'r')).toBeUndefined();
  });
  it('lets a colour chosen for an idea win, for it and for what is under it, and goes round when there are more branches than colours', () => {
    const nodes = updateNode(tree(), 'a', { color: '#123456' });
    expect(colorOf(nodes, 'a1')).toBe('#123456');
    expect(colorOf(nodes, 'b')).toBe(MIND_COLORS[1]);
    let many = base();
    for (let i = 0; i < MIND_COLORS.length + 1; i++) many = addChild(many, 'r', `m${i}`);
    expect(colorOf(many, `m${MIND_COLORS.length}`)).toBe(MIND_COLORS[0]);
  });
});

describe('lines', () => {
  const boxes = layoutMap(tree());
  it('runs straight when both ends are level, and bends with rounded corners otherwise, on either side', () => {
    expect(connector({ x: 0, y: 0, w: 50, h: 30, side: 'right', depth: 1, branch: 0 }, { x: 100, y: 0, w: 50, h: 30, side: 'right', depth: 2, branch: 0 })).toBe('M50 15H100');
    const right = connector(boxes.get('a')!, boxes.get('a1')!);
    expect(right).toMatch(/^M[\d.-]+ [\d.-]+H[\d.-]+Q.*V.*Q.*H/);
    const left = connector(boxes.get('b')!, boxes.get('b1')!);
    expect(left.startsWith(`M${boxes.get('b')!.x} `)).toBe(true); // out of the parent's outer edge, which is its left edge here
  });
  it('is thicker near the centre and finer at the twigs', () => {
    expect(strokeOf(1)).toBeGreaterThan(strokeOf(2));
    expect(strokeOf(2)).toBeGreaterThan(strokeOf(3));
    expect(strokeOf(9)).toBe(strokeOf(3));
  });
});

describe('moving about with the arrows', () => {
  const nodes = tree();
  const boxes = layoutMap(nodes);
  it('goes out to the first child and back to the parent on the right side, and the other way round on the left', () => {
    expect(neighbourOf(nodes, boxes, 'a', 'right')).toBe('a1');
    expect(neighbourOf(nodes, boxes, 'a1', 'left')).toBe('a');
    expect(neighbourOf(nodes, boxes, 'b', 'left')).toBe('b1');
    expect(neighbourOf(nodes, boxes, 'b1', 'right')).toBe('b');
  });
  it('goes from the central idea to its first branch on the side chosen', () => {
    expect(neighbourOf(nodes, boxes, 'r', 'right')).toBe('a');
    expect(neighbourOf(nodes, boxes, 'r', 'left')).toBe('b');
  });
  it('goes up and down among the ideas of the same parent on the same side, and stops at the ends', () => {
    expect(neighbourOf(nodes, boxes, 'a1', 'down')).toBe('a2');
    expect(neighbourOf(nodes, boxes, 'a2', 'up')).toBe('a1');
    expect(neighbourOf(nodes, boxes, 'a2', 'down')).toBeNull();
    expect(neighbourOf(nodes, boxes, 'a', 'down')).toBe('c'); // the next branch on the same (right) side
    expect(neighbourOf(nodes, boxes, 'r', 'down')).toBeNull();
  });
  it('does not go into a folded idea, and knows nothing of an idea that is not there', () => {
    const folded = updateNode(nodes, 'a', { collapsed: true });
    expect(neighbourOf(folded, layoutMap(folded), 'a', 'right')).toBeNull();
    expect(neighbourOf(nodes, boxes, 'zzz', 'right')).toBeNull();
  });
});
