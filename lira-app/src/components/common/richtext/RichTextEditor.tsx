import { AttachPicker } from '../../issue/AttachPicker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import Mention from '@tiptap/extension-mention';
import Image from '@tiptap/extension-image';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, ListChecks, Quote, Code, Link2, Paperclip,
  Highlighter, Palette, AtSign, Undo2, Redo2, RemoveFormatting, ChevronDown, Check,
} from 'lucide-react';
import type { Attachment } from '../../../types/issue';
import { toEditorHtml, toStoredHtml } from '../../../utils/richText';
import { downloadAttachment, readAttachment } from '../../../utils/attachments';
import { alertDialog, promptDialog } from '../dialogs';
import { mentionSuggestion } from './mentions';

/** An image that remembers which attachment it shows, so the picture is stored once (in the attachment) and not twice. */
const AttachmentImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      attachmentId: {
        default: null,
        parseHTML: el => el.getAttribute('data-attachment-id'),
        renderHTML: attrs => (attrs.attachmentId ? { 'data-attachment-id': attrs.attachmentId as string } : {}),
      },
    };
  },
});

const TEXT_COLORS = [
  { name: 'Default', value: '' }, { name: 'Red', value: '#DE350B' }, { name: 'Orange', value: '#FF8B00' }, { name: 'Green', value: '#00875A' },
  { name: 'Blue', value: '#0052CC' }, { name: 'Purple', value: '#6554C0' }, { name: 'Pink', value: '#C026D3' }, { name: 'Gray', value: '#6B778C' },
];
const HIGHLIGHTS = [
  { name: 'None', value: '' }, { name: 'Yellow', value: '#FFF0B3' }, { name: 'Green', value: '#ABF5D1' }, { name: 'Blue', value: '#B3D4FF' },
  { name: 'Pink', value: '#FFBDAD' }, { name: 'Purple', value: '#C0B6F2' },
];

interface RichTextEditorProps {
  /** The stored description (HTML from this editor, or older Markdown). */
  value: string;
  onChange: (stored: string) => void;
  /** The ticket's attachments. Files added in the description are added here too. */
  attachments?: Attachment[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  placeholder?: string;
  /** Height of the writing area when empty, in pixels. */
  minHeight?: number;
  autoFocus?: boolean;
  /** `compact` is the short toolbar used for comments. */
  variant?: 'full' | 'compact';
  /** Show the text only (no toolbar, not editable). Used to display saved comments. */
  readOnly?: boolean;
  ariaLabel?: string;
  /** Called on Ctrl+Enter. */
  onSubmit?: () => void;
}

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
              {!c.value && <span className="text-[10px] text-lira-muted">{label.startsWith('Text') ? 'A' : 'x'}</span>}
              {c.value && c.value === current && <Check className="w-3.5 h-3.5 text-white mix-blend-difference" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * The description editor: headings, bold, italic, underline, strikethrough, bullet / numbered / checkbox lists, quotes,
 * code, links, text colour, highlight, @mentions, and files (pictures appear in the text and every file joins the
 * ticket's attachments).
 */
export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value, onChange, attachments = [], onAttachmentsChange, placeholder = 'Add a description...', minHeight = 140, autoFocus,
  variant = 'full', readOnly = false, ariaLabel = 'Description', onSubmit,
}) => {
  const compact = variant === 'compact';
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onAttachRef = useRef(onAttachmentsChange);
  onAttachRef.current = onAttachmentsChange;
  const lastEmitted = useRef<string>(value);
  const [headingOpen, setHeadingOpen] = useState(false);
  const headingRef = useRef<HTMLDivElement>(null);

  // attachments (files, pictures, links) go into the text at the cursor, and join the ticket's attachments
  const insertAttachments = useCallback(async (items: Attachment[], editor: Editor | null) => {
    if (!items.length || !editor) return;
    const tooBig: string[] = [];
    for (const attachment of items) {
      if (attachment.url) {
        editor.chain().focus().insertContent([
          { type: 'text', text: attachment.name, marks: [{ type: 'link', attrs: { href: attachment.url } }] },
          { type: 'text', text: ' ' },
        ]).run();
      } else if (attachment.type.startsWith('image/') && attachment.dataUrl) {
        editor.chain().focus().insertContent({ type: 'image', attrs: { src: attachment.dataUrl, alt: attachment.name, attachmentId: attachment.id } }).run();
      } else {
        if (!attachment.dataUrl) tooBig.push(attachment.name);
        editor.chain().focus().insertContent([
          { type: 'text', text: attachment.name, marks: [{ type: 'link', attrs: { href: `#attachment-${attachment.id}` } }] },
          { type: 'text', text: ' ' },
        ]).run();
      }
    }
    onAttachRef.current?.([...attachmentsRef.current, ...items]);
    if (tooBig.length) {
      await alertDialog({
        title: 'File not stored',
        message: `${tooBig.join(', ')} ${tooBig.length === 1 ? 'is' : 'are'} bigger than 2 MB. The name is kept in the text, but the file itself is not stored in Lira.`,
      });
    }
  }, []);

  // files from a drop or a paste (a pasted screenshot is always called "image.png": give each one its own name)
  const addFiles = useCallback(async (files: File[], editor: Editor | null) => {
    if (!files.length || !editor) return;
    const items: Attachment[] = [];
    for (const f of files) {
      const named = /^image\.(png|jpe?g|gif|webp)$/i.test(f.name) ? new File([f], `screenshot-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)}.${f.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'}`, { type: f.type }) : f;
      items.push((await readAttachment(named)).attachment);
    }
    await insertAttachments(items, editor);
  }, [insertAttachments]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } },
      }),
      Placeholder.configure({ placeholder }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Mention.configure({ HTMLAttributes: { class: 'lira-mention' }, suggestion: mentionSuggestion }),
      AttachmentImage.configure({ allowBase64: true, inline: false }),
    ],
    content: toEditorHtml(value, attachments),
    editable: !readOnly,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: { class: 'lira-rich-body', style: `min-height:${readOnly ? 0 : minHeight}px`, 'aria-label': ariaLabel, role: 'textbox', 'aria-multiline': 'true' },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && onSubmitRef.current) { event.preventDefault(); onSubmitRef.current(); return true; }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []);
        if (!files.length) return false;
        event.preventDefault();
        void addFilesRef.current(files);
        return true;
      },
      handlePaste: (_view, event) => {
        // a screenshot or copied picture: take it from the files, or from the clipboard items
        const cd = event.clipboardData;
        let files = Array.from(cd?.files ?? []);
        if (!files.length) files = Array.from(cd?.items ?? []).filter(i => i.kind === 'file').map(i => i.getAsFile()).filter((f): f is File => !!f);
        if (!files.length) return false;
        event.preventDefault();
        void addFilesRef.current(files);
        return true;
      },
      handleClick: (_view, _pos, event) => {
        const a = (event.target as HTMLElement | null)?.closest?.('a[href^="#attachment-"]');
        if (!a) return false;
        event.preventDefault();
        const id = a.getAttribute('href')!.slice('#attachment-'.length);
        const att = attachmentsRef.current.find(x => x.id === id);
        if (att && !downloadAttachment(att)) void alertDialog({ title: 'File not stored', message: `${att.name} was too big to store in Lira, so it cannot be downloaded.` });
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const stored = toStoredHtml(ed.getHTML());
      lastEmitted.current = stored;
      onChangeRef.current(stored);
    },
  });

  // switching between reading and editing must not need a new editor
  useEffect(() => { if (editor && editor.isEditable === readOnly) editor.setEditable(!readOnly); }, [editor, readOnly]);

  const addFilesRef = useRef<(files: File[]) => Promise<void>>(async () => {});
  addFilesRef.current = (files: File[]) => addFiles(files, editor);
  const [pickerOpen, setPickerOpen] = useState(false);

  // a different ticket (or a reset) arrives from outside
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    lastEmitted.current = value;
    editor.commands.setContent(toEditorHtml(value, attachmentsRef.current), { emitUpdate: false });
  }, [value, editor]);

  useEffect(() => {
    if (!headingOpen) return;
    const away = (e: MouseEvent) => { if (!headingRef.current?.contains(e.target as Node)) setHeadingOpen(false); };
    document.addEventListener('mousedown', away, true);
    return () => document.removeEventListener('mousedown', away, true);
  }, [headingOpen]);

  if (!editor) return <div className="rounded-lg border border-lira-border h-[200px] animate-pulse bg-gray-50" aria-busy />;
  if (readOnly) return <div className="lira-rich lira-rich-readonly" data-testid="rich-view"><EditorContent editor={editor} /></div>;

  const setLink = async () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = await promptDialog({ title: 'Add a link', label: 'Web address', defaultValue: previous ?? 'https://', required: false, confirmLabel: 'Apply' });
    if (url === null) return;
    if (url === '' || url === 'https://') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const heading = editor.isActive('heading', { level: 1 }) ? 'Heading 1' : editor.isActive('heading', { level: 2 }) ? 'Heading 2' : editor.isActive('heading', { level: 3 }) ? 'Heading 3' : 'Normal text';
  const textColor = (editor.getAttributes('textStyle').color as string | undefined) || '';
  const highlightColor = (editor.getAttributes('highlight').color as string | undefined) || '';

  return (
    <div className="lira-rich rounded-lg border border-lira-border bg-white focus-within:border-lira-blue focus-within:ring-1 focus-within:ring-lira-blue transition-all" data-testid="rich-editor">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-lira-border bg-gray-50/70 rounded-t-lg" role="toolbar" aria-label="Formatting">
        {!compact && <div className="relative" ref={headingRef}>
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
        </div>}
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
        <Btn label="Link" active={editor.isActive('link')} onClick={() => { void setLink(); }}><Link2 className="w-4 h-4" /></Btn>
        <Sep />
        <Btn label="Mention someone (@)" onClick={() => editor.chain().focus().insertContent('@').run()}><AtSign className="w-4 h-4" /></Btn>
        <Btn label="Add attachment" onClick={() => setPickerOpen(true)}><Paperclip className="w-4 h-4" /></Btn>
        {!compact && <Sep />}
        {!compact && <Btn label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><RemoveFormatting className="w-4 h-4" /></Btn>}
        <Btn label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="w-4 h-4" /></Btn>
        <Btn label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="w-4 h-4" /></Btn>
      </div>
      <AttachPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onAdd={items => { void insertAttachments(items, editor); }} />
      <EditorContent editor={editor} className={`${compact ? 'max-h-[260px]' : 'max-h-[420px]'} overflow-y-auto px-3 py-2.5`} />
    </div>
  );
};
