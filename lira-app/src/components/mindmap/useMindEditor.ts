import { useState } from 'react';
import { useResetWhen } from '../../hooks/useResetWhen';
import { PALETTE } from '../../theme/palette';
import { currentTime } from '../../utils/clock';
import { push, redo, start, undo, type History } from '../../utils/history';
import { readFree, removeItem, type FreeDoc } from '../../utils/mindFree';
import { fromOutline, setAllCollapsed, toOutline, type MindMap, type MindNode } from '../../utils/mindmap';
import { download, fileNameOf, svgToPng, toSvg } from '../../utils/mindmapExport';
import { fromTemplate } from '../../utils/mindTemplates';
import type { ExportKind } from './MindTopBar';

/** The colours of an exported picture: the app's own palette, so it reads the same on any page. */
const COLORS = { ink: PALETTE.ink, paper: PALETTE.surfaceMuted, line: PALETTE.textFaint, accent: PALETTE.brand };
const uid = (): string => crypto.randomUUID();

/** Everything that can be undone: the ideas of the tree, and the free-form layer of shapes, lines and comments. */
export interface MindDoc extends FreeDoc { nodes: MindNode[] }
const docOf = (map: MindMap | undefined): MindDoc => ({ nodes: map?.nodes ?? [], ...readFree(map ?? {}) });

/** What hung on ideas that are gone (their lines and comments) goes with them. */
function withoutGone(next: MindDoc, previous: readonly MindNode[], nodes: readonly MindNode[]): MindDoc {
  const alive = new Set(nodes.map(n => n.id));
  return previous.filter(n => !alive.has(n.id)).reduce<MindDoc>((doc, n) => ({ ...removeItem(doc, n.id), nodes: doc.nodes }), next);
}

/**
 * Everything the editor of one storyboard does to it: change the ideas and the free-form layer with undo and redo, rename, star, start from a
 * template, import an outline, and export. Each change is saved at once to the list the map lives in.
 */
export function useMindEditor(maps: readonly MindMap[], saveMaps: (maps: MindMap[]) => void, mapId: string | undefined) {
  const map = maps.find(m => m.id === mapId);
  const [history, setHistory] = useState<History<MindDoc>>(() => start(docOf(map)));
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  useResetWhen([map?.id], () => { setHistory(start(docOf(map))); setSelected(null); setEditing(null); setQuery(''); });

  const doc = history.present;
  const write = (patch: Partial<MindMap>) => { if (map) saveMaps(maps.map(m => (m.id === map.id ? { ...m, ...patch, updatedAt: currentTime().toISOString() } : m))); };
  const keep = (next: MindDoc) => { setHistory(h => push(h, next)); write({ nodes: next.nodes, shapes: next.shapes, links: next.links, comments: next.comments }); };
  const commit = (nodes: MindNode[]) => { if (map) keep(withoutGone({ ...doc, nodes }, doc.nodes, nodes)); };
  const commitFree = (free: FreeDoc) => { if (map) keep({ ...doc, ...free }); };
  const step = (move: typeof undo) => { const next = move(history); setHistory(next); write({ nodes: next.present.nodes, shapes: next.present.shapes, links: next.present.links, comments: next.present.comments }); };

  return {
    map, doc, selected, setSelected, editing, setEditing, query, setQuery, commit, commitFree,
    canUndo: history.past.length > 0, canRedo: history.future.length > 0, undo: () => step(undo), redo: () => step(redo),
    rename: (name: string) => write({ name: name.slice(0, 100) }), toggleStar: () => write({ starred: !map?.starred }),
    foldAll: (collapsed: boolean) => { if (map) commit(setAllCollapsed(doc.nodes, collapsed)); },
    applyTemplate: (id: string) => { if (!map) return; const t = fromTemplate(id, uid); keep({ nodes: t.nodes, ...t.free }); setSelected(null); },
    importOutline: (text: string): boolean => { const nodes = fromOutline(text, uid); if (nodes.length === 0) return false; commit(nodes); setSelected(null); return true; },
    exportAs: async (kind: ExportKind) => {
      if (!map) return;
      const whole = { ...map, nodes: doc.nodes, shapes: doc.shapes, links: doc.links, comments: doc.comments };
      if (kind === 'json') download(fileNameOf(map.name, 'json'), 'application/json', JSON.stringify(whole, null, 2));
      else if (kind === 'md') download(fileNameOf(map.name, 'md'), 'text/markdown', `# ${map.name}\n\n${toOutline(doc.nodes)}\n`);
      else {
        const { svg, width, height } = toSvg(doc.nodes, COLORS, doc);
        if (kind === 'svg') download(fileNameOf(map.name, 'svg'), 'image/svg+xml', svg);
        else { const png = await svgToPng(svg, width, height); if (png) download(fileNameOf(map.name, 'png'), 'image/png', png); }
      }
    },
  };
}
