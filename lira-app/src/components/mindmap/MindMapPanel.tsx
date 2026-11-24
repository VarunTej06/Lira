import { MIND_COLORS } from '../../theme/palette';
import type { Issue } from '../../types/issue';
import type { MindNode } from '../../utils/mindmap';

/** What can be set on the selected idea: its colour, a note, and a ticket it stands for. */
export function MindMapPanel({ node, issues, onPatch, onRemove, readOnly }: { node: MindNode; issues: Issue[]; onPatch: (patch: Partial<MindNode>) => void; onRemove: () => void; readOnly: boolean }) {
  const linked = node.ticketKey ? issues.find(i => i.key === node.ticketKey) : undefined;
  return (
    <aside aria-label="Selected idea" className="w-64 shrink-0 border border-lira-border rounded-lg p-3 space-y-3 text-ui overflow-y-auto">
      <p className="font-bold truncate" title={node.text}>{node.text}</p>
      <div role="group" aria-label="Colour" className="flex flex-wrap gap-1.5">
        <button type="button" disabled={readOnly} aria-pressed={!node.color} aria-label="No colour" onClick={() => onPatch({ color: undefined })} className="w-6 h-6 rounded border border-lira-border text-3xs text-lira-muted">×</button>
        {MIND_COLORS.map(c => (
          <button key={c} type="button" disabled={readOnly} aria-pressed={node.color === c} aria-label={`Colour ${c}`} onClick={() => onPatch({ color: c })}
            className={`w-6 h-6 rounded border-2 ${node.color === c ? 'border-lira-text' : 'border-transparent'}`} style={{ backgroundColor: c }} />
        ))}
      </div>
      <label className="flex flex-col gap-1">Note
        <textarea readOnly={readOnly} value={node.note ?? ''} onChange={e => onPatch({ note: e.target.value.slice(0, 2000) || undefined })} rows={5} className="bg-lira-bg border border-lira-border rounded px-2 py-1 text-ui text-lira-text" />
      </label>
      <label className="flex flex-col gap-1">Ticket
        <input readOnly={readOnly} list="mind-tickets" value={node.ticketKey ?? ''} placeholder="LIRA-12" onChange={e => onPatch({ ticketKey: e.target.value.trim().toUpperCase().slice(0, 30) || undefined })} className="bg-lira-bg border border-lira-border rounded px-2 py-1 text-ui text-lira-text" />
        <datalist id="mind-tickets">{issues.slice(0, 500).map(i => <option key={i.key} value={i.key}>{i.title}</option>)}</datalist>
      </label>
      {node.ticketKey && <p className="text-lira-muted">{linked ? `${linked.title} (${linked.status})` : 'No ticket with this key.'}</p>}
      {!readOnly && node.parentId !== null && <button type="button" onClick={onRemove} className="rounded px-3 py-1.5 border border-lira-border text-lira-text">Delete idea and its branch</button>}
    </aside>
  );
}
