import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PALETTE } from '../../theme/palette';
import { useResetWhen } from '../../hooks/useResetWhen';
import { useStoredList } from '../../hooks/useStoredList';
import type { Issue } from '../../types/issue';
import { currentTime } from '../../utils/clock';
import { push, redo, start, undo, type History } from '../../utils/history';
import { fromOutline, newMap, removeNode, setAllCollapsed, toOutline, updateNode, type MindMap, type MindNode } from '../../utils/mindmap';
import { download, fileNameOf, svgToPng, toSvg } from '../../utils/mindmapExport';
import { confirmDialog } from '../common/dialogStore';
import { BUTTON, FIELD } from '../teams/teamsUi';
import { MindMapCanvas } from './MindMapCanvas';
import { MindMapPanel } from './MindMapPanel';

const KEY = 'lira_mindmaps';
/** The colours of an exported picture: the app's own palette, so it reads the same on any page. */
const COLORS = { ink: PALETTE.ink, paper: PALETTE.surfaceMuted, line: PALETTE.textFaint, accent: PALETTE.brand };
const uid = (): string => crypto.randomUUID();

/** Mind maps: a list of them, and the editor for the open one. */
export function MindMapsPage({ issues }: { issues: Issue[] }) {
  const [maps, saveMaps] = useStoredList<MindMap>(KEY);
  const { mapId } = useParams();
  const navigate = useNavigate();
  const map = maps.find(m => m.id === mapId);
  const [history, setHistory] = useState<History<MindNode[]>>(() => start(map?.nodes ?? []));
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [importing, setImporting] = useState<string | null>(null);
  useResetWhen([map?.id], () => { setHistory(start(map?.nodes ?? [])); setSelected(null); setQuery(''); setImporting(null); });

  const write = (id: string, patch: Partial<MindMap>) => saveMaps(maps.map(m => (m.id === id ? { ...m, ...patch, updatedAt: currentTime().toISOString() } : m)));
  const commit = (nodes: MindNode[]) => { if (!map) return; setHistory(h => push(h, nodes)); write(map.id, { nodes }); };
  const step = (move: typeof undo) => { if (!map) return; const next = move(history); setHistory(next); write(map.id, { nodes: next.present }); };
  const create = () => {
    const now = currentTime().toISOString();
    const made = newMap(uid(), 'New mind map', now, uid());
    saveMaps([...maps, made]);
    navigate(`/mindmaps/${made.id}`);
  };
  const remove = async (m: MindMap) => {
    if (!(await confirmDialog({ title: `Delete "${m.name}"?`, message: 'The whole mind map is deleted. This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' }))) return;
    saveMaps(maps.filter(x => x.id !== m.id));
    if (m.id === mapId) navigate('/mindmaps');
  };
  const copy = (m: MindMap) => {
    const ids = new Map(m.nodes.map(n => [n.id, uid()]));
    const made: MindMap = { ...m, id: uid(), name: `${m.name} (copy)`, nodes: m.nodes.map(n => ({ ...n, id: ids.get(n.id)!, parentId: n.parentId === null ? null : ids.get(n.parentId)! })), createdAt: currentTime().toISOString(), updatedAt: currentTime().toISOString() };
    saveMaps([...maps, made]);
    navigate(`/mindmaps/${made.id}`);
  };
  const exportAs = async (kind: 'json' | 'md' | 'svg' | 'png') => {
    if (!map) return;
    if (kind === 'json') download(fileNameOf(map.name, 'json'), 'application/json', JSON.stringify(map, null, 2));
    else if (kind === 'md') download(fileNameOf(map.name, 'md'), 'text/markdown', `# ${map.name}\n\n${toOutline(map.nodes)}\n`);
    else {
      const { svg, width, height } = toSvg(map.nodes, COLORS);
      if (kind === 'svg') download(fileNameOf(map.name, 'svg'), 'image/svg+xml', svg);
      else { const png = await svgToPng(svg, width, height); if (png) download(fileNameOf(map.name, 'png'), 'image/png', png); }
    }
  };
  const importOutline = () => {
    const nodes = fromOutline(importing ?? '', uid);
    if (nodes.length > 0) { commit(nodes); setSelected(null); }
    setImporting(null);
  };
  const node = map?.nodes.find(n => n.id === selected);

  return (
    <div className="flex gap-4 p-4 h-full min-h-0">
      <nav aria-label="Mind maps" className="w-56 shrink-0 space-y-2 overflow-y-auto">
        <button type="button" onClick={create} className={`${BUTTON} w-full`}>New mind map</button>
        {maps.length === 0 && <p className="text-ui text-lira-muted">No mind maps yet.</p>}
        <ul className="space-y-1">
          {maps.map(m => (
            <li key={m.id} className={`flex items-center gap-1 rounded border px-2 py-1.5 text-ui ${m.id === mapId ? 'border-lira-blue bg-lira-blue-light' : 'border-lira-border'}`}>
              <button type="button" className="flex-1 text-left truncate" onClick={() => navigate(`/mindmaps/${m.id}`)}>{m.name}</button>
              <button type="button" aria-label={`Copy ${m.name}`} title="Make a copy" onClick={() => copy(m)} className="text-lira-muted">⧉</button>
              <button type="button" aria-label={`Delete ${m.name}`} title="Delete" onClick={() => { void remove(m); }} className="text-lira-muted">×</button>
            </li>
          ))}
        </ul>
      </nav>
      <section className="flex-1 min-w-0 flex flex-col gap-3">
        {!map ? <p className="text-ui text-lira-muted">{maps.length ? 'Choose a mind map, or make a new one.' : 'Make your first mind map to start.'}</p> : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-ui">
              <input aria-label="Mind map name" value={map.name} onChange={e => write(map.id, { name: e.target.value.slice(0, 100) })} className={`${FIELD} w-56 font-bold`} />
              <button type="button" disabled={!history.past.length} onClick={() => step(undo)} className="rounded px-2 py-1 border border-lira-border disabled:opacity-40">Undo</button>
              <button type="button" disabled={!history.future.length} onClick={() => step(redo)} className="rounded px-2 py-1 border border-lira-border disabled:opacity-40">Redo</button>
              <button type="button" onClick={() => commit(setAllCollapsed(map.nodes, true))} className="rounded px-2 py-1 border border-lira-border">Fold all</button>
              <button type="button" onClick={() => commit(setAllCollapsed(map.nodes, false))} className="rounded px-2 py-1 border border-lira-border">Unfold all</button>
              <input type="search" aria-label="Search the map" placeholder="Search ideas" value={query} onChange={e => setQuery(e.target.value)} className={`${FIELD} w-44`} />
              <span className="flex gap-1 ml-auto" role="group" aria-label="Export">
                {(['json', 'md', 'svg', 'png'] as const).map(k => <button key={k} type="button" onClick={() => { void exportAs(k); }} className="rounded px-2 py-1 border border-lira-border uppercase">{k}</button>)}
                <button type="button" onClick={() => setImporting('')} className="rounded px-2 py-1 border border-lira-border">Import outline</button>
              </span>
            </div>
            {importing !== null && (
              <div className="border border-lira-border rounded-lg p-3 space-y-2 text-ui">
                <p className="text-lira-muted">Paste an indented list. The first line becomes the central idea and replaces this map's ideas.</p>
                <textarea aria-label="Outline" rows={6} value={importing} onChange={e => setImporting(e.target.value)} className="w-full bg-lira-bg border border-lira-border rounded px-2 py-1 font-mono text-ui text-lira-text" />
                <div className="flex gap-2"><button type="button" onClick={importOutline} className={BUTTON}>Replace the map</button><button type="button" onClick={() => setImporting(null)} className="rounded px-3 py-1.5 border border-lira-border">Cancel</button></div>
              </div>
            )}
            <p className="text-ui text-lira-muted">Tab adds an idea under the selected one, Enter next to it, double click or F2 edits, Delete removes it with its branch, Space folds it. Drag an idea onto another to move it.</p>
            <div className="flex-1 min-h-0 flex gap-3">
              <MindMapCanvas nodes={map.nodes} onChange={commit} onUndo={() => step(undo)} onRedo={() => step(redo)} selected={selected} onSelect={setSelected} query={query} />
              {node && <MindMapPanel node={node} issues={issues} readOnly={false} onPatch={patch => commit(updateNode(map.nodes, node.id, patch))} onRemove={() => { commit(removeNode(map.nodes, node.id)); setSelected(node.parentId); }} />}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
