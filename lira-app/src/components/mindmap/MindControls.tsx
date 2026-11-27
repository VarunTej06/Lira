import { CircleHelp, Maximize2, Minus, Plus, Redo2, Undo2 } from 'lucide-react';
import { useState } from 'react';

interface Props { zoom: number; canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void; onZoom: (factor: number) => void; onFit: () => void }

const SHORTCUTS: readonly (readonly [string, string])[] = [
  ['Tab', 'Add an idea under the selected one'], ['Enter', 'Add an idea next to it'], ['F2 or double click', 'Edit the text'], ['Delete', 'Remove it with its branch'],
  ['Space', 'Fold or unfold its branch'], ['Arrow keys', 'Move about the board'], ['Ctrl+Z, Ctrl+Y', 'Undo and redo'], ['Wheel or pinch', 'Zoom the board, not the page'], ['Drag the background', 'Move the board'], ['Drag an idea or a shape', 'Move it (an idea takes its branch along)'], ['Shift and drop on an idea', 'Put the branch under that idea'], ['Drag a handle', 'Resize a shape or an idea; drag the dots of a line to bend it or move its ends'],
];
const BTN = 'w-8 h-8 flex items-center justify-center rounded-lg text-lira-text hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer';

/** The small controls in the corner: undo and redo, how much is zoomed in, fit to the screen, and a list of keys. */
export function MindControls({ zoom, canUndo, canRedo, onUndo, onRedo, onZoom, onFit }: Props) {
  const [help, setHelp] = useState(false);
  return (
    <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
      {help && (
        <div role="dialog" aria-label="Keys and mouse" className="w-72 bg-white border border-lira-border rounded-2xl p-3 text-xs space-y-1.5">
          <div className="font-semibold text-lira-text">Keys and mouse</div>
          {SHORTCUTS.map(([k, what]) => <div key={k} className="flex gap-2"><span className="font-mono text-lira-text w-32 shrink-0">{k}</span><span className="text-lira-muted">{what}</span></div>)}
        </div>
      )}
      <div className="flex items-center gap-1 bg-white border border-lira-border rounded-2xl p-1">
        <button type="button" aria-label="Undo" title="Undo" disabled={!canUndo} onClick={onUndo} className={BTN}><Undo2 className="w-4 h-4" /></button>
        <button type="button" aria-label="Redo" title="Redo" disabled={!canRedo} onClick={onRedo} className={BTN}><Redo2 className="w-4 h-4" /></button>
        <span className="w-px h-5 bg-lira-border mx-0.5" />
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => onZoom(1 / 1.2)} className={BTN}><Minus className="w-4 h-4" /></button>
        <span aria-label="Zoom" className="w-12 text-center text-xs font-medium text-lira-text">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => onZoom(1.2)} className={BTN}><Plus className="w-4 h-4" /></button>
        <button type="button" aria-label="Fit to screen" title="Fit to screen" onClick={onFit} className={BTN}><Maximize2 className="w-4 h-4" /></button>
        <span className="w-px h-5 bg-lira-border mx-0.5" />
        <button type="button" aria-label="Keys and mouse" aria-expanded={help} title="Keys and mouse" onClick={() => setHelp(h => !h)} className={BTN}><CircleHelp className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
