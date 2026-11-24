import { boundsOf, colorOf, connector, layoutMap, strokeOf } from '../../utils/mindLayout';
import { visibleNodes, type MindNode } from '../../utils/mindmap';

const PAD = 24;

/** A small picture of a map for its card: the branches in their colours and a dot where each idea is, with no text, so it stays light. */
export function MindThumb({ nodes }: { nodes: readonly MindNode[] }) {
  const boxes = layoutMap(nodes);
  const b = boundsOf(boxes);
  if (boxes.size === 0) return <div className="h-full" />;
  return (
    <svg aria-hidden="true" viewBox={`${b.x - PAD} ${b.y - PAD} ${b.w + PAD * 2} ${b.h + PAD * 2}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
      {visibleNodes(nodes).map(n => {
        const box = boxes.get(n.id); const parent = n.parentId === null ? undefined : boxes.get(n.parentId);
        return box && parent ? <path key={n.id} d={connector(parent, box)} fill="none" strokeLinecap="round" strokeWidth={strokeOf(box.depth) * 1.6} stroke={colorOf(nodes, n.id)} /> : null;
      })}
      {[...boxes.entries()].map(([id, box]) => box.side === 'root'
        ? <rect key={id} x={box.x} y={box.y} width={box.w} height={box.h} rx={14} className="fill-lira-surface stroke-lira-border" strokeWidth={2} />
        : <circle key={id} cx={box.side === 'right' ? box.x + box.w : box.x} cy={box.y + box.h / 2} r={5} fill={colorOf(nodes, id)} />)}
    </svg>
  );
}
