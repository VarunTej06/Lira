import type { PointerEvent } from 'react';
import type { Placed } from '../../utils/mindLayout';
import { fitText, type MindNode } from '../../utils/mindmap';

/** The central idea is drawn larger, so it is cut by letters for its own width. */
const rootFit = (text: string, w: number): string => (text.length * 9 + 32 > w ? `${text.slice(0, Math.max(1, Math.floor((w - 40) / 9)))}...` : text);

interface Props {
  node: MindNode;
  box: Placed;
  /** The colour of the branch this idea is on; none for the central idea. */
  color: string | undefined;
  selected: boolean;
  /** Another idea is being dragged over this one. */
  over: boolean;
  found: boolean;
  editing: boolean;
  /** How many ideas sit under it, and whether they are folded away. */
  kids: number;
  readOnly: boolean;
  onPointerDown: (e: PointerEvent, id: string) => void;
  onEdit: (id: string) => void;
  onFinishEdit: (id: string, text: string | null, byKey?: boolean) => void;
  onToggleFold: (id: string) => void;
  /** Adds an idea under this one, from the small plus at its end. */
  onAdd: (id: string) => void;
  /** Starts changing its width, from the small handle at its corner. */
  onResizeDown: (e: PointerEvent, id: string) => void;
}


/**
 * One idea. The central idea is a card in the middle; the others are plain text sitting at the end of their branch line, so the map reads
 * like a tree. A box appears around the one that is selected, found by a search, or being dropped on.
 */
export function MindNodeView({ node, box, color, selected, over, found, editing, kids, readOnly, onPointerDown, onEdit, onFinishEdit, onToggleFold, onAdd, onResizeDown }: Props) {
  const root = box.side === 'root';
  const right = box.side !== 'left';
  const anchor = root ? 'middle' : right ? 'start' : 'end';
  const tx = root ? box.w / 2 : right ? 8 : box.w - 8;
  const stroke = selected || found ? 'stroke-lira-blue' : over ? 'stroke-lira-text' : root ? 'stroke-lira-border' : 'stroke-transparent';
  const width = selected || over ? 2.5 : found ? 2 : root ? 1.5 : 0;
  return (
    <g data-node-id={node.id} transform={`translate(${box.x} ${box.y})`} onPointerDown={e => onPointerDown(e, node.id)} onDoubleClick={() => { if (!readOnly) onEdit(node.id); }} className="cursor-pointer">
      <rect width={box.w} height={box.h} rx={root ? 14 : 8} strokeWidth={width} strokeDasharray={found && !selected ? '4 3' : undefined} className={`${root ? 'fill-lira-surface' : 'fill-transparent'} ${stroke}`} />
      {editing
        ? <foreignObject x={6} y={3} width={box.w - 12} height={box.h - 6}><input autoFocus defaultValue={node.text} aria-label="Idea text" className={`w-full h-full bg-transparent text-sm text-lira-text outline-none ${root ? 'text-center' : right ? '' : 'text-right'}`} onFocus={e => e.currentTarget.select()}
            onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') onFinishEdit(node.id, e.currentTarget.value, true); if (e.key === 'Escape') onFinishEdit(node.id, null, true); }} onBlur={e => onFinishEdit(node.id, e.currentTarget.value)} /></foreignObject>
        : <text x={tx} y={box.h / 2 + 5} textAnchor={anchor} fontWeight={node.bold ? 700 : undefined} fontStyle={node.italic ? 'italic' : undefined} textDecoration={node.underline ? 'underline' : undefined} className={`${root ? 'text-base font-semibold' : box.depth === 1 ? 'text-sm font-semibold' : 'text-sm'} fill-lira-text`}>{root ? rootFit(node.text, box.w) : fitText(node.text, box.w)}</text>}
      {color && !root && <circle cx={right ? -4 : box.w + 4} cy={box.h / 2} r={3.5} fill={color} />}
      {node.ticketKey && <text x={right ? 8 : box.w - 8} y={-4} textAnchor={anchor} className="text-3xs fill-lira-muted">{node.ticketKey}</text>}
      {node.note && <circle cx={right ? box.w - 4 : 4} cy={4} r={3} className="fill-lira-blue"><title>Has a note</title></circle>}
      {selected && !readOnly && !editing && <rect data-idea-resize={node.id} x={box.w - 5} y={box.h - 5} width={10} height={10} rx={3} className="fill-lira-blue stroke-lira-surface cursor-ew-resize" strokeWidth={1.5} onPointerDown={e => onResizeDown(e, node.id)}><title>Drag to change the width</title></rect>}
      {selected && !readOnly && !editing && (
        <g onPointerDown={e => { e.stopPropagation(); onAdd(node.id); }} role="button" aria-label="Add an idea under this one" className="cursor-pointer">
          <title>Add an idea under this one</title>
          <circle cx={right ? box.w + (kids > 0 && !root ? 36 : 14) : -(kids > 0 && !root ? 36 : 14)} cy={box.h / 2} r={9} className="fill-lira-blue" />
          <text x={right ? box.w + (kids > 0 && !root ? 36 : 14) : -(kids > 0 && !root ? 36 : 14)} y={box.h / 2 + 5} textAnchor="middle" className="text-sm fill-lira-on-blue font-semibold">+</text>
        </g>
      )}
      {kids > 0 && !root && (
        <g onPointerDown={e => { e.stopPropagation(); if (!readOnly) onToggleFold(node.id); }} role="button" aria-label={node.collapsed ? 'Unfold' : 'Fold'}>
          <circle cx={right ? box.w + 12 : -12} cy={box.h / 2} r={8} className="fill-lira-surface stroke-lira-border" />
          <text x={right ? box.w + 12 : -12} y={box.h / 2 + 4} textAnchor="middle" className="text-2xs fill-lira-text">{node.collapsed ? kids : '-'}</text>
        </g>
      )}
    </g>
  );
}
