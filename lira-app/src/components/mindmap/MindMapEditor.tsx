import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStoredList } from '../../hooks/useStoredList';
import type { Issue } from '../../types/issue';
import { searchNodes, addChild, addSibling, removeNode, updateNode, type MindMap } from '../../utils/mindmap';
import { confirmDialog } from '../common/dialogStore';
import { Modal } from '../common/Modal';
import { FIELD } from '../standup/parts';
import { MindMapCanvas } from './MindMapCanvas';
import { MindMapPanel } from './MindMapPanel';
import { MindOutline } from './MindOutline';
import { MindToolbar } from './MindToolbar';
import { MindTopBar } from './MindTopBar';
import { useMindEditor } from './useMindEditor';

const KEY = 'lira_mindmaps';

/** The page for one mind map: a bar on top, the tools on the left, the map in the middle that fills the page, and what can be set on the selected idea on the right. */
export function MindMapEditor({ issues }: { issues: Issue[] }) {
  const { mapId } = useParams();
  const navigate = useNavigate();
  const [maps, saveMaps] = useStoredList<MindMap>(KEY);
  const ed = useMindEditor(maps, saveMaps, mapId);
  const [view, setView] = useState<'map' | 'outline'>('map');
  const [importing, setImporting] = useState<string | null>(null);
  const { map } = ed;

  if (!map) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-lira-bg text-sm text-lira-muted">
        <p>This mind map is not here any more.</p>
        <button type="button" onClick={() => navigate('/mindmaps')} className="px-4 py-2 rounded-xl bg-lira-blue text-lira-on-blue cursor-pointer">All mind maps</button>
      </div>
    );
  }
  const node = map.nodes.find(n => n.id === ed.selected);
  const addUnder = (make: typeof addChild) => {
    if (!node) return;
    const id = crypto.randomUUID(); const next = make(map.nodes, node.id, id);
    if (next.length === map.nodes.length) return;
    ed.commit(next); ed.setSelected(id); ed.setEditing(id);
  };
  const remove = () => { if (node && node.parentId !== null) { ed.commit(removeNode(map.nodes, node.id)); ed.setSelected(node.parentId); } };
  async function template(id: string) {
    if (!(await confirmDialog({ title: 'Start from this template?', message: 'The ideas on this map are replaced. You can undo it.', confirmLabel: 'Replace' }))) return;
    ed.applyTemplate(id);
  }
  const focusField = (id: string) => document.getElementById(id)?.focus();

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-lira-bg">
      <MindTopBar map={map} view={view} query={ed.query} readOnly={false} onBack={() => navigate('/mindmaps')} onName={ed.rename} onStar={ed.toggleStar} onView={setView} onQuery={ed.setQuery} onExport={k => { void ed.exportAs(k); }} onImport={() => setImporting('')} />
      <div className="flex-1 min-h-0 flex">
        <div className="relative flex-1 min-w-0 flex">
          {view === 'map'
            ? <MindMapCanvas nodes={map.nodes} onChange={ed.commit} onUndo={ed.undo} onRedo={ed.redo} canUndo={ed.canUndo} canRedo={ed.canRedo} selected={ed.selected} onSelect={ed.setSelected} editing={ed.editing} onEditing={ed.setEditing} query={ed.query} />
            : <MindOutline nodes={map.nodes} selected={ed.selected} query={searchNodes(map.nodes, ed.query)} onSelect={ed.setSelected} />}
          {view === 'map' && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <MindToolbar readOnly={false} hasSelection={!!node} isRoot={node?.parentId === null}
                onAddChild={() => addUnder(addChild)} onAddSibling={() => addUnder(addSibling)} onEdit={() => node && ed.setEditing(node.id)} onColor={color => node && ed.commit(updateNode(map.nodes, node.id, { color }))}
                onNote={() => focusField('idea-note')} onTicket={() => focusField('idea-ticket')} onFold={ed.foldAll} onDelete={remove} onTemplate={id => { void template(id); }} />
            </div>
          )}
        </div>
        {node && <MindMapPanel node={node} nodes={map.nodes} issues={issues} readOnly={false} onPatch={patch => ed.commit(updateNode(map.nodes, node.id, patch))} onRemove={remove} />}
      </div>
      <Modal isOpen={importing !== null} onClose={() => setImporting(null)} title="Import an outline" size="md">
        <div className="p-6 space-y-3 text-sm text-lira-text">
          <p className="text-lira-muted">Paste an indented list. The first line becomes the central idea and replaces this map's ideas. You can undo it.</p>
          <textarea aria-label="Outline" rows={8} value={importing ?? ''} onChange={e => setImporting(e.target.value)} className={`${FIELD} font-mono`} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setImporting(null)} className="px-4 py-2 text-sm rounded-xl border border-lira-border bg-white hover:bg-gray-50 cursor-pointer">Cancel</button>
            <button type="button" onClick={() => { if (ed.importOutline(importing ?? '')) setImporting(null); }} className="px-4 py-2 text-sm font-semibold rounded-xl bg-lira-blue text-lira-on-blue hover:bg-lira-blue-hover cursor-pointer">Replace the map</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
