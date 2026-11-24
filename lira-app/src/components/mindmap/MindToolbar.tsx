import { ChevronsDownUp, ChevronsUpDown, CornerDownRight, LayoutTemplate, Link2, Palette, Pencil, Plus, StickyNote, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { MIND_COLORS } from '../../theme/palette';
import { MIND_TEMPLATES } from '../../utils/mindTemplates';

interface Props {
  /** Nothing can be changed by a person who may only look. */
  readOnly: boolean;
  /** Whether an idea is selected; most buttons act on it. */
  hasSelection: boolean;
  isRoot: boolean;
  onAddChild: () => void;
  onAddSibling: () => void;
  onEdit: () => void;
  onColor: (color: string | undefined) => void;
  onNote: () => void;
  onTicket: () => void;
  onFold: (collapsed: boolean) => void;
  onDelete: () => void;
  onTemplate: (id: string) => void;
}

const BTN = 'w-9 h-9 flex items-center justify-center rounded-xl text-lira-bg hover:bg-lira-bg/20 disabled:opacity-35 disabled:hover:bg-transparent cursor-pointer';

function Tool({ label, hint, onClick, disabled, children }: { label: string; hint?: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return <button type="button" aria-label={label} title={hint ? `${label} (${hint})` : label} disabled={disabled} onClick={onClick} className={BTN}>{children}</button>;
}

/** The dark strip of tools on the left of the map. Each button says what it does when hovered; most work on the selected idea. */
export function MindToolbar({ readOnly, hasSelection, isRoot, onAddChild, onAddSibling, onEdit, onColor, onNote, onTicket, onFold, onDelete, onTemplate }: Props) {
  const [menu, setMenu] = useState<'colour' | 'template' | null>(null);
  const off = readOnly || !hasSelection;
  const toggle = (m: 'colour' | 'template') => setMenu(cur => (cur === m ? null : m));
  return (
    <div className="relative">
      <div role="toolbar" aria-label="Mind map tools" aria-orientation="vertical" className="flex flex-col gap-1 p-2 rounded-2xl bg-lira-text">
        <Tool label="Add an idea" hint="Tab" disabled={off} onClick={onAddChild}><Plus className="w-4 h-4" /></Tool>
        <Tool label="Add an idea next to it" hint="Enter" disabled={off || isRoot} onClick={onAddSibling}><CornerDownRight className="w-4 h-4" /></Tool>
        <Tool label="Edit the text" hint="F2" disabled={off} onClick={onEdit}><Pencil className="w-4 h-4" /></Tool>
        <Tool label="Colour" disabled={off || isRoot} onClick={() => toggle('colour')}><Palette className="w-4 h-4" /></Tool>
        <Tool label="Note" disabled={off} onClick={onNote}><StickyNote className="w-4 h-4" /></Tool>
        <Tool label="Link a ticket" disabled={off} onClick={onTicket}><Link2 className="w-4 h-4" /></Tool>
        <span className="h-px bg-lira-bg/25 my-0.5" />
        <Tool label="Fold every branch" disabled={readOnly} onClick={() => onFold(true)}><ChevronsDownUp className="w-4 h-4" /></Tool>
        <Tool label="Unfold every branch" disabled={readOnly} onClick={() => onFold(false)}><ChevronsUpDown className="w-4 h-4" /></Tool>
        <Tool label="Start from a template" disabled={readOnly} onClick={() => toggle('template')}><LayoutTemplate className="w-4 h-4" /></Tool>
        <span className="h-px bg-lira-bg/25 my-0.5" />
        <Tool label="Delete the idea and its branch" hint="Delete" disabled={off || isRoot} onClick={onDelete}><Trash2 className="w-4 h-4" /></Tool>
      </div>
      {menu === 'colour' && (
        <div role="group" aria-label="Colour of the branch" className="absolute left-full top-0 ml-2 bg-white border border-lira-border rounded-2xl p-2 flex flex-wrap gap-1.5 w-40">
          <button type="button" aria-label="Branch colour" title="The colour of its branch" onClick={() => { onColor(undefined); setMenu(null); }} className="w-7 h-7 rounded-lg border border-lira-border text-3xs text-lira-muted cursor-pointer">Auto</button>
          {MIND_COLORS.map(c => <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => { onColor(c); setMenu(null); }} className="w-7 h-7 rounded-lg border border-lira-border cursor-pointer" style={{ backgroundColor: c }} />)}
        </div>
      )}
      {menu === 'template' && (
        <div role="menu" aria-label="Templates" className="absolute left-full top-0 ml-2 bg-white border border-lira-border rounded-2xl p-1.5 w-56">
          {MIND_TEMPLATES.map(t => (
            <button key={t.id} type="button" role="menuitem" onClick={() => { onTemplate(t.id); setMenu(null); }} className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 cursor-pointer">
              <span className="block text-sm font-medium text-lira-text">{t.name}</span><span className="block text-2xs text-lira-muted">{t.about}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
