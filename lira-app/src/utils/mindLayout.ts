import { MIND_COLORS } from '../theme/palette';
import { childrenOf, rootOf, visibleNodes, widthOf, type MindNode } from './mindmap';

export type Side = 'left' | 'right' | 'root';
/** Where an idea sits. The centre of the map is (0, 0); `branch` is which main branch it belongs to (-1 for the central idea). */
export interface Placed { x: number; y: number; w: number; h: number; side: Side; depth: number; branch: number }

export const ROW_H = 30;
const ROW_GAP = 10;
export const ROOT_H = 48;
const COL_GAP = 56;
const ROOT_GAP = 72;

/** The central idea is wider than the others, as it is the title of the map. */
const rootWidth = (text: string): number => Math.min(320, Math.max(160, text.length * 11 + 48));
const widthFor = (n: MindNode): number => n.w ?? widthOf(n.text);

/**
 * Places the visible ideas around the central one: its branches alternate to the right and the left, each level a column further out,
 * every idea centred on its own branch so that nothing overlaps, and each side centred on the central idea.
 */
export function layoutMap(nodes: readonly MindNode[]): Map<string, Placed> {
  const shown = visibleNodes(nodes);
  const root = rootOf(shown);
  const boxes = new Map<string, Placed>();
  if (!root) return boxes;
  const kids = (id: string) => childrenOf(shown, id);
  const height = new Map<string, number>();
  const measure = (n: MindNode): number => {
    const list = kids(n.id);
    const h = list.length ? list.reduce((sum, c) => sum + measure(c), 0) + ROW_GAP * (list.length - 1) : ROW_H;
    height.set(n.id, Math.max(h, ROW_H));
    return height.get(n.id)!;
  };
  const rw = root.w ?? rootWidth(root.text);
  boxes.set(root.id, { x: -rw / 2, y: -ROOT_H / 2, w: rw, h: ROOT_H, side: 'root', depth: 0, branch: -1 });

  const place = (n: MindNode, x: number, top: number, side: 'left' | 'right', depth: number, branch: number) => {
    const w = widthFor(n);
    boxes.set(n.id, { x: side === 'right' ? x : x - w, y: top + height.get(n.id)! / 2 - ROW_H / 2, w, h: ROW_H, side, depth, branch });
    let y = top;
    for (const c of kids(n.id)) {
      place(c, side === 'right' ? x + w + COL_GAP : x - w - COL_GAP, y, side, depth + 1, branch);
      y += height.get(c.id)! + ROW_GAP;
    }
  };
  const main = kids(root.id);
  main.forEach(m => measure(m));
  for (const side of ['right', 'left'] as const) {
    const mine = main.map((m, i) => ({ m, i })).filter(({ i }) => (i % 2 === 0) === (side === 'right'));
    const total = mine.reduce((sum, { m }) => sum + height.get(m.id)!, 0) + ROW_GAP * Math.max(0, mine.length - 1);
    let y = -total / 2;
    for (const { m, i } of mine) { place(m, side === 'right' ? boxes.get(root.id)!.x + rw + ROOT_GAP : boxes.get(root.id)!.x - ROOT_GAP, y, side, 1, i); y += height.get(m.id)! + ROW_GAP; }
  }
  // Ideas the person moved by hand: the move is kept for the idea and for everything under it.
  const shift = (n: MindNode, ox: number, oy: number) => {
    const sx = ox + (n.dx ?? 0); const sy = oy + (n.dy ?? 0);
    const b = boxes.get(n.id);
    if (b) boxes.set(n.id, { ...b, x: b.x + sx, y: b.y + sy });
    for (const c of kids(n.id)) shift(c, sx, sy);
  };
  shift(root, 0, 0);
  return boxes;
}

/** The smallest rectangle that holds every placed idea. */
export function boundsOf(boxes: ReadonlyMap<string, Placed>): { x: number; y: number; w: number; h: number } {
  const all = [...boxes.values()];
  if (all.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const x1 = Math.min(...all.map(b => b.x)); const y1 = Math.min(...all.map(b => b.y));
  return { x: x1, y: y1, w: Math.max(...all.map(b => b.x + b.w)) - x1, h: Math.max(...all.map(b => b.y + b.h)) - y1 };
}

/**
 * The colour of an idea: the one given to it or to the nearest idea above it, otherwise the colour of its main branch, so each branch is
 * one colour and its twigs follow. The central idea has none.
 */
export function colorOf(nodes: readonly MindNode[], id: string): string | undefined {
  const root = rootOf(nodes);
  const byId = new Map(nodes.map(n => [n.id, n]));
  let at = byId.get(id);
  let mainIndex = -1;
  while (at && at.parentId !== null) {
    if (at.color) return at.color;
    if (at.parentId === root?.id) mainIndex = childrenOf(nodes, root.id).findIndex(c => c.id === at!.id);
    at = byId.get(at.parentId);
  }
  return mainIndex < 0 ? undefined : MIND_COLORS[mainIndex % MIND_COLORS.length];
}

/** The line from an idea to one of its children: out of the parent, a rounded bend, and into the child, like branches of a tree. */
export function connector(from: Placed, to: Placed): string {
  const dir = to.side === 'left' ? -1 : 1;
  const x1 = dir === 1 ? from.x + from.w : from.x;
  const x2 = dir === 1 ? to.x : to.x + to.w;
  const y1 = from.y + from.h / 2;
  const y2 = to.y + to.h / 2;
  if (Math.abs(y2 - y1) < 1) return `M${x1} ${y1}H${x2}`;
  const mid = x1 + dir * Math.min(COL_GAP, Math.abs(x2 - x1)) / 2;
  const r = Math.min(10, Math.abs(y2 - y1) / 2, Math.abs(mid - x1));
  const sy = Math.sign(y2 - y1);
  return `M${x1} ${y1}H${mid - dir * r}Q${mid} ${y1} ${mid} ${y1 + sy * r}V${y2 - sy * r}Q${mid} ${y2} ${mid + dir * r} ${y2}H${x2}`;
}

/** The thickness of a line: heavier near the centre, finer towards the twigs. */
export const strokeOf = (depth: number): number => (depth <= 1 ? 3.5 : depth === 2 ? 2.5 : 1.75);

/** The next idea to select with an arrow: towards the centre (the parent), away from it (the first child), or the one above or below in the same branch. */
export function neighbourOf(nodes: readonly MindNode[], boxes: ReadonlyMap<string, Placed>, id: string, dir: 'left' | 'right' | 'up' | 'down'): string | null {
  const at = nodes.find(n => n.id === id);
  const box = boxes.get(id);
  if (!at || !box) return null;
  const root = rootOf(nodes);
  if (dir === 'left' || dir === 'right') {
    const outward = box.side === 'root' ? dir : box.side === 'right' ? 'right' : 'left';
    const goesOut = box.side === 'root' || dir === outward;
    if (!goesOut) return at.parentId;
    const list = (box.side === 'root' ? childrenOf(nodes, id).filter(c => boxes.get(c.id)?.side === dir) : at.collapsed ? [] : childrenOf(nodes, id));
    return list[0]?.id ?? null;
  }
  if (!root || at.parentId === null) return null;
  const sibs = childrenOf(nodes, at.parentId).filter(c => boxes.get(c.id)?.side === box.side);
  return sibs[sibs.indexOf(at) + (dir === 'up' ? -1 : 1)]?.id ?? null;
}
