/**
 * The free-form layer of a storyboard, like the shapes of a drawing program: boxes, ellipses, notes and text placed anywhere, lines and
 * arrows between any two of them (or between ideas of the tree), and comments pinned to an item or a spot. Pure functions: each takes
 * the layer and gives back the next one.
 */
export type ShapeKind = 'box' | 'ellipse' | 'note' | 'text';
export type FontSize = 'small' | 'medium' | 'large';
export interface TextStyle { bold?: boolean; italic?: boolean; underline?: boolean }

export interface Shape extends TextStyle { id: string; kind: ShapeKind; x: number; y: number; w: number; h: number; text: string; color?: string; size?: FontSize }
/** A line between two items: ideas of the tree and shapes both count. */
export interface Link { id: string; from: string; to: string; arrow: boolean; color?: string; dashed?: boolean }
export interface MindComment { id: string; targetId: string | null; x: number; y: number; text: string; author: string; at: string; editedAt?: string; resolved?: boolean }
export interface FreeDoc { shapes: Shape[]; links: Link[]; comments: MindComment[] }
export interface Rect { x: number; y: number; w: number; h: number }
export interface Item extends Rect { ellipse?: boolean }

/** The size of the letters of a shape, by the name of the size. */
export const FONT_PX: Record<FontSize, number> = { small: 12, medium: 14, large: 18 };
export const MAX_SHAPES = 300;
export const MAX_LINKS = 600;
export const MAX_COMMENTS = 300;
export const MAX_TEXT = 500;
export const MAX_COMMENT_TEXT = 1000;
export const MIN_W = 48;
export const MIN_H = 28;
export const EMPTY_FREE: FreeDoc = Object.freeze({ shapes: [], links: [], comments: [] }) as FreeDoc;

const SIZES: Record<ShapeKind, { w: number; h: number; text: string }> = {
  box: { w: 160, h: 64, text: 'Box' }, ellipse: { w: 160, h: 76, text: 'Ellipse' }, note: { w: 160, h: 110, text: 'Note' }, text: { w: 140, h: 34, text: 'Text' },
};

/** A new shape of a kind with its middle at (x, y). */
export function newShape(kind: ShapeKind, id: string, x: number, y: number): Shape {
  const s = SIZES[kind];
  return { id, kind, x: Math.round(x - s.w / 2), y: Math.round(y - s.h / 2), w: s.w, h: s.h, text: s.text };
}

export function addShape(free: FreeDoc, shape: Shape): FreeDoc {
  return free.shapes.length >= MAX_SHAPES ? free : { ...free, shapes: [...free.shapes, shape] };
}
export const updateShape = (free: FreeDoc, id: string, patch: Partial<Omit<Shape, 'id' | 'kind'>>): FreeDoc => ({
  ...free, shapes: free.shapes.map(s => (s.id === id ? { ...s, ...patch, text: patch.text === undefined ? s.text : patch.text.slice(0, MAX_TEXT), w: Math.max(MIN_W, patch.w ?? s.w), h: Math.max(MIN_H, patch.h ?? s.h) } : s)),
});
export const moveShape = (free: FreeDoc, id: string, dx: number, dy: number): FreeDoc =>
  ({ ...free, shapes: free.shapes.map(s => (s.id === id ? { ...s, x: Math.round(s.x + dx), y: Math.round(s.y + dy) } : s)) });

/** Takes away a shape, or a line, or a comment, and everything that hung on it: a shape's lines and comments, an idea's lines and comments too. */
export function removeItem(free: FreeDoc, id: string): FreeDoc {
  return {
    shapes: free.shapes.filter(s => s.id !== id), links: free.links.filter(l => l.id !== id && l.from !== id && l.to !== id), comments: free.comments.filter(c => c.id !== id && c.targetId !== id),
  };
}

/** A line between two items. Refused for the same item twice, for an item that is not there, for a line that exists already (either way round), and past the limit. */
export function addLink(free: FreeDoc, known: ReadonlySet<string>, link: Link): FreeDoc {
  if (link.from === link.to || !known.has(link.from) || !known.has(link.to) || free.links.length >= MAX_LINKS) return free;
  if (free.links.some(l => (l.from === link.from && l.to === link.to) || (l.from === link.to && l.to === link.from))) return free;
  return { ...free, links: [...free.links, link] };
}
export const updateLink = (free: FreeDoc, id: string, patch: Partial<Omit<Link, 'id' | 'from' | 'to'>>): FreeDoc => ({ ...free, links: free.links.map(l => (l.id === id ? { ...l, ...patch } : l)) });

/** A comment on an item (or at a spot when `targetId` is null). Refused when empty, too long a text is cut, and past the limit. */
export function addComment(free: FreeDoc, comment: MindComment): FreeDoc {
  const text = comment.text.trim().slice(0, MAX_COMMENT_TEXT);
  if (!text || free.comments.length >= MAX_COMMENTS) return free;
  return { ...free, comments: [...free.comments, { ...comment, text }] };
}
/** New words for a comment, with the time it was changed. An empty text changes nothing. */
export function editComment(free: FreeDoc, id: string, text: string, now: string): FreeDoc {
  const clean = text.trim().slice(0, MAX_COMMENT_TEXT);
  if (!clean) return free;
  return { ...free, comments: free.comments.map(c => (c.id === id ? { ...c, text: clean, editedAt: now } : c)) };
}
export const toggleResolved = (free: FreeDoc, id: string): FreeDoc => ({ ...free, comments: free.comments.map(c => (c.id === id ? { ...c, resolved: !c.resolved } : c)) });

/** Where a line leaves an item on its way to a point: the edge of the rectangle or of the ellipse, not its middle. */
export function edgePoint(item: Item, toward: { x: number; y: number }): { x: number; y: number } {
  const cx = item.x + item.w / 2; const cy = item.y + item.h / 2;
  const dx = toward.x - cx; const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const t = item.ellipse
    ? 1 / Math.sqrt((dx / (item.w / 2)) ** 2 + (dy / (item.h / 2)) ** 2)
    : Math.min(dx === 0 ? Infinity : item.w / 2 / Math.abs(dx), dy === 0 ? Infinity : item.h / 2 / Math.abs(dy));
  return { x: cx + dx * t, y: cy + dy * t };
}

/** The two ends of a line, each on the edge of its item and pointing at the other, or null when an item is missing. */
export function linkEnds(link: Link, items: ReadonlyMap<string, Item>): { a: { x: number; y: number }; b: { x: number; y: number } } | null {
  const from = items.get(link.from); const to = items.get(link.to);
  if (!from || !to) return null;
  const mid = (i: Item) => ({ x: i.x + i.w / 2, y: i.y + i.h / 2 });
  return { a: edgePoint(from, mid(to)), b: edgePoint(to, mid(from)) };
}

/** Where a comment's pin sits: the top right corner of what it is about, or the spot it was left at. */
export function pinAt(c: MindComment, items: ReadonlyMap<string, Item>): { x: number; y: number } {
  const target = c.targetId ? items.get(c.targetId) : undefined;
  return target ? { x: target.x + target.w, y: target.y } : { x: c.x, y: c.y };
}

/** The three corners of an arrowhead that ends at `to` and points away from `from`, as the points of a polygon. */
export function arrowHead(from: { x: number; y: number }, to: { x: number; y: number }, size = 11): string {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const corner = (turn: number) => `${Math.round((to.x - size * Math.cos(angle + turn)) * 10) / 10},${Math.round((to.y - size * Math.sin(angle + turn)) * 10) / 10}`;
  return `${Math.round(to.x * 10) / 10},${Math.round(to.y * 10) / 10} ${corner(0.4)} ${corner(-0.4)}`;
}

/** What the page reads back from a stored map: only well formed shapes, lines and comments, within the limits, whatever was stored. */
export function readFree(raw: { shapes?: unknown; links?: unknown; comments?: unknown }): FreeDoc {
  const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : []);
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const str = (v: unknown): v is string => typeof v === 'string';
  const shapes = arr(raw.shapes).filter(s => str(s.id) && ['box', 'ellipse', 'note', 'text'].includes(s.kind as string) && num(s.x) && num(s.y) && num(s.w) && num(s.h) && str(s.text)).slice(0, MAX_SHAPES)
    .map(s => ({ ...s, text: (s.text as string).slice(0, MAX_TEXT), w: Math.max(MIN_W, s.w as number), h: Math.max(MIN_H, s.h as number) }) as unknown as Shape);
  const links = arr(raw.links).filter(l => str(l.id) && str(l.from) && str(l.to) && l.from !== l.to).slice(0, MAX_LINKS).map(l => ({ id: l.id, from: l.from, to: l.to, arrow: l.arrow === true, color: str(l.color) ? l.color : undefined, dashed: l.dashed === true }) as Link);
  const comments = arr(raw.comments).filter(c => str(c.id) && str(c.text) && c.text.trim() !== '' && str(c.author) && str(c.at) && num(c.x) && num(c.y)).slice(0, MAX_COMMENTS)
    .map(c => ({ ...c, text: (c.text as string).slice(0, MAX_COMMENT_TEXT), targetId: str(c.targetId) ? c.targetId : null }) as unknown as MindComment);
  return { shapes, links, comments };
}

/** Breaks a text into lines that fit a width, at spaces where it can and in the middle of a long word where it must, and at the line breaks that were typed. */
export function wrapLines(text: string, width: number, fontPx: number): string[] {
  const perLine = Math.max(1, Math.floor(width / (fontPx * 0.56)));
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      let rest = word;
      while (rest.length > perLine) { if (line) { lines.push(line); line = ''; } lines.push(rest.slice(0, perLine)); rest = rest.slice(perLine); }
      if (!line) line = rest;
      else if (line.length + 1 + rest.length <= perLine) line += ` ${rest}`;
      else { lines.push(line); line = rest; }
    }
    lines.push(line);
  }
  return lines;
}

/** The smallest rectangle that holds both, or the one that exists when the other does not. */
export function mergeBounds(a: Rect, b: Rect | null): Rect {
  if (!b) return a;
  if (a.w === 0 && a.h === 0) return b;
  const x = Math.min(a.x, b.x); const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** Everything the layer covers, for fitting the map on the screen. */
export function freeBounds(shapes: readonly Shape[]): Rect | null {
  if (shapes.length === 0) return null;
  const x1 = Math.min(...shapes.map(s => s.x)); const y1 = Math.min(...shapes.map(s => s.y));
  return { x: x1, y: y1, w: Math.max(...shapes.map(s => s.x + s.w)) - x1, h: Math.max(...shapes.map(s => s.y + s.h)) - y1 };
}
