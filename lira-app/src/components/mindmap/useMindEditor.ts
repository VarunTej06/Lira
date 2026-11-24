import { useState } from 'react';
import { useResetWhen } from '../../hooks/useResetWhen';
import { PALETTE } from '../../theme/palette';
import { currentTime } from '../../utils/clock';
import { push, redo, start, undo, type History } from '../../utils/history';
import { fromOutline, setAllCollapsed, toOutline, type MindMap, type MindNode } from '../../utils/mindmap';
import { download, fileNameOf, svgToPng, toSvg } from '../../utils/mindmapExport';
import { fromTemplate } from '../../utils/mindTemplates';
import type { ExportKind } from './MindTopBar';

/** The colours of an exported picture: the app's own palette, so it reads the same on any page. */
const COLORS = { ink: PALETTE.ink, paper: PALETTE.surfaceMuted, line: PALETTE.textFaint, accent: PALETTE.brand };
const uid = (): string => crypto.randomUUID();

/**
 * Everything the editor of one mind map does to it: change the ideas with undo and redo, rename, star, start from a template, import an
 * outline, and export. Each change is saved at once to the list the map lives in.
 */
export function useMindEditor(maps: readonly MindMap[], saveMaps: (maps: MindMap[]) => void, mapId: string | undefined) {
  const map = maps.find(m => m.id === mapId);
  const [history, setHistory] = useState<History<MindNode[]>>(() => start(map?.nodes ?? []));
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  useResetWhen([map?.id], () => { setHistory(start(map?.nodes ?? [])); setSelected(null); setEditing(null); setQuery(''); });

  const write = (patch: Partial<MindMap>) => { if (map) saveMaps(maps.map(m => (m.id === map.id ? { ...m, ...patch, updatedAt: currentTime().toISOString() } : m))); };
  const commit = (nodes: MindNode[]) => { if (!map) return; setHistory(h => push(h, nodes)); write({ nodes }); };
  const step = (move: typeof undo) => { const next = move(history); setHistory(next); write({ nodes: next.present }); };

  return {
    map, selected, setSelected, editing, setEditing, query, setQuery, commit,
    canUndo: history.past.length > 0, canRedo: history.future.length > 0, undo: () => step(undo), redo: () => step(redo),
    rename: (name: string) => write({ name: name.slice(0, 100) }), toggleStar: () => write({ starred: !map?.starred }),
    foldAll: (collapsed: boolean) => { if (map) commit(setAllCollapsed(map.nodes, collapsed)); },
    applyTemplate: (id: string) => { commit(fromTemplate(id, uid)); setSelected(null); },
    importOutline: (text: string): boolean => { const nodes = fromOutline(text, uid); if (nodes.length === 0) return false; commit(nodes); setSelected(null); return true; },
    exportAs: async (kind: ExportKind) => {
      if (!map) return;
      if (kind === 'json') download(fileNameOf(map.name, 'json'), 'application/json', JSON.stringify(map, null, 2));
      else if (kind === 'md') download(fileNameOf(map.name, 'md'), 'text/markdown', `# ${map.name}\n\n${toOutline(map.nodes)}\n`);
      else {
        const { svg, width, height } = toSvg(map.nodes, COLORS);
        if (kind === 'svg') download(fileNameOf(map.name, 'svg'), 'image/svg+xml', svg);
        else { const png = await svgToPng(svg, width, height); if (png) download(fileNameOf(map.name, 'png'), 'image/png', png); }
      }
    },
  };
}
