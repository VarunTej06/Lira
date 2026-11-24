import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStoredList } from '../../hooks/useStoredList';
import type { Issue } from '../../types/issue';
import { removeItem, updateLink, updateShape } from '../../utils/mindFree';
import { addChild, addSibling, removeNode, rootOf, searchNodes, updateNode, type MindMap } from '../../utils/mindmap';
import { loadProfile } from '../../utils/userPrefs';
import { confirmDialog } from '../common/dialogStore';
import { Modal } from '../common/Modal';
import { FIELD } from '../standup/parts';
import { MindMapCanvas, type StyleKey } from './MindMapCanvas';
import { MindMapPanel } from './MindMapPanel';
import { MindOutline } from './MindOutline';
import { LinkPanel, ShapePanel } from './MindShapePanel';
import { MindToolbar } from './MindToolbar';
import { MindTopBar } from './MindTopBar';
import type { Tool } from './useFreeTools';
import { useMindEditor } from './useMindEditor';

const KEY = 'lira_mindmaps';
const NO_STYLE: Record<StyleKey, boolean> = { bold: false, italic: false, underline: false };

/** The page for one storyboard: a bar on top, the tools on the left, the board in the middle that fills the page, and what can be set on the selected item on the right. */
export function MindMapEditor({ issues }: { issues: Issue[] }) {
  const { mapId } = useParams();
  const navigate = useNavigate();
  const [maps, saveMaps] = useStoredList<MindMap>(KEY);
  const ed = useMindEditor(maps, saveMaps, mapId);
  const [view, setView] = useState<'map' | 'outline'>('map');
  const [tool, setTool] = useState<Tool>('select');
  const [importing, setImporting] = useState<string | null>(null);
  const { map, doc } = ed;

  if (!map) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-lira-bg text-sm text-lira-muted">
        <p>This storyboard is not here any more.</p>
        <button type="button" onClick={() => navigate('/mindmaps')} className="px-4 py-2 rounded-xl bg-lira-blue text-lira-on-blue cursor-pointer">All storyboards</button>
      </div>
    );
  }
  const node = doc.nodes.find(n => n.id === ed.selected);
  const shape = doc.shapes.find(s => s.id === ed.selected);
  const link = doc.links.find(l => l.id === ed.selected);
  const styled = node ?? shape;
  const style = { bold: !!styled?.bold, italic: !!styled?.italic, underline: !!styled?.underline };
  const toggleStyle = (key: StyleKey) => {
    if (node) ed.commit(updateNode(doc.nodes, node.id, { [key]: !node[key] }));
    else if (shape) ed.commitFree(updateShape(doc, shape.id, { [key]: !shape[key] }));
  };
  /** Adds an idea under the selected one, or a new branch of the central idea when nothing is selected, and starts typing in it. */
  const addUnder = (make: typeof addChild, from = node?.id ?? rootOf(doc.nodes)?.id) => {
    if (!from) return;
    const id = crypto.randomUUID(); const next = make(doc.nodes, from, id);
    if (next.length === doc.nodes.length) return;
    ed.commit(next); ed.setSelected(id); ed.setEditing(id);
  };
  const remove = () => {
    if (node && node.parentId !== null) { ed.commit(removeNode(doc.nodes, node.id)); ed.setSelected(node.parentId); }
    else if (shape || link) { ed.commitFree(removeItem(doc, (shape ?? link)!.id)); ed.setSelected(null); }
  };
  async function template(id: string) {
    if (!(await confirmDialog({ title: 'Start from this template?', message: 'Everything on this storyboard is replaced. You can undo it.', confirmLabel: 'Replace' }))) return;
    ed.applyTemplate(id);
  }
  const focusField = (id: string) => document.getElementById(id)?.focus();
  const panel = node
    ? <MindMapPanel node={node} nodes={doc.nodes} issues={issues} readOnly={false} onStyle={toggleStyle} onPatch={patch => ed.commit(updateNode(doc.nodes, node.id, patch))} onRemove={remove} />
    : shape ? <ShapePanel shape={shape} readOnly={false} onPatch={patch => ed.commitFree(updateShape(doc, shape.id, patch))} onRemove={remove} />
      : link ? <LinkPanel link={link} readOnly={false} onPatch={patch => ed.commitFree(updateLink(doc, link.id, patch))} onRemove={remove} /> : null;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-lira-bg">
      <MindTopBar map={map} view={view} query={ed.query} readOnly={false} onBack={() => navigate('/mindmaps')} onName={ed.rename} onStar={ed.toggleStar} onView={setView} onQuery={ed.setQuery} onExport={k => { void ed.exportAs(k); }} onImport={() => setImporting('')} />
      <div className="flex-1 min-h-0 flex">
        <div className="relative flex-1 min-w-0 flex">
          {view === 'map'
            ? <MindMapCanvas nodes={doc.nodes} onChange={ed.commit} free={doc} onFree={ed.commitFree} tool={tool} onTool={setTool} onUndo={ed.undo} onRedo={ed.redo} canUndo={ed.canUndo} canRedo={ed.canRedo}
              selected={ed.selected} onSelect={ed.setSelected} editing={ed.editing} onEditing={ed.setEditing} onStyle={toggleStyle} author={loadProfile().name || 'Someone'} query={ed.query} />
            : <MindOutline nodes={doc.nodes} selected={ed.selected} query={searchNodes(doc.nodes, ed.query)} onSelect={ed.setSelected} />}
          {view === 'map' && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <MindToolbar readOnly={false} hasSelection={!!node} isRoot={node?.parentId === null} tool={tool} onTool={setTool} style={styled ? style : NO_STYLE} canStyle={!!styled} onStyle={toggleStyle}
                onAddChild={() => addUnder(addChild)} onAddSibling={() => addUnder(addSibling)} onEdit={() => (node ?? shape) && ed.setEditing((node ?? shape)!.id)} onColor={color => node && ed.commit(updateNode(doc.nodes, node.id, { color }))}
                onNote={() => focusField('idea-note')} onTicket={() => focusField('idea-ticket')} onFold={ed.foldAll} onDelete={remove} onTemplate={id => { void template(id); }} />
            </div>
          )}
        </div>
        {panel}
      </div>
      <Modal isOpen={importing !== null} onClose={() => setImporting(null)} title="Import an outline" size="md">
        <div className="p-6 space-y-3 text-sm text-lira-text">
          <p className="text-lira-muted">Paste an indented list. The first line becomes the central idea and replaces this storyboard's ideas. You can undo it.</p>
          <textarea aria-label="Outline" rows={8} value={importing ?? ''} onChange={e => setImporting(e.target.value)} className={`${FIELD} font-mono`} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setImporting(null)} className="px-4 py-2 text-sm rounded-xl border border-lira-border bg-white hover:bg-gray-50 cursor-pointer">Cancel</button>
            <button type="button" onClick={() => { if (ed.importOutline(importing ?? '')) setImporting(null); }} className="px-4 py-2 text-sm font-semibold rounded-xl bg-lira-blue text-lira-on-blue hover:bg-lira-blue-hover cursor-pointer">Replace the storyboard</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
