import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useElementSize } from '../../hooks/useElementSize';
import { useLatest } from '../../hooks/useLatest';
import { currentTime } from '../../utils/clock';
import { editComment, freeBounds, mergeBounds, moveShape, removeItem, toggleResolved, updateShape, type FreeDoc, type Item } from '../../utils/mindFree';
import { boundsOf, colorOf, connector, layoutMap, neighbourOf, strokeOf } from '../../utils/mindLayout';
import { addChild, addSibling, childrenOf, moveNode, removeNode, searchNodes, subtreeIds, updateNode, visibleNodes, type MindNode } from '../../utils/mindmap';
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
  const [dragIdea, setDragIdea] = useState<{ id: string; x: number; y: number; over: string | null } | null>(null);
  const settled = useRef(false); // the edit was already finished by Enter or Escape, so the box losing focus must not finish it again
  const originX = size.w / 2 + LEFT_INSET / 2;
  const originY = size.h / 2;
  const boxes = layoutMap(nodes);
  const shown = visibleNodes(nodes);
  const found = searchNodes(nodes, query);
  const byId = new Map(nodes.map(n => [n.id, n]));
  const toPoint = (cx: number, cy: number) => { const r = wrap.current?.getBoundingClientRect(); return { x: (cx - (r?.left ?? 0) - originX - view.x) / view.k, y: (cy - (r?.top ?? 0) - originY - view.y) / view.k }; };
  const toScreen = (p: { x: number; y: number }) => ({ x: originX + view.x + p.x * view.k, y: originY + view.y + p.y * view.k });
  const known = new Set([...nodes.map(n => n.id), ...free.shapes.map(s => s.id)]);
  const tools = useFreeTools({ free, onFree, tool, onTool, onSelect, onEditing, scale: view.k, toPoint, known, author, readOnly });
  const items = new Map<string, Item>([...boxes].map(([id, b]) => [id, b] as [string, Item]));
  for (const s of tools.live) items.set(s.id, { x: s.x, y: s.y, w: s.w, h: s.h, ellipse: s.kind === 'ellipse' });

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

  function startDrag(e: PointerEvent, id: string) {
    e.stopPropagation();
    if (tools.onItem(id, e.clientX, e.clientY)) return;
    onSelect(id);
    if (readOnly || byId.get(id)?.parentId === null || editing) return;
    const origin = { x: e.clientX, y: e.clientY };
    let moved = false; let target: string | null = null;
    const move = (m: globalThis.PointerEvent) => {
      if (!moved && Math.hypot(m.clientX - origin.x, m.clientY - origin.y) < 5) return;
      moved = true;
      target = (document.elementFromPoint(m.clientX, m.clientY)?.closest('[data-node-id]') as HTMLElement | null)?.dataset.nodeId ?? null;
      const r = wrap.current?.getBoundingClientRect();
      setDragIdea({ id, x: m.clientX - (r?.left ?? 0), y: m.clientY - (r?.top ?? 0), over: target });
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (moved && target && target !== id) onChange(moveNode(nodes, id, target));
      setDragIdea(null);
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
  const hint = tools.linkFrom ? 'Now click the item the line should end at. Esc stops.' : tool === 'line' || tool === 'arrow' ? 'Click the item the line should start at. Esc stops.' : HINTS[tool];

  return (
    <div ref={wrap} tabIndex={0} onKeyDown={key} aria-label="Storyboard" role="application" className={`relative flex-1 min-h-0 bg-lira-bg overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-lira-blue ${tool === 'select' ? '' : 'cursor-crosshair'}`}>
      <svg className="w-full h-full touch-none select-none" onPointerDown={e => { if (e.target === e.currentTarget && tools.onBackground(e.clientX, e.clientY)) return; if (startPan(e)) onSelect(null); }}>
        <g transform={`translate(${originX + view.x} ${originY + view.y}) scale(${view.k})`}>
          {shown.map(n => {
            const b = boxes.get(n.id); const p = n.parentId === null ? undefined : boxes.get(n.parentId);
            return b && p ? <path key={`l-${n.id}`} d={connector(p, b)} fill="none" strokeLinecap="round" strokeWidth={strokeOf(b.depth)} stroke={colorOf(nodes, n.id)} className={colorOf(nodes, n.id) ? undefined : 'stroke-lira-border'} /> : null;
          })}
          <MindShapeLayer shapes={tools.live} links={free.links} items={items} selected={selected} editing={editing} linkFrom={tools.linkFrom} onShapeDown={shapeDown}
            onLinkDown={(e, id) => { e.stopPropagation(); onSelect(id); }} onResizeDown={(e, id) => tools.startResize(e, id)} onEdit={id => { if (!readOnly) onEditing(id); }} onFinishEdit={finishEdit} />
          {shown.map(n => {
            const b = boxes.get(n.id);
            return b && <MindNodeView key={n.id} node={n} box={b} color={colorOf(nodes, n.id)} selected={selected === n.id} over={dragIdea?.over === n.id || tools.linkFrom === n.id} found={found.has(n.id)} editing={editing === n.id} kids={folded(n.id)} readOnly={readOnly}
              onPointerDown={startDrag} onEdit={onEditing} onFinishEdit={finishEdit} onToggleFold={id => onChange(updateNode(nodes, id, { collapsed: !byId.get(id)?.collapsed }))}
              onAdd={id => { onSelect(id); addUnder((list, n2) => addChild(list, id, n2), true); }} />;
          })}
          <CommentPins comments={free.comments} items={items} selected={selected} onPin={(e, id) => { e.stopPropagation(); onSelect(id); }} />
        </g>
      </svg>
      {hint && <p role="status" className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 text-xs rounded-full px-3 py-1.5 bg-white border border-lira-border text-lira-text">{hint}</p>}
      <CommentOverlay comments={free.comments} selected={selected} composer={tools.composer} items={items} toScreen={toScreen} onSubmit={tools.submitComment} onCancel={tools.cancel}
        onEdit={(id, text) => onFree(editComment(free, id, text, currentTime().toISOString()))} onResolve={id => onFree(toggleResolved(free, id))} onDelete={id => { onFree(removeItem(free, id)); onSelect(null); }} onClose={() => onSelect(null)} />
      <MindControls zoom={view.k} canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} onZoom={f => zoomBy(f)} onFit={() => fit(bounds, size)} />
      {dragIdea && <span className="pointer-events-none absolute text-xs rounded-lg px-2 py-1 bg-white border border-lira-border text-lira-text" style={{ left: dragIdea.x + 12, top: dragIdea.y + 12 }}>{byId.get(dragIdea.id)?.text}</span>}
    </div>
  );
}
