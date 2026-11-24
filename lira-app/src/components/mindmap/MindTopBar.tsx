import { ArrowLeft, Download, FileUp, ListTree, Network, Search, Star } from 'lucide-react';
import { useState } from 'react';
import type { MindMap } from '../../utils/mindmap';

export type ExportKind = 'png' | 'svg' | 'md' | 'json';
const EXPORTS: readonly { kind: ExportKind; label: string }[] = [{ kind: 'png', label: 'Picture (PNG)' }, { kind: 'svg', label: 'Drawing (SVG)' }, { kind: 'md', label: 'Outline (Markdown)' }, { kind: 'json', label: 'Data (JSON)' }];

interface Props {
  map: MindMap;
  view: 'map' | 'outline';
  query: string;
  readOnly: boolean;
  onBack: () => void;
  onName: (name: string) => void;
  onStar: () => void;
  onView: (view: 'map' | 'outline') => void;
  onQuery: (query: string) => void;
  onExport: (kind: ExportKind) => void;
  onImport: () => void;
}

const BTN = 'flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border border-lira-border bg-white text-lira-text hover:bg-gray-50 cursor-pointer';

/** The bar above the map: back to the list, the name (edited in place), a star, map or outline, search, import and export. */
export function MindTopBar({ map, view, query, readOnly, onBack, onName, onStar, onView, onQuery, onExport, onImport }: Props) {
  const [exporting, setExporting] = useState(false);
  return (
    <header className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-white border-b border-lira-border">
      <button type="button" onClick={onBack} aria-label="All mind maps" className="flex items-center gap-1.5 text-sm text-lira-muted hover:text-lira-text cursor-pointer"><ArrowLeft className="w-4 h-4" /> Mind maps</button>
      <span className="text-lira-muted">/</span>
      <input aria-label="Mind map name" readOnly={readOnly} value={map.name} maxLength={100} onChange={e => onName(e.target.value)} className="text-base font-semibold text-lira-text bg-transparent rounded-lg px-2 py-1 w-56 max-w-full hover:bg-gray-50 focus:bg-gray-50 outline-none focus:ring-1 focus:ring-lira-blue" />
      <button type="button" aria-pressed={!!map.starred} aria-label={map.starred ? 'Remove the star' : 'Star this mind map'} title="Star" onClick={onStar} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"><Star className={`w-4 h-4 ${map.starred ? 'fill-amber-400 text-amber-500' : 'text-lira-muted'}`} /></button>
      <div role="group" aria-label="View" className="inline-flex rounded-xl border border-lira-border overflow-hidden text-xs ml-2">
        {([['map', 'Map', Network], ['outline', 'Outline', ListTree]] as const).map(([v, label, Icon]) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => onView(v)} className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer ${view === v ? 'bg-lira-blue text-lira-on-blue' : 'bg-white text-lira-muted hover:text-lira-text'}`}><Icon className="w-3.5 h-3.5" />{label}</button>
        ))}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <label className="relative"><Search className="w-3.5 h-3.5 text-lira-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input type="search" aria-label="Search the map" placeholder="Search ideas" value={query} onChange={e => onQuery(e.target.value)} className="w-44 text-sm border border-lira-border rounded-xl pl-8 pr-3 py-1.5 bg-white text-lira-text focus:outline-none focus:border-lira-blue" /></label>
        {!readOnly && <button type="button" onClick={onImport} className={BTN}><FileUp className="w-3.5 h-3.5" /> Import outline</button>}
        <div className="relative">
          <button type="button" aria-expanded={exporting} onClick={() => setExporting(e => !e)} className={BTN}><Download className="w-3.5 h-3.5" /> Export</button>
          {exporting && (
            <div role="menu" aria-label="Export" className="absolute right-0 top-full mt-1 z-20 w-52 bg-white border border-lira-border rounded-2xl p-1.5">
              {EXPORTS.map(e => <button key={e.kind} type="button" role="menuitem" onClick={() => { setExporting(false); onExport(e.kind); }} className="w-full text-left px-3 py-2 text-sm rounded-xl text-lira-text hover:bg-gray-50 cursor-pointer">{e.label}</button>)}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
