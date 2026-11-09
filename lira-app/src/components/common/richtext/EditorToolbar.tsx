import React, { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, ListChecks, Quote, Code, Link2, Paperclip,
  Highlighter, Palette, AtSign, Undo2, Redo2, RemoveFormatting, ChevronDown, Check,
} from 'lucide-react';
import { promptDialog } from '../dialogStore';
import { PALETTE } from '../../../theme/palette';

const TEXT_COLORS = [
  { name: 'Default', value: '' }, { name: 'Red', value: PALETTE.critical }, { name: 'Orange', value: PALETTE.orangeDeep }, { name: 'Green', value: PALETTE.successDeep },
  { name: 'Blue', value: PALETTE.brand }, { name: 'Purple', value: PALETTE.purple }, { name: 'Pink', value: '#C026D3' }, { name: 'Gray', value: PALETTE.textMuted },
];
const HIGHLIGHTS = [
  { name: 'None', value: '' }, { name: 'Yellow', value: '#FFF0B3' }, { name: 'Green', value: '#ABF5D1' }, { name: 'Blue', value: '#B3D4FF' },
  { name: 'Pink', value: '#FFBDAD' }, { name: 'Purple', value: '#C0B6F2' },
];


const Btn: React.FC<{ label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }> = ({ label, active, disabled, onClick, children }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    aria-pressed={active}
    disabled={disabled}
    // mouse down must not take the focus away from the text
    onMouseDown={e => e.preventDefault()}
    onClick={onClick}
    className={`p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${active ? 'bg-lira-blue-light text-lira-blue' : 'text-lira-muted hover:bg-gray-100 hover:text-lira-text'}`}
  >
    {children}
  </button>
);

const Sep = () => <span className="w-px h-5 bg-lira-border mx-1 flex-shrink-0" aria-hidden />;

/** A small colour menu used for text colour and highlight. */
const ColorMenu: React.FC<{ label: string; icon: React.ReactNode; colors: { name: string; value: string }[]; current?: string; onPick: (v: string) => void }> = ({ label, icon, colors, current, onPick }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', away, true);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', away, true); document.removeEventListener('keydown', esc, true); };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="true"
        aria-expanded={open}
        onMouseDown={e => e.preventDefault()}
        onClick={() => setOpen(o => !o)}
        className={`p-1.5 rounded-md flex items-center gap-0.5 transition-colors cursor-pointer ${open ? 'bg-gray-100' : 'text-lira-muted hover:bg-gray-100 hover:text-lira-text'}`}
      >
        {icon}
        <span className="w-3 h-1 rounded-sm border border-lira-border" style={{ backgroundColor: current || 'transparent' }} aria-hidden />
      </button>
      {open && (
        <div className="absolute z-40 top-full left-0 mt-1 p-2 bg-white border border-lira-border rounded-xl shadow-xl grid grid-cols-4 gap-1.5 w-[148px]" role="menu" aria-label={label}>
          {colors.map(c => (
            <button
              key={c.name}
              type="button"
              role="menuitem"
              title={c.name}
              aria-label={c.name}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onPick(c.value); setOpen(false); }}
              className="w-7 h-7 rounded-md border border-lira-border flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
              style={{ backgroundColor: c.value || 'transparent' }}
            >
              {!c.value && <span className="text-3xs text-lira-muted">{label.startsWith('Text') ? 'A' : 'x'}</span>}
              {c.value && c.value === current && <Check className="w-3.5 h-3.5 text-white mix-blend-difference" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};


/** Adds, changes or removes the link on the selected text. */
async function editLink(editor: Editor) {
  const previous = editor.getAttributes('link').href as string | undefined;
  const url = await promptDialog({ title: 'Add a link', label: 'Web address', defaultValue: previous ?? 'https://', required: false, confirmLabel: 'Apply' });
  if (url === null) return;
  if (url === '' || url === 'https://') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
  editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
}

/** The name of the paragraph style at the cursor. */
function styleName(editor: Editor): string {
  const level = [1, 2, 3].find(l => editor.isActive('heading', { level: l }));
  return level ? `Heading ${level}` : 'Normal text';
}

/** The "Normal text / Heading 1-3" menu. */
function HeadingMenu({ editor }: { editor: Editor }) {
  const [headingOpen, setHeadingOpen] = useState(false);
  const headingRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!headingOpen) return;
    const away = (e: MouseEvent) => { if (!headingRef.current?.contains(e.target as Node)) setHeadingOpen(false); };
    document.addEventListener('mousedown', away, true);
    return () => document.removeEventListener('mousedown', away, true);
  }, [headingOpen]);

  const heading = styleName(editor);
  return (
    <div className="relative" ref={headingRef}>
  <button
    type="button"
    aria-label="Text style"
    aria-haspopup="true"
    aria-expanded={headingOpen}
    onMouseDown={e => e.preventDefault()}
    onClick={() => setHeadingOpen(o => !o)}
    className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md text-lira-text hover:bg-gray-100 cursor-pointer min-w-[96px] justify-between"
  >
    {heading} <ChevronDown className="w-3 h-3" />
  </button>
  {headingOpen && (
    <div className="absolute z-40 top-full left-0 mt-1 w-44 bg-white border border-lira-border rounded-xl shadow-xl py-1" role="menu">
      {[
        { label: 'Normal text', run: () => editor.chain().focus().setParagraph().run(), cls: 'text-sm' },
        { label: 'Heading 1', run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), cls: 'text-xl font-bold' },
        { label: 'Heading 2', run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), cls: 'text-lg font-bold' },
        { label: 'Heading 3', run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), cls: 'text-base font-semibold' },
      ].map(o => (
        <button key={o.label} type="button" role="menuitem" onMouseDown={e => e.preventDefault()} onClick={() => { o.run(); setHeadingOpen(false); }} className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 text-lira-text cursor-pointer ${o.cls}`}>{o.label}</button>
      ))}
    </div>
  )}
</div>
  );
}

/** The formatting buttons above the writing area. The compact variant (comments) has the short set. */
export function EditorToolbar({ editor, compact, onAttach }: { editor: Editor; compact: boolean; onAttach: () => void }) {
  const textColor = (editor.getAttributes('textStyle').color as string | undefined) || '';
  const highlightColor = (editor.getAttributes('highlight').color as string | undefined) || '';
  return (
  <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-lira-border bg-gray-50/70 rounded-t-lg" role="toolbar" aria-label="Formatting">
    {!compact && <HeadingMenu editor={editor} />}
    {!compact && <Sep />}
    <Btn label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-4 h-4" /></Btn>
    <Btn label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-4 h-4" /></Btn>
    <Btn label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="w-4 h-4" /></Btn>
    <Btn label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="w-4 h-4" /></Btn>
    {!compact && <ColorMenu label="Text colour" icon={<Palette className="w-4 h-4" />} colors={TEXT_COLORS} current={textColor} onPick={v => (v ? editor.chain().focus().setColor(v).run() : editor.chain().focus().unsetColor().run())} />}
    {!compact && <ColorMenu label="Highlight" icon={<Highlighter className="w-4 h-4" />} colors={HIGHLIGHTS} current={highlightColor} onPick={v => (v ? editor.chain().focus().setHighlight({ color: v }).run() : editor.chain().focus().unsetHighlight().run())} />}
    <Sep />
    <Btn label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-4 h-4" /></Btn>
    <Btn label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></Btn>
    <Btn label="Checkbox list" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks className="w-4 h-4" /></Btn>
    {!compact && <Btn label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="w-4 h-4" /></Btn>}
    {!compact && <Btn label="Code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}><Code className="w-4 h-4" /></Btn>}
    <Btn label="Link" active={editor.isActive('link')} onClick={() => { void editLink(editor); }}><Link2 className="w-4 h-4" /></Btn>
    <Sep />
    <Btn label="Mention someone (@)" onClick={() => editor.chain().focus().insertContent('@').run()}><AtSign className="w-4 h-4" /></Btn>
    <Btn label="Add attachment" onClick={onAttach}><Paperclip className="w-4 h-4" /></Btn>
    {!compact && <Sep />}
    {!compact && <Btn label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><RemoveFormatting className="w-4 h-4" /></Btn>}
    <Btn label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="w-4 h-4" /></Btn>
    <Btn label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="w-4 h-4" /></Btn>
  </div>
  );
}
