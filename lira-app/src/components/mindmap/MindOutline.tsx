import { Link2, StickyNote } from 'lucide-react';
import { colorOf } from '../../utils/mindLayout';
import { childrenOf, rootOf, type MindNode } from '../../utils/mindmap';

interface Props { nodes: readonly MindNode[]; selected: string | null; query: ReadonlySet<string>; onSelect: (id: string) => void }

/** The same ideas as an indented list, for reading or finding one quickly. Folded branches stay folded. */
export function MindOutline({ nodes, selected, query, onSelect }: Props) {
  const root = rootOf(nodes);
  const rows: { node: MindNode; depth: number }[] = [];
  const walk = (n: MindNode, depth: number) => { rows.push({ node: n, depth }); if (!n.collapsed) for (const c of childrenOf(nodes, n.id)) walk(c, depth + 1); };
  if (root) walk(root, 0);
  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-6">
      <ul aria-label="Outline" className="max-w-3xl mx-auto bg-white border border-lira-border rounded-2xl py-2">
        {rows.map(({ node, depth }) => (
          <li key={node.id}>
            <button type="button" onClick={() => onSelect(node.id)} aria-current={selected === node.id} className={`w-full flex items-center gap-2 pr-3 py-1.5 text-left text-sm hover:bg-gray-50 cursor-pointer ${selected === node.id ? 'bg-lira-blue-light' : ''} ${query.has(node.id) ? 'font-semibold' : ''}`} >
              <span className="shrink-0" style={{ width: depth * 20 + 12 }} />
              <span className="w-2 h-2 rounded-full shrink-0 bg-lira-border" style={colorOf(nodes, node.id) ? { backgroundColor: colorOf(nodes, node.id) } : undefined} />
              <span className={`truncate ${depth === 0 ? 'font-semibold text-base' : depth === 1 ? 'font-medium' : ''} text-lira-text`}>{node.text}</span>
              {node.ticketKey && <span className="flex items-center gap-1 text-2xs text-lira-muted"><Link2 className="w-3 h-3" />{node.ticketKey}</span>}
              {node.note && <StickyNote className="w-3 h-3 text-lira-muted" aria-label="Has a note" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
