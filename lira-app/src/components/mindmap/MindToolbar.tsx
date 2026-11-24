import {
  ArrowUpRight, Bold, ChevronsDownUp, ChevronsUpDown, Circle, CornerDownRight, FileText, Italic, LayoutTemplate, Link2, MessageSquare, MousePointer2, Palette, Pencil, Plus, Slash, Square, StickyNote, Trash2, Type, Underline,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { MIND_COLORS } from '../../theme/palette';
import { MIND_TEMPLATES } from '../../utils/mindTemplates';
import type { StyleKey } from './MindMapCanvas';
import type { Tool } from './useFreeTools';

interface Props {
  /** Nothing can be changed by a person who may only look. */
  readOnly: boolean;
  /** Whether an idea is selected; the tools for ideas act on it. With none selected, adding an idea adds a branch to the central one. */
  hasSelection: boolean;
  isRoot: boolean;
  tool: Tool;
  onTool: (tool: Tool) => void;
  /** Which of bold, italic and underline the selected idea or shape has, and whether there is one to format. */
  style: Record<StyleKey, boolean>;
  canStyle: boolean;
  onStyle: (key: StyleKey) => void;
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
const Divider = () => <span className="h-px bg-lira-bg/25 my-0.5" />;

function Tool_({ label, hint, onClick, disabled, active, children }: { label: string; hint?: string; onClick: () => void; disabled?: boolean; active?: boolean; children: ReactNode }) {
  return <button type="button" aria-label={label} aria-pressed={active} title={hint ? `${label} (${hint})` : label} disabled={disabled} onClick={onClick} className={`${BTN} ${active ? 'bg-lira-bg/25' : ''}`}>{children}</button>;
}

const DRAW: readonly { tool: Tool; label: string; icon: ReactNode }[] = [
  { tool: 'box', label: 'Box', icon: <Square className="w-4 h-4" /> }, { tool: 'ellipse', label: 'Ellipse', icon: <Circle className="w-4 h-4" /> },
  { tool: 'note', label: 'Sticky note', icon: <StickyNote className="w-4 h-4" /> }, { tool: 'text', label: 'Text', icon: <Type className="w-4 h-4" /> },
  { tool: 'line', label: 'Line', icon: <Slash className="w-4 h-4" /> }, { tool: 'arrow', label: 'Arrow', icon: <ArrowUpRight className="w-4 h-4" /> }, { tool: 'comment', label: 'Comment', icon: <MessageSquare className="w-4 h-4" /> },
];

/** The dark strip of tools on the left of the board: pick or draw (boxes, ellipses, sticky notes, text, lines, arrows, comments), format text, and work on the ideas of the map. */
export function MindToolbar({ readOnly, hasSelection, isRoot, tool, onTool, style, canStyle, onStyle, onAddChild, onAddSibling, onEdit, onColor, onNote, onTicket, onFold, onDelete, onTemplate }: Props) {
  const [menu, setMenu] = useState<'colour' | 'template' | null>(null);
  const toggle = (m: 'colour' | 'template') => setMenu(cur => (cur === m ? null : m));
  return (
    <div className="relative">
      <div role="toolbar" aria-label="Storyboard tools" aria-orientation="vertical" className="flex flex-col gap-1 p-2 rounded-2xl bg-lira-text max-h-[calc(100vh-14rem)] overflow-y-auto">
        <Tool_ label="Select and move" hint="Esc" active={tool === 'select'} onClick={() => onTool('select')}><MousePointer2 className="w-4 h-4" /></Tool_>
        {DRAW.map(d => <Tool_ key={d.tool} label={d.label} active={tool === d.tool} disabled={readOnly} onClick={() => onTool(tool === d.tool ? 'select' : d.tool)}>{d.icon}</Tool_>)}
        <Divider />
        <Tool_ label="Bold" hint="Ctrl+B" active={style.bold} disabled={readOnly || !canStyle} onClick={() => onStyle('bold')}><Bold className="w-4 h-4" /></Tool_>
        <Tool_ label="Italic" hint="Ctrl+I" active={style.italic} disabled={readOnly || !canStyle} onClick={() => onStyle('italic')}><Italic className="w-4 h-4" /></Tool_>
        <Tool_ label="Underline" hint="Ctrl+U" active={style.underline} disabled={readOnly || !canStyle} onClick={() => onStyle('underline')}><Underline className="w-4 h-4" /></Tool_>
        <Divider />
        <Tool_ label="Add an idea" hint="Tab" disabled={readOnly} onClick={onAddChild}><Plus className="w-4 h-4" /></Tool_>
        <Tool_ label="Add an idea next to it" hint="Enter" disabled={readOnly || !hasSelection || isRoot} onClick={onAddSibling}><CornerDownRight className="w-4 h-4" /></Tool_>
        <Tool_ label="Edit the text" hint="F2" disabled={readOnly || !hasSelection} onClick={onEdit}><Pencil className="w-4 h-4" /></Tool_>
        <Tool_ label="Colour" disabled={readOnly || !hasSelection || isRoot} onClick={() => toggle('colour')}><Palette className="w-4 h-4" /></Tool_>
        <Tool_ label="Note" disabled={readOnly || !hasSelection} onClick={onNote}><FileText className="w-4 h-4" /></Tool_>
        <Tool_ label="Link a ticket" disabled={readOnly || !hasSelection} onClick={onTicket}><Link2 className="w-4 h-4" /></Tool_>
        <Divider />
        <Tool_ label="Fold every branch" disabled={readOnly} onClick={() => onFold(true)}><ChevronsDownUp className="w-4 h-4" /></Tool_>
        <Tool_ label="Unfold every branch" disabled={readOnly} onClick={() => onFold(false)}><ChevronsUpDown className="w-4 h-4" /></Tool_>
        <Tool_ label="Start from a template" disabled={readOnly} onClick={() => toggle('template')}><LayoutTemplate className="w-4 h-4" /></Tool_>
        <Divider />
        <Tool_ label="Delete" hint="Delete" disabled={readOnly || !hasSelection || isRoot} onClick={onDelete}><Trash2 className="w-4 h-4" /></Tool_>
      </div>
      {menu === 'colour' && (
        <div role="group" aria-label="Colour of the branch" className="absolute left-full top-0 ml-2 bg-white border border-lira-border rounded-2xl p-2 flex flex-wrap gap-1.5 w-40">
          <button type="button" aria-label="Branch colour" title="The colour of its branch" onClick={() => { onColor(undefined); setMenu(null); }} className="w-7 h-7 rounded-lg border border-lira-border text-3xs text-lira-muted cursor-pointer">Auto</button>
          {MIND_COLORS.map(c => <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => { onColor(c); setMenu(null); }} className="w-7 h-7 rounded-lg border border-lira-border cursor-pointer" style={{ backgroundColor: c }} />)}
        </div>
      )}
      {menu === 'template' && (
        <div role="menu" aria-label="Templates" className="absolute left-full top-0 ml-2 bg-white border border-lira-border rounded-2xl p-1.5 w-64 max-h-96 overflow-y-auto">
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
