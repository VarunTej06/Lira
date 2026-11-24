import { useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { useElementSize } from '../../hooks/useElementSize';
import { boundsOf, colorOf, connector, layoutMap, neighbourOf, strokeOf } from '../../utils/mindLayout';
import { addChild, addSibling, childrenOf, moveNode, removeNode, searchNodes, subtreeIds, updateNode, visibleNodes, type MindNode } from '../../utils/mindmap';
import { MindControls } from './MindControls';
import { MindNodeView } from './MindNodeView';
import { LEFT_INSET, useMindView } from './useMindView';

interface Props {
  nodes: MindNode[];
  onChange: (next: MindNode[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** The idea whose text is being typed, if any, kept by the page so that its tools can start an edit too. */
  editing: string | null;
  onEditing: (id: string | null) => void;
  query: string;
  readOnly?: boolean;
}

const uid = (): string => crypto.randomUUID();
const ARROWS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' } as const;

/**
 * The drawing of a mind map: the central idea in the middle with branches either side, each branch in its own colour, panned by dragging
 * the background, zoomed with the wheel, an idea dragged onto another to move its branch there. Keys: Tab adds an idea under the selected
 * one, Enter next to it, F2 or a double click edits it, Delete removes it with its branch, Space folds it, arrows move about, Ctrl+Z and Ctrl+Y undo and redo.
 */
export function MindMapCanvas({ nodes, onChange, onUndo, onRedo, canUndo, canRedo, selected, onSelect, editing, onEditing, query, readOnly = false }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const size = useElementSize(wrap);
  const { view, startPan, zoomBy, fit } = useMindView();
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const settled = useRef(false); // the edit was already finished by Enter or Escape, so the box losing focus must not finish it again
  const originX = size.w / 2 + LEFT_INSET / 2;
  const boxes = layoutMap(nodes);
  const shown = visibleNodes(nodes);
  const found = searchNodes(nodes, query);
  const byId = new Map(nodes.map(n => [n.id, n]));

  function addUnder(make: (list: MindNode[], id: string) => MindNode[]) {
    const id = uid(); const next = make(nodes, id);
    if (next.length === nodes.length) return;
    onChange(next); onSelect(id); onEditing(id);
  }
  function key(e: KeyboardEvent) {
    const arrow = ARROWS[e.key as keyof typeof ARROWS];
    if (editing || (readOnly && !arrow)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) { e.preventDefault(); (e.key.toLowerCase() === 'y' || e.shiftKey ? onRedo : onUndo)(); return; }
    const id = selected;
    if (!id) return;
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

  function wheel(e: WheelEvent) {
    const r = wrap.current!.getBoundingClientRect();
    zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left - originX, e.clientY - r.top - size.h / 2);
  }

  function startDrag(e: PointerEvent, id: string) {
    e.stopPropagation();
    onSelect(id);
    if (readOnly || byId.get(id)?.parentId === null || editing) return;
    const origin = { x: e.clientX, y: e.clientY };
    let moved = false; let target: string | null = null;
    const move = (m: globalThis.PointerEvent) => {
      if (!moved && Math.hypot(m.clientX - origin.x, m.clientY - origin.y) < 5) return;
      moved = true;
      target = (document.elementFromPoint(m.clientX, m.clientY)?.closest('[data-node-id]') as HTMLElement | null)?.dataset.nodeId ?? null;
      const r = wrap.current?.getBoundingClientRect();
      setOver(target); setDrag({ id, x: m.clientX - (r?.left ?? 0), y: m.clientY - (r?.top ?? 0) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (moved && target && target !== id) onChange(moveNode(nodes, id, target));
      setDrag(null); setOver(null);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  function finishEdit(id: string, text: string | null, byKey = false) {
    if (!byKey && settled.current) { settled.current = false; return; }
    settled.current = byKey;
    onEditing(null);
    const clean = text?.trim();
    if (clean && clean !== byId.get(id)?.text) onChange(updateNode(nodes, id, { text: clean.slice(0, 200) }));
    wrap.current?.focus();
  }
  const folded = (id: string) => (byId.get(id)?.collapsed ? subtreeIds(nodes, id).size - 1 : childrenOf(nodes, id).length);

  return (
    <div ref={wrap} tabIndex={0} onKeyDown={key} aria-label="Mind map" role="application" className="relative flex-1 min-h-0 bg-lira-bg overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-lira-blue">
      <svg className="w-full h-full touch-none select-none" onPointerDown={e => { if (startPan(e)) onSelect(null); }} onWheel={wheel}>
        <g transform={`translate(${originX + view.x} ${size.h / 2 + view.y}) scale(${view.k})`}>
          {shown.map(n => {
            const b = boxes.get(n.id); const p = n.parentId === null ? undefined : boxes.get(n.parentId);
            return b && p ? <path key={`l-${n.id}`} d={connector(p, b)} fill="none" strokeLinecap="round" strokeWidth={strokeOf(b.depth)} stroke={colorOf(nodes, n.id)} className={colorOf(nodes, n.id) ? undefined : 'stroke-lira-border'} /> : null;
          })}
          {shown.map(n => {
            const b = boxes.get(n.id);
            return b && <MindNodeView key={n.id} node={n} box={b} color={colorOf(nodes, n.id)} selected={selected === n.id} over={over === n.id} found={found.has(n.id)} editing={editing === n.id} kids={folded(n.id)} readOnly={readOnly}
              onPointerDown={startDrag} onEdit={onEditing} onFinishEdit={finishEdit} onToggleFold={id => onChange(updateNode(nodes, id, { collapsed: !byId.get(id)?.collapsed }))} />;
          })}
        </g>
      </svg>
      <MindControls zoom={view.k} canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} onZoom={f => zoomBy(f)} onFit={() => fit(boundsOf(boxes), size)} />
      {drag && <span className="pointer-events-none absolute text-xs rounded-lg px-2 py-1 bg-white border border-lira-border text-lira-text" style={{ left: drag.x + 12, top: drag.y + 12 }}>{byId.get(drag.id)?.text}</span>}
    </div>
  );
}
