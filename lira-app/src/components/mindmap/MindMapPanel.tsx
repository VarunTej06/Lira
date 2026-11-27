import { Trash2 } from 'lucide-react';
import { forwardRef } from 'react';
import { MIND_COLORS } from '../../theme/palette';
import type { Issue } from '../../types/issue';
import { colorOf } from '../../utils/mindLayout';
import type { MindNode } from '../../utils/mindmap';
import { FIELD, LABEL } from '../standup/parts';
import type { StyleKey } from './MindMapCanvas';
import { StyleToggles } from './MindShapePanel';

interface Props { node: MindNode; nodes: readonly MindNode[]; issues: Issue[]; onPatch: (patch: Partial<MindNode>) => void; onRemove: () => void; onStyle: (key: StyleKey) => void; readOnly: boolean }

/** What can be set on the selected idea: its text, colour, a note, and a ticket it stands for. */
export const MindMapPanel = forwardRef<HTMLTextAreaElement, Props>(function MindMapPanel({ node, nodes, issues, onPatch, onRemove, onStyle, readOnly }, noteRef) {
  const linked = node.ticketKey ? issues.find(i => i.key === node.ticketKey) : undefined;
  const root = node.parentId === null;
  const colour = colorOf(nodes, node.id);
  return (
    <aside aria-label="Selected idea" className="w-72 shrink-0 bg-white border-l border-lira-border p-4 space-y-4 text-sm overflow-y-auto">
      <div>
        <label className={LABEL} htmlFor="idea-text">Idea</label>
        <input id="idea-text" readOnly={readOnly} value={node.text} maxLength={200} onChange={e => { if (e.target.value.trim()) onPatch({ text: e.target.value }); }} className={FIELD} />
      </div>
      <div><div className={LABEL}>Style</div><StyleToggles value={{ bold: !!node.bold, italic: !!node.italic, underline: !!node.underline }} readOnly={readOnly} onToggle={onStyle} /></div>
      {!root && (
        <div role="group" aria-label="Colour">
          <div className={LABEL}>Colour</div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" disabled={readOnly} aria-pressed={!node.color} aria-label="No colour" title="The colour of its branch" onClick={() => onPatch({ color: undefined })} className={`h-7 px-2 rounded-lg border text-3xs text-lira-muted cursor-pointer ${node.color ? 'border-lira-border' : 'border-lira-text'}`}>Auto</button>
            {MIND_COLORS.map(c => (
              <button key={c} type="button" disabled={readOnly} aria-pressed={node.color === c} aria-label={`Colour ${c}`} onClick={() => onPatch({ color: c })}
                className={`w-7 h-7 rounded-lg border-2 cursor-pointer ${node.color === c ? 'border-lira-text' : 'border-transparent'}`} style={{ backgroundColor: c }} />
            ))}
          </div>
          {colour && !node.color && <p className="text-2xs text-lira-muted mt-1">It follows the colour of its branch.</p>}
        </div>
      )}
      <div>
        <label className={LABEL} htmlFor="idea-note">Note</label>
        <textarea id="idea-note" ref={noteRef} readOnly={readOnly} value={node.note ?? ''} onChange={e => onPatch({ note: e.target.value.slice(0, 2000) || undefined })} rows={5} className={FIELD} />
      </div>
      <div>
        <label className={LABEL} htmlFor="idea-ticket">Ticket</label>
        <input id="idea-ticket" readOnly={readOnly} list="mind-tickets" value={node.ticketKey ?? ''} placeholder="LIRA-12" onChange={e => onPatch({ ticketKey: e.target.value.trim().toUpperCase().slice(0, 30) || undefined })} className={FIELD} />
        <datalist id="mind-tickets">{issues.slice(0, 500).map(i => <option key={i.key} value={i.key}>{i.title}</option>)}</datalist>
        {node.ticketKey && <p className="text-2xs text-lira-muted mt-1">{linked ? `${linked.title} (${linked.status})` : 'No ticket with this key.'}</p>}
      </div>
      {!readOnly && !root && <button type="button" onClick={onRemove} className="w-full flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm border border-lira-border bg-white text-red-600 hover:bg-gray-50 cursor-pointer"><Trash2 className="w-3.5 h-3.5" />Delete idea and its branch</button>}
    </aside>
  );
});
