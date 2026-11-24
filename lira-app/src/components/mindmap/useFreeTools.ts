import { useMemo, useState, type PointerEvent } from 'react';
import { currentTime } from '../../utils/clock';
import { addComment, addLink, addShape, MIN_H, MIN_W, moveShape, newShape, type FreeDoc, type MindComment, type Shape, type ShapeKind } from '../../utils/mindFree';

/** What the pointer does on the drawing: select and move, put a shape down, join two things with a line, or leave a comment. */
export type Tool = 'select' | ShapeKind | 'line' | 'arrow' | 'comment';
export const SHAPE_TOOLS: readonly Tool[] = ['box', 'ellipse', 'note', 'text'];

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
  toPoint: (clientX: number, clientY: number) => { x: number; y: number };
  /** Every idea and shape a line may join. */
  known: ReadonlySet<string>;
  author: string;
  readOnly: boolean;
}

interface Drag { id: string; mode: 'move' | 'resize'; dx: number; dy: number }
export interface Composer { targetId: string | null; x: number; y: number }

const newId = (): string => crypto.randomUUID();

/** The shapes, lines and comments of the free-form layer, and what the pointer does to them. Changes are handed back whole, so undo covers them. */
export function useFreeTools({ free, onFree, tool, onTool, onSelect, onEditing, scale, toPoint, known, author, readOnly }: Args) {
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [composer, setComposer] = useState<Composer | null>(null);

  /** The shapes as they look right now, with the one being dragged or resized where the pointer has taken it. */
  const live = useMemo<Shape[]>(() => free.shapes.map(s => {
    if (!drag || drag.id !== s.id) return s;
    return drag.mode === 'move' ? { ...s, x: s.x + drag.dx, y: s.y + drag.dy } : { ...s, w: Math.max(MIN_W, s.w + drag.dx), h: Math.max(MIN_H, s.h + drag.dy) };
  }), [free.shapes, drag]);

  function reset() { setLinkFrom(null); setComposer(null); onTool('select'); }

  /** A press on empty space: puts a shape down, or opens a comment there. True when the tool used it, so the page is not panned. */
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
    if (tool === 'line' || tool === 'arrow') { setLinkFrom(null); return true; }
    return false;
  }

  /** A press on an idea or a shape with a tool that joins or comments. True when the tool used it. */
  function onItem(id: string, clientX: number, clientY: number): boolean {
    if (readOnly) return false;
    if (tool === 'comment') { const at = toPoint(clientX, clientY); setComposer({ targetId: id, x: at.x, y: at.y }); return true; }
    if (tool !== 'line' && tool !== 'arrow') return false;
    if (linkFrom === null) { setLinkFrom(id); return true; }
    onFree(addLink(free, known, { id: newId(), from: linkFrom, to: id, arrow: tool === 'arrow' }));
    reset();
    return true;
  }

  function track(e: PointerEvent, id: string, mode: Drag['mode']) {
    e.stopPropagation();
    if (readOnly || tool !== 'select') return;
    const origin = { x: e.clientX, y: e.clientY };
    let moved = false; let last = { dx: 0, dy: 0 };
    const move = (m: globalThis.PointerEvent) => {
      last = { dx: Math.round((m.clientX - origin.x) / scale), dy: Math.round((m.clientY - origin.y) / scale) };
      if (!moved && Math.hypot(m.clientX - origin.x, m.clientY - origin.y) < 4) return;
      moved = true; setDrag({ id, mode, ...last });
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      setDrag(null);
      if (!moved) return;
      onFree(mode === 'move' ? moveShape(free, id, last.dx, last.dy) : { ...free, shapes: free.shapes.map(s => (s.id === id ? { ...s, w: Math.max(MIN_W, s.w + last.dx), h: Math.max(MIN_H, s.h + last.dy) } : s)) });
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  function submitComment(text: string) {
    if (!composer) return;
    const comment: MindComment = { id: newId(), targetId: composer.targetId, x: composer.x, y: composer.y, text, author, at: currentTime().toISOString() };
    const next = addComment(free, comment);
    if (next !== free) { onFree(next); onSelect(comment.id); }
    reset();
  }

  return { live, linkFrom, composer, onBackground, onItem, startMove: (e: PointerEvent, id: string) => track(e, id, 'move'), startResize: (e: PointerEvent, id: string) => track(e, id, 'resize'), submitComment, cancel: reset };
}
