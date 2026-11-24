import { useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { addChild, addSibling, layout, moveNode, neighbour, NODE_H, removeNode, searchNodes, updateNode, visibleNodes, type MindNode } from '../../utils/mindmap';

interface Props {
  nodes: MindNode[];
  onChange: (next: MindNode[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  selected: string | null;
  onSelect: (id: string | null) => void;
  query: string;
  readOnly?: boolean;
}

interface View { x: number; y: number; k: number }
const MIN_K = 0.3;
const MAX_K = 2.5;
const uid = (): string => crypto.randomUUID();

/**
 * The drawing of a mind map: ideas as boxes joined by curves, panned by dragging the background, zoomed with the wheel, an idea
 * dragged onto another to move its branch there. Keys: Tab adds an idea under the selected one, Enter next to it, F2 or a double click
 * edits it, Delete removes it with its branch, Space folds it, arrows move about, Ctrl+Z and Ctrl+Y undo and redo.
 */
export function MindMapCanvas({ nodes, onChange, onUndo, onRedo, selected, onSelect, query, readOnly = false }: Props) {
  const [view, setView] = useState<View>({ x: 40, y: 40, k: 1 });
  const [editing, setEditing] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const settled = useRef(false); // the edit was already finished by Enter or Escape, so the box losing focus must not finish it again
  const boxes = layout(nodes);
  const shown = visibleNodes(nodes);
  const found = searchNodes(nodes, query);
  const by = new Map(nodes.map(n => [n.id, n]));

  const fit = () => {
    const all = [...boxes.values()];
    const el = wrap.current;
    if (!el || all.length === 0) return;
    const w = Math.max(...all.map(b => b.x + b.w)) + 80; const h = Math.max(...all.map(b => b.y + b.h)) + 80;
    const k = Math.min(MAX_K, Math.max(MIN_K, Math.min(el.clientWidth / w, el.clientHeight / h)));
    setView({ k, x: 40 * k, y: Math.max(20, (el.clientHeight - h * k) / 2 + 40 * k) });
  };
  const zoom = (factor: number, cx?: number, cy?: number) => setView(v => {
    const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
    const px = cx ?? (wrap.current?.clientWidth ?? 0) / 2; const py = cy ?? (wrap.current?.clientHeight ?? 0) / 2;
    return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k };
  });

  function key(e: KeyboardEvent) {
    if (editing || readOnly && !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const id = selected;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? onRedo : onUndo)(); return; }
    if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); onRedo(); return; }
    if (!id) return;
    const arrows = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' } as const;
    if (e.key in arrows) { e.preventDefault(); const next = neighbour(nodes, id, arrows[e.key as keyof typeof arrows]); if (next) onSelect(next); return; }
    if (e.key === 'Tab') { e.preventDefault(); const n = uid(); onChange(addChild(nodes, id, n)); onSelect(n); setEditing(n); }
    else if (e.key === 'Enter') { e.preventDefault(); const n = uid(); const next = addSibling(nodes, id, n); if (next.length > nodes.length) { onChange(next); onSelect(n); setEditing(n); } }
    else if (e.key === 'F2') { e.preventDefault(); setEditing(id); }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const parent = by.get(id)?.parentId ?? null;
      if (parent === null) return; // the central idea stays
      onChange(removeNode(nodes, id)); onSelect(parent);
    }
    else if (e.key === ' ') { e.preventDefault(); onChange(updateNode(nodes, id, { collapsed: !by.get(id)?.collapsed })); }
  }

  function wheel(e: WheelEvent) {
    const r = wrap.current!.getBoundingClientRect();
    zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top);
  }

  function startPan(e: PointerEvent<SVGSVGElement>) {
    if (e.target !== e.currentTarget) return;
    onSelect(null);
    const from = { x: e.clientX - view.x, y: e.clientY - view.y };
    const move = (m: globalThis.PointerEvent) => setView(v => ({ ...v, x: m.clientX - from.x, y: m.clientY - from.y }));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  function startDrag(e: PointerEvent, id: string) {
    e.stopPropagation();
    onSelect(id);
    if (readOnly || by.get(id)?.parentId === null || editing) return;
    const origin = { x: e.clientX, y: e.clientY };
    let moved = false; let target: string | null = null;
    const move = (m: globalThis.PointerEvent) => {
      if (!moved && Math.hypot(m.clientX - origin.x, m.clientY - origin.y) < 5) return;
      moved = true;
      target = (document.elementFromPoint(m.clientX, m.clientY)?.closest('[data-node-id]') as HTMLElement | null)?.dataset.nodeId ?? null;
      setOver(target); setDrag({ id, x: m.clientX - (wrap.current?.getBoundingClientRect().left ?? 0), y: m.clientY - (wrap.current?.getBoundingClientRect().top ?? 0), moved });
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
    setEditing(null);
    const clean = text?.trim();
    if (clean && clean !== by.get(id)?.text) onChange(updateNode(nodes, id, { text: clean.slice(0, 200) }));
    wrap.current?.focus();
  }

  return (
    <div ref={wrap} tabIndex={0} onKeyDown={key} aria-label="Mind map" role="application" className="relative flex-1 min-h-0 bg-lira-bg border border-lira-border rounded-lg overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-lira-blue">
      <svg className="w-full h-full touch-none select-none" onPointerDown={startPan} onWheel={wheel}>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {shown.map(n => {
            const b = boxes.get(n.id); const p = n.parentId === null ? undefined : boxes.get(n.parentId);
            if (!b || !p) return null;
            const x1 = p.x + p.w; const y1 = p.y + NODE_H / 2; const x2 = b.x; const y2 = b.y + NODE_H / 2; const mid = (x1 + x2) / 2;
            return <path key={`l-${n.id}`} d={`M${x1} ${y1}C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`} className="fill-none stroke-lira-border" strokeWidth={2} />;
          })}
          {shown.map(n => {
            const b = boxes.get(n.id);
            if (!b) return null;
            const isRoot = n.parentId === null; const isSel = selected === n.id;
            const hasKids = nodes.some(c => c.parentId === n.id);
            return (
              <g key={n.id} data-node-id={n.id} transform={`translate(${b.x} ${b.y})`} onPointerDown={e => startDrag(e, n.id)} onDoubleClick={() => { if (!readOnly) setEditing(n.id); }} className="cursor-pointer">
                <rect width={b.w} height={b.h} rx={6} className={`${isRoot ? 'fill-lira-blue' : 'fill-lira-surface'} ${isSel ? 'stroke-lira-blue' : over === n.id ? 'stroke-lira-text' : 'stroke-lira-border'}`} strokeWidth={isSel || over === n.id ? 3 : 1.5} />
                {n.color && <rect width={6} height={b.h} rx={3} fill={n.color} />}
                {found.has(n.id) && <rect x={-4} y={-4} width={b.w + 8} height={b.h + 8} rx={9} className="fill-none stroke-lira-blue" strokeDasharray="4 3" strokeWidth={2} />}
                {editing === n.id
                  ? <foreignObject x={8} y={4} width={b.w - 16} height={b.h - 8}><input autoFocus defaultValue={n.text} aria-label="Idea text" className="w-full h-full bg-transparent text-xs text-lira-text outline-none" onFocus={e => e.currentTarget.select()}
                      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') finishEdit(n.id, e.currentTarget.value, true); if (e.key === 'Escape') finishEdit(n.id, null, true); }} onBlur={e => finishEdit(n.id, e.currentTarget.value)} /></foreignObject>
                  : <text x={n.color ? 16 : 12} y={b.h / 2 + 4} className={`text-xs ${isRoot ? 'fill-lira-on-blue font-bold' : 'fill-lira-text'}`}>{n.text.length * 7 + 32 > b.w ? `${n.text.slice(0, Math.floor((b.w - 40) / 7))}…` : n.text}</text>}
                {n.ticketKey && <text x={b.w - 8} y={-5} textAnchor="end" className="text-3xs fill-lira-muted">{n.ticketKey}</text>}
                {n.note && <circle cx={b.w - 6} cy={6} r={3} className="fill-lira-blue" aria-label="Has a note" />}
                {hasKids && <g onPointerDown={e => { e.stopPropagation(); if (!readOnly) onChange(updateNode(nodes, n.id, { collapsed: !n.collapsed })); }} role="button" aria-label={n.collapsed ? 'Unfold' : 'Fold'}>
                  <circle cx={b.w + 10} cy={b.h / 2} r={8} className="fill-lira-surface stroke-lira-border" /><text x={b.w + 10} y={b.h / 2 + 4} textAnchor="middle" className="text-xs fill-lira-text">{n.collapsed ? '+' : '–'}</text></g>}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button type="button" aria-label="Zoom in" onClick={() => zoom(1.2)} className="min-w-8 h-8 px-2 rounded border border-lira-border bg-lira-surface text-lira-text text-ui">+</button>
        <button type="button" aria-label="Zoom out" onClick={() => zoom(1 / 1.2)} className="min-w-8 h-8 px-2 rounded border border-lira-border bg-lira-surface text-lira-text text-ui">–</button>
        <button type="button" aria-label="Fit to screen" onClick={() => fit()} className="min-w-8 h-8 px-2 rounded border border-lira-border bg-lira-surface text-lira-text text-ui">Fit</button>
      </div>
      {drag?.moved && <span className="pointer-events-none absolute text-ui rounded px-2 py-1 bg-lira-surface border border-lira-border text-lira-text" style={{ left: drag.x + 12, top: drag.y + 12 }}>{by.get(drag.id)?.text}</span>}
    </div>
  );
}
