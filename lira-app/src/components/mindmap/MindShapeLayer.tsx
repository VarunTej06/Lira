import type { PointerEvent } from 'react';
import { MIND_COLORS } from '../../theme/palette';
import { arrowHead, FONT_PX, HANDLES, linkShape, wrapLines, type Handle, type Item, type Link, type Shape } from '../../utils/mindFree';
import type { LinkPart } from './useFreeTools';

const AMBER = MIND_COLORS[6];
const CURSORS: Record<string, string> = { '-1,-1': 'nwse-resize', '1,1': 'nwse-resize', '1,-1': 'nesw-resize', '-1,1': 'nesw-resize', '0,-1': 'ns-resize', '0,1': 'ns-resize', '-1,0': 'ew-resize', '1,0': 'ew-resize' };
const HANDLE = 10;

interface Props {
  shapes: readonly Shape[];
  links: readonly Link[];
  /** Every idea and shape by id, where it is now, for the ends of the lines. */
  items: ReadonlyMap<string, Item>;
  selected: string | null;
  editing: string | null;
  /** The first end of a line being drawn, if it is an item. */
  linkFrom: string | null;
  onShapeDown: (e: PointerEvent, id: string) => void;
  onLinkDown: (e: PointerEvent, id: string) => void;
  onResizeDown: (e: PointerEvent, id: string, handle: Handle) => void;
  onLinkHandle: (e: PointerEvent, id: string, part: LinkPart) => void;
  /** A double click on the middle handle of a line makes it straight again. */
  onStraighten: (id: string) => void;
  onEdit: (id: string) => void;
  onFinishEdit: (id: string, text: string | null, byKey?: boolean) => void;
}

/** One shape: its outline in the colour chosen (a box, an ellipse, a sticky note, or no outline for plain text), its words, and eight handles when it is selected. */
function ShapeView({ shape, selected, editing, linking, onDown, onResize, onEdit, onFinish }: { shape: Shape; selected: boolean; editing: boolean; linking: boolean; onDown: Props['onShapeDown']; onResize: Props['onResizeDown']; onEdit: Props['onEdit']; onFinish: Props['onFinishEdit'] }) {
  const px = FONT_PX[shape.size ?? 'medium'];
  const colour = shape.color ?? (shape.kind === 'note' ? AMBER : undefined);
  const lines = wrapLines(shape.text, shape.w - 16, px).slice(0, Math.max(1, Math.floor((shape.h - 8) / (px * 1.3))));
  const top = shape.h / 2 - (lines.length * px * 1.3) / 2 + px;
  const ring = selected ? 'stroke-lira-blue' : linking ? 'stroke-lira-text' : colour ? '' : shape.kind === 'text' ? 'stroke-transparent' : 'stroke-lira-border';
  const common = { fill: colour ?? 'transparent', fillOpacity: colour ? (shape.kind === 'note' ? 0.35 : 0.2) : 1, stroke: colour && !selected && !linking ? colour : undefined, strokeWidth: selected || linking ? 2.5 : 1.5, className: `${shape.kind === 'text' || colour ? '' : 'fill-lira-surface'} ${ring}` };
  return (
    <g data-shape-id={shape.id} transform={`translate(${shape.x} ${shape.y})`} onPointerDown={e => onDown(e, shape.id)} onDoubleClick={() => onEdit(shape.id)} className="cursor-move">
      {shape.kind === 'ellipse'
        ? <ellipse cx={shape.w / 2} cy={shape.h / 2} rx={shape.w / 2} ry={shape.h / 2} {...common} />
        : <rect width={shape.w} height={shape.h} rx={shape.kind === 'note' ? 4 : 10} {...common} strokeDasharray={shape.kind === 'text' && selected ? '4 3' : undefined} />}
      {editing
        ? <foreignObject x={6} y={4} width={shape.w - 12} height={shape.h - 8}>
            <textarea autoFocus defaultValue={shape.text} aria-label="Text of the shape" maxLength={500} className="w-full h-full resize-none bg-transparent text-center text-lira-text outline-none" onFocus={e => e.currentTarget.select()}
              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') onFinish(shape.id, null, true); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onFinish(shape.id, e.currentTarget.value, true); }} onBlur={e => onFinish(shape.id, e.currentTarget.value)} />
          </foreignObject>
        : (
          <text textAnchor="middle" fontSize={px} fontWeight={shape.bold ? 700 : undefined} fontStyle={shape.italic ? 'italic' : undefined} textDecoration={shape.underline ? 'underline' : undefined} className="fill-lira-text pointer-events-none">
            {lines.map((l, i) => <tspan key={i} x={shape.w / 2} y={top + i * px * 1.3}>{l}</tspan>)}
          </text>
        )}
      {selected && !editing && HANDLES.map(h => (
        <rect key={`${h.x},${h.y}`} data-resize={`${h.x},${h.y}`} x={((h.x + 1) * shape.w) / 2 - HANDLE / 2} y={((h.y + 1) * shape.h) / 2 - HANDLE / 2} width={HANDLE} height={HANDLE} rx={3}
          className="fill-lira-blue stroke-lira-surface" strokeWidth={1.5} style={{ cursor: CURSORS[`${h.x},${h.y}`] }} onPointerDown={e => onResize(e, shape.id, h)} />
      ))}
    </g>
  );
}

/** One line, straight or curved, with an arrowhead if it has one. A wider invisible line over it makes it easy to click. */
function LinkView({ link, items, selected, onDown }: { link: Link; items: ReadonlyMap<string, Item>; selected: boolean; onDown: Props['onLinkDown'] }) {
  const shape = linkShape(link, items);
  if (!shape) return null;
  const stroke = link.color ?? MIND_COLORS[7];
  return (
    <g data-link-id={link.id} onPointerDown={e => onDown(e, link.id)} className="cursor-pointer">
      <path d={shape.d} fill="none" stroke="transparent" strokeWidth={14} />
      <path d={shape.d} fill="none" stroke={stroke} strokeWidth={selected ? 3.5 : 2} strokeLinecap="round" strokeDasharray={link.dashed ? '6 4' : undefined} />
      {link.arrow && <polygon points={arrowHead(shape.tail, shape.b)} fill={stroke} />}
    </g>
  );
}

/** The handles of the selected line: one at each end and one in the middle. They are drawn over the shapes, because a line ends on the edge of a shape and would be hidden by it. */
function LinkHandles({ link, items, onHandle, onStraighten }: { link: Link; items: ReadonlyMap<string, Item>; onHandle: Props['onLinkHandle']; onStraighten: Props['onStraighten'] }) {
  const shape = linkShape(link, items);
  if (!shape) return null;
  const dot = (p: { x: number; y: number }, part: LinkPart, label: string, cursor: string) => (
    <circle key={part} data-link-handle={part} cx={p.x} cy={p.y} r={7} className="fill-lira-surface stroke-lira-blue" strokeWidth={2.5} style={{ cursor }} onPointerDown={e => onHandle(e, link.id, part)} onDoubleClick={() => { if (part === 'bend') onStraighten(link.id); }}><title>{label}</title></circle>
  );
  return <g>{[dot(shape.a, 'from', 'Drag to move the start of the line', 'move'), dot(shape.b, 'to', 'Drag to move the end of the line', 'move'), dot(shape.mid, 'bend', 'Drag to bend the line. Double click to make it straight', 'grab')]}</g>;
}

/** The free-form layer: lines and arrows first, shapes on top of them. */
export function MindShapeLayer({ shapes, links, items, selected, editing, linkFrom, onShapeDown, onLinkDown, onResizeDown, onLinkHandle, onStraighten, onEdit, onFinishEdit }: Props) {
  return (
    <g>
      {links.map(l => <LinkView key={l.id} link={l} items={items} selected={selected === l.id} onDown={onLinkDown} />)}
      {shapes.map(s => <ShapeView key={s.id} shape={s} selected={selected === s.id} editing={editing === s.id} linking={linkFrom === s.id} onDown={onShapeDown} onResize={onResizeDown} onEdit={onEdit} onFinish={onFinishEdit} />)}
      {links.filter(l => l.id === selected).map(l => <LinkHandles key={l.id} link={l} items={items} onHandle={onLinkHandle} onStraighten={onStraighten} />)}
    </g>
  );
}
