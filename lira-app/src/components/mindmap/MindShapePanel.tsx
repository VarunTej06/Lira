import { Bold, Italic, Trash2, Underline } from 'lucide-react';
import { MIND_COLORS } from '../../theme/palette';
import type { FontSize, Link, Shape } from '../../utils/mindFree';
import { FIELD, LABEL } from '../standup/parts';
import type { StyleKey } from './MindMapCanvas';

const ICON_BTN = 'w-8 h-8 flex items-center justify-center rounded-lg border cursor-pointer';
const DELETE = 'w-full flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm border border-lira-border bg-white text-red-600 hover:bg-gray-50 cursor-pointer';
const SIZES: readonly { size: FontSize; label: string }[] = [{ size: 'small', label: 'Small' }, { size: 'medium', label: 'Medium' }, { size: 'large', label: 'Large' }];

/** Bold, italic and underline for the whole text of what is selected. */
export function StyleToggles({ value, onToggle, readOnly }: { value: Record<StyleKey, boolean>; onToggle: (key: StyleKey) => void; readOnly: boolean }) {
  const items = [['bold', 'Bold', Bold], ['italic', 'Italic', Italic], ['underline', 'Underline', Underline]] as const;
  return (
    <div role="group" aria-label="Text style" className="flex gap-1.5">
      {items.map(([key, label, Icon]) => (
        <button key={key} type="button" disabled={readOnly} aria-pressed={value[key]} aria-label={`${label} text`} title={label} onClick={() => onToggle(key)} className={`${ICON_BTN} ${value[key] ? 'border-lira-blue bg-lira-blue-light text-lira-text' : 'border-lira-border bg-white text-lira-muted'}`}><Icon className="w-4 h-4" /></button>
      ))}
    </div>
  );
}

/** Swatches of the palette, with a first one for "none". */
function Swatches({ value, label, onPick, readOnly }: { value: string | undefined; label: string; onPick: (color: string | undefined) => void; readOnly: boolean }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      <button type="button" disabled={readOnly} aria-pressed={!value} aria-label={`No ${label.toLowerCase()}`} onClick={() => onPick(undefined)} className={`h-7 px-2 rounded-lg border text-3xs text-lira-muted cursor-pointer ${value ? 'border-lira-border' : 'border-lira-text'}`}>None</button>
      {MIND_COLORS.map(c => <button key={c} type="button" disabled={readOnly} aria-pressed={value === c} aria-label={`${label} ${c}`} onClick={() => onPick(c)} className={`w-7 h-7 rounded-lg border-2 cursor-pointer ${value === c ? 'border-lira-text' : 'border-transparent'}`} style={{ backgroundColor: c }} />)}
    </div>
  );
}

const KIND_NAME: Record<Shape['kind'], string> = { box: 'Box', ellipse: 'Ellipse', note: 'Sticky note', text: 'Text' };

/** What can be set on the selected shape: its words, text style and size, and its colour. */
export function ShapePanel({ shape, onPatch, onRemove, readOnly }: { shape: Shape; onPatch: (patch: Partial<Shape>) => void; onRemove: () => void; readOnly: boolean }) {
  return (
    <aside aria-label="Selected shape" className="w-72 shrink-0 bg-white border-l border-lira-border p-4 space-y-4 text-sm overflow-y-auto">
      <div className="text-xs font-semibold text-lira-muted uppercase tracking-wide">{KIND_NAME[shape.kind]}</div>
      <div><label className={LABEL} htmlFor="shape-text">Text</label><textarea id="shape-text" readOnly={readOnly} rows={4} maxLength={500} value={shape.text} onChange={e => onPatch({ text: e.target.value })} className={FIELD} /></div>
      <div><div className={LABEL}>Style</div><StyleToggles value={{ bold: !!shape.bold, italic: !!shape.italic, underline: !!shape.underline }} readOnly={readOnly} onToggle={k => onPatch({ [k]: !shape[k] })} /></div>
      <div role="group" aria-label="Text size">
        <div className={LABEL}>Size</div>
        <div className="inline-flex rounded-xl border border-lira-border overflow-hidden text-xs">
          {SIZES.map(s => <button key={s.size} type="button" disabled={readOnly} aria-pressed={(shape.size ?? 'medium') === s.size} onClick={() => onPatch({ size: s.size })} className={`px-3 py-1.5 cursor-pointer ${(shape.size ?? 'medium') === s.size ? 'bg-lira-blue text-lira-on-blue' : 'bg-white text-lira-muted hover:text-lira-text'}`}>{s.label}</button>)}
        </div>
      </div>
      <div><div className={LABEL}>Colour</div><Swatches value={shape.color} label="Shape colour" readOnly={readOnly} onPick={color => onPatch({ color })} /></div>
      {!readOnly && <button type="button" onClick={onRemove} className={DELETE}><Trash2 className="w-3.5 h-3.5" />Delete the shape</button>}
    </aside>
  );
}

/** What can be set on the selected line: an arrowhead, dashes, and its colour. */
export function LinkPanel({ link, onPatch, onRemove, readOnly }: { link: Link; onPatch: (patch: Partial<Link>) => void; onRemove: () => void; readOnly: boolean }) {
  const check = (key: 'arrow' | 'dashed', label: string) => (
    <label className="flex items-center gap-2"><input type="checkbox" disabled={readOnly} checked={!!link[key]} onChange={() => onPatch({ [key]: !link[key] })} />{label}</label>
  );
  return (
    <aside aria-label="Selected line" className="w-72 shrink-0 bg-white border-l border-lira-border p-4 space-y-4 text-sm overflow-y-auto">
      <div className="text-xs font-semibold text-lira-muted uppercase tracking-wide">Line</div>
      <div className="space-y-2">{check('arrow', 'Arrowhead')}{check('dashed', 'Dashed')}</div>
      <div><div className={LABEL}>Colour</div><Swatches value={link.color} label="Line colour" readOnly={readOnly} onPick={color => onPatch({ color })} /></div>
      {!readOnly && <button type="button" onClick={onRemove} className={DELETE}><Trash2 className="w-3.5 h-3.5" />Delete the line</button>}
    </aside>
  );
}
