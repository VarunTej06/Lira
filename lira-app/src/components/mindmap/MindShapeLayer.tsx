import type { PointerEvent } from 'react';
import { MIND_COLORS } from '../../theme/palette';
import { arrowHead, FONT_PX, linkEnds, wrapLines, type Item, type Link, type Shape } from '../../utils/mindFree';

const AMBER = MIND_COLORS[6];

interface Props {
  shapes: readonly Shape[];
  links: readonly Link[];
  /** Every idea and shape by id, where it is now, for the ends of the lines. */
  items: ReadonlyMap<string, Item>;
  selected: string | null;
  editing: string | null;
  /** The first end of a line being drawn, if any. */
  linkFrom: string | null;
  onShapeDown: (e: PointerEvent, id: string) => void;
  onLinkDown: (e: PointerEvent, id: string) => void;
  onResizeDown: (e: PointerEvent, id: string) => void;
  onEdit: (id: string) => void;
  onFinishEdit: (id: string, text: string | null, byKey?: boolean) => void;
}

/** One shape: its outline in the colour chosen (a box, an ellipse, a sticky note, or no outline for plain text), its words, and handles when it is selected. */
function ShapeView({ shape, selected, editing, linking, onDown, onResize, onEdit, onFinish }: { shape: Shape; selected: boolean; editing: boolean; linking: boolean; onDown: Props['onShapeDown']; onResize: Props['onResizeDown']; onEdit: Props['onEdit']; onFinish: Props['onFinishEdit'] }) {
  const px = FONT_PX[shape.size ?? 'medium'];
  const colour = shape.color ?? (shape.kind === 'note' ? AMBER : undefined);
  const lines = wrapLines(shape.text, shape.w - 16, px).slice(0, Math.max(1, Math.floor((shape.h - 8) / (px * 1.3))));
  const top = shape.h / 2 - (lines.length * px * 1.3) / 2 + px;
  const ring = selected ? 'stroke-lira-blue' : linking ? 'stroke-lira-text' : colour ? '' : shape.kind === 'text' ? 'stroke-transparent' : 'stroke-lira-border';
  const common = { fill: colour ?? 'transparent', fillOpacity: colour ? (shape.kind === 'note' ? 0.35 : 0.2) : 1, stroke: colour && !selected && !linking ? colour : undefined, strokeWidth: selected || linking ? 2.5 : 1.5, className: `${shape.kind === 'text' || colour ? '' : 'fill-lira-surface'} ${ring}` };
  return (
    <g data-shape-id={shape.id} transform={`translate(${shape.x} ${shape.y})`} onPointerDown={e => onDown(e, shape.id)} onDoubleClick={() => onEdit(shape.id)} className="cursor-pointer">
      {shape.kind === 'ellipse'
        ? <ellipse cx={shape.w / 2} cy={shape.h / 2} rx={shape.w / 2} ry={shape.h / 2} {...common} />
        : <rect width={shape.w} height={shape.h} rx={shape.kind === 'note' ? 4 : 10} {...common} strokeDasharray={shape.kind === 'text' && selected ? '4 3' : undefined} />}
      {editing
        ? <foreignObject x={6} y={4} width={shape.w - 12} height={shape.h - 8}>
            <textarea autoFocus defaultValue={shape.text} aria-label="Text of the shape" maxLength={500} className="w-full h-full resize-none bg-transparent text-center text-lira-text outline-none" onFocus={e => e.currentTarget.select()}
              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') onFinish(shape.id, null, true); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onFinish(shape.id, e.currentTarget.value, true); }} onBlur={e => onFinish(shape.id, e.currentTarget.value)} />
          </foreignObject>
        : (
          <text textAnchor="middle" fontSize={px} fontWeight={shape.bold ? 700 : undefined} fontStyle={shape.italic ? 'italic' : undefined} textDecoration={shape.underline ? 'underline' : undefined} className="fill-lira-text">
            {lines.map((l, i) => <tspan key={i} x={shape.w / 2} y={top + i * px * 1.3}>{l}</tspan>)}
          </text>
        )}
      {selected && !editing && <rect data-resize={shape.id} x={shape.w - 6} y={shape.h - 6} width={12} height={12} rx={3} className="fill-lira-blue stroke-lira-surface cursor-nwse-resize" strokeWidth={1.5} onPointerDown={e => onResize(e, shape.id)} />}
    </g>
  );
}

/** The free-form layer: lines and arrows first, shapes on top of them. A line has a wider invisible line over it so it is easy to click. */
export function MindShapeLayer({ shapes, links, items, selected, editing, linkFrom, onShapeDown, onLinkDown, onResizeDown, onEdit, onFinishEdit }: Props) {
  return (
    <g>
      {links.map(l => {
        const ends = linkEnds(l, items);
        if (!ends) return null;
        const on = selected === l.id;
        const stroke = l.color ?? MIND_COLORS[7];
        return (
          <g key={l.id} data-link-id={l.id} onPointerDown={e => onLinkDown(e, l.id)} className="cursor-pointer">
            <line x1={ends.a.x} y1={ends.a.y} x2={ends.b.x} y2={ends.b.y} stroke="transparent" strokeWidth={14} />
            <line x1={ends.a.x} y1={ends.a.y} x2={ends.b.x} y2={ends.b.y} stroke={stroke} strokeWidth={on ? 3.5 : 2} strokeLinecap="round" strokeDasharray={l.dashed ? '6 4' : undefined} />
            {l.arrow && <polygon points={arrowHead(ends.a, ends.b)} fill={stroke} />}
          </g>
        );
      })}
      {shapes.map(s => <ShapeView key={s.id} shape={s} selected={selected === s.id} editing={editing === s.id} linking={linkFrom === s.id} onDown={onShapeDown} onResize={onResizeDown} onEdit={onEdit} onFinish={onFinishEdit} />)}
    </g>
  );
}
