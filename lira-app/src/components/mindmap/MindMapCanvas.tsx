import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useElementSize } from '../../hooks/useElementSize';
import { useLatest } from '../../hooks/useLatest';
import { currentTime } from '../../utils/clock';
import { editComment, freeBounds, mergeBounds, moveShape, removeItem, toggleResolved, updateLink, updateShape, type FreeDoc, type Item } from '../../utils/mindFree';
import { boundsOf, colorOf, connector, layoutMap, neighbourOf, strokeOf } from '../../utils/mindLayout';
import { addChild, addSibling, childrenOf, moveIdea, moveNode, removeNode, resizeIdea, searchNodes, subtreeIds, updateNode, visibleNodes, type MindNode } from '../../utils/mindmap';
import { CommentOverlay, CommentPins } from './MindComments';
import { MindControls } from './MindControls';
import { MindNodeView } from './MindNodeView';
import { MindShapeLayer } from './MindShapeLayer';
import { useFreeTools, type Tool } from './useFreeTools';
import { LEFT_INSET, useMindView } from './useMindView';

export type StyleKey = 'bold' | 'italic' | 'underline';

interface Props {
  nodes: MindNode[];
  onChange: (next: MindNode[]) => void;
  free: FreeDoc;
  onFree: (next: FreeDoc) => void;
  tool: Tool;
  onTool: (tool: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** The idea or shape whose text is being typed, if any, kept by the page so that its tools can start an edit too. */
  editing: string | null;
  onEditing: (id: string | null) => void;
  /** Bold, italic or underline for what is selected, from the keys. */
  onStyle: (key: StyleKey) => void;
  author: string;
  query: string;
  readOnly?: boolean;
}

const uid = (): string => crypto.randomUUID();
const ARROWS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' } as const;
const STYLE_KEYS: Record<string, StyleKey> = { b: 'bold', i: 'italic', u: 'underline' };
const HINTS: Partial<Record<Tool, string>> = {
  box: 'Click on the board to put a box there. Esc stops.', ellipse: 'Click on the board to put an ellipse there. Esc stops.', note: 'Click on the board to put a sticky note there. Esc stops.',
  text: 'Click on the board to write text there. Esc stops.', comment: 'Click an idea, a shape or a spot to leave a comment. Esc stops.',
};

/**
 * The drawing of a storyboard: the central idea in the middle with branches either side, each branch in its own colour, and over it a free-form
 * layer of boxes, ellipses, sticky notes, text, lines, arrows and comments. Panned by dragging the background, zoomed with the wheel or a
 * pinch (only the drawing zooms, never the page), an idea dragged onto another to move its branch there.
 */
export function MindMapCanvas({ nodes, onChange, free, onFree, tool, onTool, onUndo, onRedo, canUndo, canRedo, selected, onSelect, editing, onEditing, onStyle, author, query, readOnly = false }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const size = useElementSize(wrap);
  const { view, startPan, zoomBy, fit } = useMindView();
  // An idea being dragged or resized shows where it will land while the pointer is still down; it is saved when the pointer is let go.
  const [dragIdea, setDragIdea] = useState<{ id: string; x: number; y: number; dx: number; dy: number; over: string | null; shift: boolean } | null>(null);
  const [sizing, setSizing] = useState<{ id: string; w: number } | null>(null);
  const settled = useRef(false); // the edit was already finished by Enter or Escape, so the box losing focus must not finish it again
  const originX = size.w / 2 + LEFT_INSET / 2;
  const originY = size.h / 2;
  const liveNodes = useMemo(() => {
    const moved = dragIdea ? moveIdea(nodes, dragIdea.id, dragIdea.dx, dragIdea.dy) : nodes;
    return sizing ? resizeIdea(moved, sizing.id, sizing.w) : moved;
  }, [nodes, dragIdea, sizing]);
  const boxes = layoutMap(liveNodes);
  const shown = visibleNodes(liveNodes);
  const found = searchNodes(nodes, query);
  const byId = new Map(nodes.map(n => [n.id, n]));
  const toPoint = (cx: number, cy: number) => { const r = wrap.current?.getBoundingClientRect(); return { x: (cx - (r?.left ?? 0) - originX - view.x) / view.k, y: (cy - (r?.top ?? 0) - originY - view.y) / view.k }; };
  const toScreen = (p: { x: number; y: number }) => ({ x: originX + view.x + p.x * view.k, y: originY + view.y + p.y * view.k });
  const itemsOf = (shapes: readonly { id: string; x: number; y: number; w: number; h: number; kind: string }[]) => {
    const all = new Map<string, Item>([...boxes].map(([id, b]) => [id, b] as [string, Item]));
    for (const s of shapes) all.set(s.id, { x: s.x, y: s.y, w: s.w, h: s.h, ellipse: s.kind === 'ellipse' });
    return all;
  };
  const tools = useFreeTools({ free, onFree, tool, onTool, onSelect, onEditing, scale: view.k, toPoint, items: itemsOf(free.shapes), author, readOnly });
  const items = itemsOf(tools.live);

  // The wheel and a pinch zoom the drawing only. React's own wheel handler is passive and cannot stop the page from zooming, so this is a plain listener.
  const latest = useLatest({ zoomBy, originX, originY });
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect(); const { zoomBy: zoom, originX: ox, originY: oy } = latest.current;
      zoom(e.ctrlKey ? Math.exp(-e.deltaY * 0.012) : e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left - ox, e.clientY - r.top - oy);
    };
    const noGesture = (e: Event) => e.preventDefault(); // Safari's own pinch of the page
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('gesturestart', noGesture); el.addEventListener('gesturechange', noGesture);
    return () => { el.removeEventListener('wheel', wheel); el.removeEventListener('gesturestart', noGesture); el.removeEventListener('gesturechange', noGesture); };
  }, [latest]);

  /** Adds an idea and opens it for typing; from a press of the pointer the box opens a moment later, because the browser moves focus during the press itself. */
  function addUnder(make: (list: MindNode[], id: string) => MindNode[], fromPointer = false) {
    const id = uid(); const next = make(nodes, id);
    if (next.length === nodes.length) return;
    onChange(next); onSelect(id);
    if (fromPointer) window.setTimeout(() => onEditing(id), 0); else onEditing(id);
  }
  const shape = free.shapes.find(s => s.id === selected);
  /** Keys for a shape, a line or a comment: delete it, write in it, nudge a shape with the arrows (a step of 10, or 1 with Shift). */
  function freeKey(e: KeyboardEvent, id: string) {
    const arrow = ARROWS[e.key as keyof typeof ARROWS];
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onFree(removeItem(free, id)); onSelect(null); }
    else if ((e.key === 'F2' || e.key === 'Enter') && shape) { e.preventDefault(); onEditing(id); }
    else if (arrow && shape) { e.preventDefault(); const step = e.shiftKey ? 1 : 10; onFree(moveShape(free, id, arrow === 'left' ? -step : arrow === 'right' ? step : 0, arrow === 'up' ? -step : arrow === 'down' ? step : 0)); }
  }
  function key(e: KeyboardEvent) {
    const arrow = ARROWS[e.key as keyof typeof ARROWS];
    if (e.key === 'Escape' && (tool !== 'select' || tools.linkFrom || tools.composer)) { tools.cancel(); return; }
    if (editing || (readOnly && !arrow)) return;
    const ctrl = e.ctrlKey || e.metaKey; const lower = e.key.toLowerCase();
    if (ctrl && (lower === 'z' || lower === 'y')) { e.preventDefault(); (lower === 'y' || e.shiftKey ? onRedo : onUndo)(); return; }
    const id = selected;
    if (!id) return;
    if (ctrl && STYLE_KEYS[lower]) { e.preventDefault(); onStyle(STYLE_KEYS[lower]); return; }
    if (!byId.has(id)) { freeKey(e, id); return; }
    if (arrow) { e.preventDefault(); const next = neighbourOf(nodes, boxes, id, arrow); if (next) onSelect(next); return; }
    if (e.key === 'Tab') { e.preventDefault(); addUnder((list, n) => addChild(list, id, n)); }
    else if (e.key === 'Enter') { e.preventDefault(); addUnder((list, n) => addSibling(list, id, n)); }
    else if (e.key === 'F2') { e.preventDefault(); onEditing(id); }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const parent = byId.get(id)?.parentId ?? null;
      if (parent === null) return; // the central idea stays
      onChange(removeNode(nodes, id)); onSelect(parent);
    } else if (e.key === ' ') { e.preventDefault(); onChange(updateNode(nodes, id, { collapsed: !byId.get(id)?.collapsed })); }
  }

  /** Moves an idea, and with it its branch, wherever the pointer takes it. With Shift held when it is let go over another idea, the branch goes under that idea instead. */
  function startDrag(e: PointerEvent, id: string) {
    e.stopPropagation();
    if (tools.onItem(id, e.clientX, e.clientY)) return;
    onSelect(id);
    if (readOnly || editing) return;
    const origin = { x: e.clientX, y: e.clientY };
    const blocked = new Set(subtreeIds(nodes, id));
    let moved = false; let last: NonNullable<typeof dragIdea> | null = null;
    const over = (m: globalThis.PointerEvent) => { for (const el of document.elementsFromPoint(m.clientX, m.clientY)) { const t = (el.closest('[data-node-id]') as HTMLElement | null)?.dataset.nodeId; if (t && !blocked.has(t)) return t; } return null; };
    const move = (m: globalThis.PointerEvent) => {
      if (!moved && Math.hypot(m.clientX - origin.x, m.clientY - origin.y) < 5) return;
      moved = true;
      const r = wrap.current?.getBoundingClientRect();
      last = { id, x: m.clientX - (r?.left ?? 0), y: m.clientY - (r?.top ?? 0), dx: (m.clientX - origin.x) / view.k, dy: (m.clientY - origin.y) / view.k, over: m.shiftKey ? over(m) : null, shift: m.shiftKey };
      setDragIdea(last);
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      setDragIdea(null);
      if (!moved || !last) return;
      if (last.over && byId.get(id)?.parentId !== null) onChange(moveNode(nodes, id, last.over));
      else onChange(moveIdea(nodes, id, last.dx, last.dy));
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  /** Changes the width of an idea from the handle at its corner. */
  function startIdeaResize(e: PointerEvent, id: string) {
    e.stopPropagation();
    if (readOnly) return;
    const start = { x: e.clientX, w: boxes.get(id)?.w ?? 100 };
    let width = start.w; let moved = false;
    const move = (m: globalThis.PointerEvent) => { moved = true; width = start.w + (m.clientX - start.x) / view.k * (boxes.get(id)?.side === 'left' ? -1 : 1); setSizing({ id, w: width }); };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      setSizing(null);
      if (moved) onChange(resizeIdea(nodes, id, width));
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  function finishEdit(id: string, text: string | null, byKey = false) {
    if (!byKey && settled.current) { settled.current = false; return; }
    settled.current = byKey;
    onEditing(null);
    const clean = text?.trim();
    if (clean && byId.has(id) && clean !== byId.get(id)?.text) onChange(updateNode(nodes, id, { text: clean.slice(0, 200) }));
    else if (text !== null && !byId.has(id)) onFree(updateShape(free, id, { text: text.trim() ? text : ' ' }));
    wrap.current?.focus();
  }
  const folded = (id: string) => (byId.get(id)?.collapsed ? subtreeIds(nodes, id).size - 1 : childrenOf(nodes, id).length);
  const shapeDown = (e: PointerEvent, id: string) => { e.stopPropagation(); if (tools.onItem(id, e.clientX, e.clientY)) return; onSelect(id); tools.startMove(e, id); };
  const bounds = mergeBounds(boundsOf(boxes), freeBounds(free.shapes));
  const hint = tools.drawing ? 'Now click the item or the spot where the line should end. Esc stops.' : tool === 'line' || tool === 'arrow' ? 'Click the item or the spot where the line should start. Esc stops.' : HINTS[tool];

  return (
    <div ref={wrap} tabIndex={0} onKeyDown={key} aria-label="Storyboard" role="application" className={`relative flex-1 min-h-0 bg-lira-bg overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-lira-blue ${tool === 'select' ? '' : 'cursor-crosshair'}`}>
      <svg className="w-full h-full touch-none select-none" onPointerDown={e => { if (e.target === e.currentTarget && tools.onBackground(e.clientX, e.clientY)) return; if (startPan(e)) onSelect(null); }}>
        <g transform={`translate(${originX + view.x} ${originY + view.y}) scale(${view.k})`}>
          {shown.map(n => {
            const b = boxes.get(n.id); const p = n.parentId === null ? undefined : boxes.get(n.parentId);
            return b && p ? <path key={`l-${n.id}`} d={connector(p, b)} fill="none" strokeLinecap="round" strokeWidth={strokeOf(b.depth)} stroke={colorOf(nodes, n.id)} className={colorOf(nodes, n.id) ? undefined : 'stroke-lira-border'} /> : null;
          })}
          <MindShapeLayer shapes={tools.live} links={tools.liveLinks} items={items} selected={selected} editing={editing} linkFrom={tools.linkFrom} onShapeDown={shapeDown}
            onLinkDown={(e, id) => { e.stopPropagation(); onSelect(id); }} onResizeDown={tools.startResize} onLinkHandle={tools.startLinkHandle} onStraighten={id => onFree(updateLink(free, id, { bend: undefined }))}
            onEdit={id => { if (!readOnly) onEditing(id); }} onFinishEdit={finishEdit} />
          {shown.map(n => {
            const b = boxes.get(n.id);
            return b && <MindNodeView key={n.id} node={n} box={b} color={colorOf(nodes, n.id)} selected={selected === n.id} over={dragIdea?.over === n.id || tools.linkFrom === n.id} found={found.has(n.id)} editing={editing === n.id} kids={folded(n.id)} readOnly={readOnly}
              onPointerDown={startDrag} onEdit={onEditing} onFinishEdit={finishEdit} onToggleFold={id => onChange(updateNode(nodes, id, { collapsed: !byId.get(id)?.collapsed }))}
              onAdd={id => { onSelect(id); addUnder((list, n2) => addChild(list, id, n2), true); }} onResizeDown={startIdeaResize} />;
          })}
          <CommentPins comments={free.comments} items={items} selected={selected} onPin={(e, id) => { e.stopPropagation(); onSelect(id); }} />
        </g>
      </svg>
      {hint && <p role="status" className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 text-xs rounded-full px-3 py-1.5 bg-white border border-lira-border text-lira-text">{hint}</p>}
      <CommentOverlay comments={free.comments} selected={selected} composer={tools.composer} items={items} toScreen={toScreen} onSubmit={tools.submitComment} onCancel={tools.cancel}
        onEdit={(id, text) => onFree(editComment(free, id, text, currentTime().toISOString()))} onResolve={id => onFree(toggleResolved(free, id))} onDelete={id => { onFree(removeItem(free, id)); onSelect(null); }} onClose={() => onSelect(null)} />
      <MindControls zoom={view.k} canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} onZoom={f => zoomBy(f)} onFit={() => fit(bounds, size)} />
      {dragIdea?.shift && <span className="pointer-events-none absolute text-xs rounded-lg px-2 py-1 bg-white border border-lira-border text-lira-text" style={{ left: dragIdea.x + 12, top: dragIdea.y + 12 }}>{dragIdea.over ? `Put under ${byId.get(dragIdea.over)?.text}` : 'Drop onto an idea to put this branch under it'}</span>}
    </div>
  );
}
