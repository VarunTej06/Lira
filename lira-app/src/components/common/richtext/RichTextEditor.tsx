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
import type { Attachment } from '../../../types/issue';
import { toEditorHtml, toStoredHtml } from '../../../utils/richText';
import { downloadAttachment, readAttachment } from '../../../utils/attachments';
import { alertDialog } from '../dialogStore';
import { mentionSuggestion } from './mentions';
import { EditorToolbar } from './EditorToolbar';
import { insertAttachment, screenshotName } from './editorAttachments';
import { useLatest } from '../../../hooks/useLatest';


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
  const onSubmitRef = useLatest(onSubmit);
  const attachmentsRef = useLatest(attachments);
  const onChangeRef = useLatest(onChange);
  const onAttachRef = useLatest(onAttachmentsChange);
  const lastEmitted = useRef<string>(value);

  // attachments (files, pictures, links) go into the text at the cursor, and join the ticket's attachments
  const insertAttachments = useCallback(async (items: Attachment[], editor: Editor | null) => {
    if (!items.length || !editor) return;
    const tooBig = items.filter(attachment => insertAttachment(editor, attachment)).map(a => a.name);
    onAttachRef.current?.([...attachmentsRef.current, ...items]);
    if (tooBig.length) {
      await alertDialog({
        title: 'File not stored',
        message: `${tooBig.join(', ')} ${tooBig.length === 1 ? 'is' : 'are'} bigger than 2 MB. The name is kept in the text, but the file itself is not stored in Lira.`,
      });
    }
  }, [attachmentsRef, onAttachRef]);

  // files from a drop or a paste (a pasted screenshot is always called "image.png": give each one its own name)
  const addFiles = useCallback(async (files: File[], editor: Editor | null) => {
    if (!files.length || !editor) return;
    const items: Attachment[] = [];
    for (const f of files) {
      const named = screenshotName(f);
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

  const addFilesRef = useLatest((files: File[]) => addFiles(files, editor));
  const [pickerOpen, setPickerOpen] = useState(false);

  // a different ticket (or a reset) arrives from outside
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    lastEmitted.current = value;
    editor.commands.setContent(toEditorHtml(value, attachmentsRef.current), { emitUpdate: false });
  }, [value, editor, attachmentsRef]);

  if (!editor) return <div className="rounded-lg border border-lira-border h-[200px] animate-pulse bg-gray-50" aria-busy />;
  if (readOnly) return <div className="lira-rich lira-rich-readonly" data-testid="rich-view"><EditorContent editor={editor} /></div>;

  return (
    <div className="lira-rich rounded-lg border border-lira-border bg-white focus-within:border-lira-blue focus-within:ring-1 focus-within:ring-lira-blue transition-all" data-testid="rich-editor">
      <EditorToolbar editor={editor} compact={compact} onAttach={() => setPickerOpen(true)} />
      <AttachPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onAdd={items => { void insertAttachments(items, editor); }} />
      <EditorContent editor={editor} className={`${compact ? 'max-h-[260px]' : 'max-h-[420px]'} overflow-y-auto px-3 py-2.5`} />
    </div>
  );
};
