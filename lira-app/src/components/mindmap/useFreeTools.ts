import { useMemo, useState, type PointerEvent } from 'react';
import { currentTime } from '../../utils/clock';
import {
  addComment, addLink, addShape, bendFor, FREE, moveShape, newShape, resizeFrom, setLinkEnd, updateLink, updateShape,
  type FreeDoc, type Handle, type Item, type Link, type MindComment, type Pt, type Shape, type ShapeKind,
} from '../../utils/mindFree';

/** What the pointer does on the drawing: select and move, put a shape down, draw a line, or leave a comment. */
export type Tool = 'select' | ShapeKind | 'line' | 'arrow' | 'comment';
export const SHAPE_TOOLS: readonly Tool[] = ['box', 'ellipse', 'note', 'text'];
export type LinkPart = 'from' | 'to' | 'bend';

interface Args {
  free: FreeDoc;
  onFree: (next: FreeDoc) => void;
  tool: Tool;
  onTool: (tool: Tool) => void;
  onSelect: (id: string | null) => void;
  onEditing: (id: string | null) => void;
  /** The zoom of the drawing, so a drag of so many pixels moves a shape by so many units. */
  scale: number;
  /** A point of the screen as a point of the drawing. */
  toPoint: (clientX: number, clientY: number) => Pt;
  /** Every idea and shape by id, where it is now. */
  items: ReadonlyMap<string, Item>;
  author: string;
  readOnly: boolean;
}

type ShapeDrag = { kind: 'shape'; id: string; handle: Handle | null; dx: number; dy: number };
type LinkDrag = { kind: 'link'; id: string; part: LinkPart; at: Pt };
export interface Composer { targetId: string | null; x: number; y: number }
/** The start of a line being drawn: an item, or a place on the board. */
export type LinkStart = { id: string } | { at: Pt };

const newId = (): string => crypto.randomUUID();
const isItem = (id: string | undefined, items: ReadonlyMap<string, Item>): id is string => !!id && items.has(id);

/** The id of the idea or shape under a point of the screen, other than the ones asked to be ignored. */
function itemUnder(clientX: number, clientY: number, skip: ReadonlySet<string>): string | undefined {
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    const id = (el.closest('[data-shape-id]') as HTMLElement | null)?.dataset.shapeId ?? (el.closest('[data-node-id]') as HTMLElement | null)?.dataset.nodeId;
    if (id && !skip.has(id)) return id;
  }
  return undefined;
}

/** The shapes, lines and comments of the free-form layer, and what the pointer does to them. Changes are handed back whole, so undo covers them. */
export function useFreeTools({ free, onFree, tool, onTool, onSelect, onEditing, scale, toPoint, items, author, readOnly }: Args) {
  const [start, setStart] = useState<LinkStart | null>(null);
  const [drag, setDrag] = useState<ShapeDrag | LinkDrag | null>(null);
  const [composer, setComposer] = useState<Composer | null>(null);

  /** The shapes as they look right now, with the one being dragged or resized where the pointer has taken it. */
  const live = useMemo<Shape[]>(() => free.shapes.map(s => {
    if (!drag || drag.kind !== 'shape' || drag.id !== s.id) return s;
    return drag.handle ? { ...s, ...resizeFrom(s, drag.handle, drag.dx, drag.dy) } : { ...s, x: s.x + drag.dx, y: s.y + drag.dy };
  }), [free.shapes, drag]);

  /** The lines as they look right now: the one being bent or having an end moved follows the pointer. */
  const liveLinks = useMemo<Link[]>(() => free.links.map(l => {
    if (!drag || drag.kind !== 'link' || drag.id !== l.id) return l;
    if (drag.part === 'bend') return { ...l, bend: bendFor(l, items, drag.at) };
    return drag.part === 'from' ? { ...l, from: FREE, fromAt: drag.at } : { ...l, to: FREE, toAt: drag.at };
  }), [free.links, drag, items]);

  function reset() { setStart(null); setComposer(null); onTool('select'); }

  function draw(from: LinkStart, to: LinkStart) {
    const arrow = tool === 'arrow';
    const link: Link = { id: newId(), from: 'id' in from ? from.id : FREE, to: 'id' in to ? to.id : FREE, arrow, fromAt: 'at' in from ? from.at : undefined, toAt: 'at' in to ? to.at : undefined };
    onFree(addLink(free, new Set(items.keys()), link));
    reset();
  }

  /** A press on empty space: puts a shape down, opens a comment there, or starts or ends a line at that spot. True when the tool used it, so the board is not panned. */
  function onBackground(clientX: number, clientY: number): boolean {
    if (readOnly) return false;
    const at = toPoint(clientX, clientY);
    if ((SHAPE_TOOLS as readonly string[]).includes(tool)) {
      const shape = newShape(tool as ShapeKind, newId(), at.x, at.y);
      // The text box opens a moment later: the browser moves focus to the board as part of this very press, which would close a box opened now.
      onFree(addShape(free, shape)); onSelect(shape.id); window.setTimeout(() => onEditing(shape.id), 0); onTool('select');
      return true;
    }
    if (tool === 'comment') { setComposer({ targetId: null, x: at.x, y: at.y }); return true; }
    if (tool === 'line' || tool === 'arrow') { if (start) draw(start, { at }); else setStart({ at }); return true; }
    return false;
  }

  /** A press on an idea or a shape with a tool that joins or comments. True when the tool used it. */
  function onItem(id: string, clientX: number, clientY: number): boolean {
    if (readOnly) return false;
    if (tool === 'comment') { const at = toPoint(clientX, clientY); setComposer({ targetId: id, x: at.x, y: at.y }); return true; }
    if (tool !== 'line' && tool !== 'arrow') return false;
    if (!start) { setStart({ id }); return true; }
    if ('id' in start && start.id === id) return true; // the same item twice is not a line
    draw(start, { id });
    return true;
  }

  /** Follows the pointer after a press until it is let go, handing each step to `step` and the last one to `done`; a press that does not move is no drag. */
  function follow(e: PointerEvent, step: (dx: number, dy: number, m: globalThis.PointerEvent) => void, done: (dx: number, dy: number, m: globalThis.PointerEvent) => void) {
    e.stopPropagation();
    if (readOnly || tool !== 'select') return;
    const origin = { x: e.clientX, y: e.clientY };
    let moved = false;
    const delta = (m: globalThis.PointerEvent) => [Math.round((m.clientX - origin.x) / scale), Math.round((m.clientY - origin.y) / scale)] as const;
    const move = (m: globalThis.PointerEvent) => {
      if (!moved && Math.hypot(m.clientX - origin.x, m.clientY - origin.y) < 4) return;
      moved = true; step(...delta(m), m);
    };
    const up = (m: globalThis.PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      setDrag(null);
      if (moved) done(...delta(m), m);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  const startMove = (e: PointerEvent, id: string) => follow(e, (dx, dy) => setDrag({ kind: 'shape', id, handle: null, dx, dy }), (dx, dy) => onFree(moveShape(free, id, dx, dy)));
  const startResize = (e: PointerEvent, id: string, handle: Handle) => follow(e, (dx, dy) => setDrag({ kind: 'shape', id, handle, dx, dy }), (dx, dy) => {
    const s = free.shapes.find(x => x.id === id);
    if (s) onFree(updateShape(free, id, resizeFrom(s, handle, dx, dy)));
  });

  /** Drags the middle of a line to bend it, or an end of it onto another item (or to a free place, which makes the line longer or shorter). */
  function startLinkHandle(e: PointerEvent, id: string, part: LinkPart) {
    follow(e, (_dx, _dy, m) => setDrag({ kind: 'link', id, part, at: toPoint(m.clientX, m.clientY) }), (_dx, _dy, m) => {
      const link = free.links.find(l => l.id === id);
      if (!link) return;
      const at = toPoint(m.clientX, m.clientY);
      if (part === 'bend') { onFree(updateLink(free, id, { bend: bendFor(link, items, at) || undefined })); return; }
      const over = itemUnder(m.clientX, m.clientY, new Set());
      onFree(setLinkEnd(free, id, part, isItem(over, items) ? { id: over } : { at }));
    });
  }

  function submitComment(text: string) {
    if (!composer) return;
    const comment: MindComment = { id: newId(), targetId: composer.targetId, x: composer.x, y: composer.y, text, author, at: currentTime().toISOString() };
    const next = addComment(free, comment);
    if (next !== free) { onFree(next); onSelect(comment.id); }
    reset();
  }

  return { live, liveLinks, linkFrom: start && 'id' in start ? start.id : null, drawing: start !== null, composer, onBackground, onItem, startMove, startResize, startLinkHandle, submitComment, cancel: reset };
}
