import { freeBounds, mergeBounds, type Shape } from '../../utils/mindFree';
import { boundsOf, colorOf, connector, layoutMap, strokeOf } from '../../utils/mindLayout';
import { visibleNodes, type MindNode } from '../../utils/mindmap';

const PAD = 24;

/** A small picture of a map for its card: the branches in their colours and a dot where each idea is, with no text, so it stays light. */
export function MindThumb({ nodes, shapes = [] }: { nodes: readonly MindNode[]; shapes?: readonly Shape[] }) {
  const boxes = layoutMap(nodes);
  const b = mergeBounds(boundsOf(boxes), freeBounds([...shapes]));
  if (boxes.size === 0) return <div className="h-full" />;
  return (
    <svg aria-hidden="true" viewBox={`${b.x - PAD} ${b.y - PAD} ${b.w + PAD * 2} ${b.h + PAD * 2}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
      {visibleNodes(nodes).map(n => {
        const box = boxes.get(n.id); const parent = n.parentId === null ? undefined : boxes.get(n.parentId);
        return box && parent ? <path key={n.id} d={connector(parent, box)} fill="none" strokeLinecap="round" strokeWidth={strokeOf(box.depth) * 1.6} stroke={colorOf(nodes, n.id)} /> : null;
      })}
      {shapes.map(s => <rect key={s.id} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.kind === 'ellipse' ? s.h / 2 : 8} fill={s.color} fillOpacity={s.color ? 0.35 : 0} stroke={s.color} strokeWidth={3} className={s.color ? undefined : 'stroke-lira-border'} />)}
      {[...boxes.entries()].map(([id, box]) => box.side === 'root'
        ? <rect key={id} x={box.x} y={box.y} width={box.w} height={box.h} rx={14} className="fill-lira-surface stroke-lira-border" strokeWidth={2} />
        : <circle key={id} cx={box.side === 'right' ? box.x + box.w : box.x} cy={box.y + box.h / 2} r={5} fill={colorOf(nodes, id)} />)}
    </svg>
  );
}
