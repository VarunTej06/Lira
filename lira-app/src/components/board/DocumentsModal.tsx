import { notifySaved } from '../common/savedToastStore';
import { confirmDialog } from '../common/dialogStore';
import React, { useState, useRef } from 'react';
import { FileText, Save, Check, Eye, Edit3, Download, Bold, Italic, Heading, List, CheckSquare, Code, Trash2, Copy } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { Space } from '../../types/space';
import { MarkdownPreview } from './MarkdownPreview';
import { useDocumentNotes } from './useDocumentNotes';
import { wordCount, wrapSelection } from './docsText';

interface DocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space | undefined;
}

/** Formatting buttons: [title, icon, text before the selection, text after it]. */
const FORMAT_BUTTONS = [
  ['Bold', Bold, '**', '**'],
  ['Italic', Italic, '*', '*'],
  ['Heading', Heading, '## ', ''],
  null,
  ['Bullet List', List, '- ', ''],
  ['Checklist Item', CheckSquare, '- [ ] ', ''],
  ['Code Block', Code, '```\n', '\n```'],
] as const;

const TAB = 'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5';
const TOOL = 'p-1.5 hover:bg-gray-100 hover:text-lira-text rounded cursor-pointer';
const ACTION = 'p-1.5 hover:bg-gray-100 hover:text-lira-text rounded cursor-pointer flex items-center gap-1 text-2xs';

/** "Saved at 10:32" or "Unsaved changes". */
function SaveStatus({ saved, at }: { saved: boolean; at: string | null }) {
  if (!saved) return <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Unsaved changes</span>;
  return (
    <span className="text-emerald-700 font-medium flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
      <Check className="w-3.5 h-3.5" /> Saved {at && `at ${at}`}
    </span>
  );
}

/** The formatting buttons on the left; copy, export and reset on the right. */
function EditorToolbar({ copied, onFormat, onCopy, onExport, onReset }: { copied: boolean; onFormat: (before: string, after: string) => void; onCopy: () => void; onExport: () => void; onReset: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 py-1.5 border-b border-lira-border bg-white text-xs text-lira-muted flex-shrink-0">
      <div className="flex items-center gap-1">
        {FORMAT_BUTTONS.map((b, i) => b === null
          ? <div key={i} className="w-px h-4 bg-lira-border mx-1" />
          : <button key={b[0]} type="button" onClick={() => onFormat(b[2], b[3])} className={TOOL} title={b[0]}>{React.createElement(b[1], { className: 'w-3.5 h-3.5' })}</button>)}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onCopy} className={ACTION} title="Copy markdown text"><Copy className="w-3 h-3" />{copied ? 'Copied!' : 'Copy'}</button>
        <button type="button" onClick={onExport} className={ACTION} title="Export as Markdown (.md)"><Download className="w-3 h-3" />Export .md</button>
        <button type="button" onClick={onReset} className={`${ACTION} hover:bg-red-50 hover:text-red-600`} title="Reset note"><Trash2 className="w-3 h-3" />Reset</button>
      </div>
    </div>
  );
}

function EmptyDocument() {
  return (
    <div className="text-center py-16 text-lira-muted">
      <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
      <p className="text-xs">This document is empty. Switch to the editor to add notes.</p>
    </div>
  );
}

export const DocumentsModal: React.FC<DocumentsModalProps> = ({ isOpen, onClose, space }) => {
  const storageKey = `lira_docs_${space?.id ?? 'global'}`;
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [copied, setCopied] = useState(false);
  const { content, saved, lastSavedAt, edit, save, reset } = useDocumentNotes(isOpen, storageKey, space?.name);

  /** Saves when there is something to save (and says so); the Save buttons also close the window, Ctrl+S does not. */
  const saveAndClose = (close = true) => {
    if (!saved) { save(); notifySaved('Document saved'); }
    if (close) onClose();
  };

  /** Wraps the selected text (or the word "text") in the given marks, then puts the cursor back on it. */
  const insertMarkdown = (before: string, after = '') => {
    const el = textarea.current;
    if (!el) return;
    const next = wrapSelection(el.value, el.selectionStart, el.selectionEnd, before, after);
    edit(next.text);
    setTimeout(() => { el.focus(); el.setSelectionRange(next.selectStart, next.selectEnd); }, 10);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${space?.key || 'space'}-docs.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const askReset = async () => {
    if (await confirmDialog({ title: 'Reset document', message: 'Reset this document to the default template? Any unsaved edits will be lost.', confirmLabel: 'Reset', tone: 'danger' })) reset();
  };

  const saveButton = (
    <Button variant="primary" size="xs" onClick={() => saveAndClose()} className="flex items-center gap-1"><Save className="w-3.5 h-3.5" />Save</Button>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Documents & Notes · ${space?.name || 'Workspace'}`} size="xl">
      <div className="flex flex-col h-[600px] text-lira-text">
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-lira-border bg-gray-50/70 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            {([['edit', Edit3, 'Markdown Editor'], ['preview', Eye, 'Preview Document']] as const).map(([tab, Icon, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`${TAB} ${activeTab === tab ? 'bg-lira-blue text-lira-on-blue shadow-xs' : 'text-lira-muted hover:text-lira-text hover:bg-gray-200/60'}`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <SaveStatus saved={saved} at={lastSavedAt} />
            {saveButton}
          </div>
        </div>

        {activeTab === 'edit' && <EditorToolbar copied={copied} onFormat={insertMarkdown} onCopy={copy} onExport={download} onReset={() => void askReset()} />}

        <div className="flex-1 overflow-hidden p-6 bg-white flex flex-col">
          {activeTab === 'edit' ? (
            <textarea
              ref={textarea}
              id="docs-textarea"
              value={content}
              onChange={e => edit(e.target.value)}
              onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveAndClose(false); } }}
              placeholder="Type your markdown documentation, sprint plan, or architecture notes here... (Ctrl+S to save)"
              className="w-full flex-1 p-4 font-mono text-xs text-lira-text border border-lira-border rounded-xl resize-none focus:outline-none focus:border-lira-blue focus:ring-1 focus:ring-lira-blue leading-relaxed bg-gray-50/30"
              spellCheck={false}
            />
          ) : (
            <div className="w-full flex-1 p-6 border border-lira-border rounded-xl overflow-y-auto bg-gray-50/20">
              {content.trim() ? <MarkdownPreview text={content} /> : <EmptyDocument />}
            </div>
          )}
        </div>

        <div className="px-6 py-2.5 border-t border-lira-border bg-gray-50 flex items-center justify-between text-2xs text-lira-muted flex-shrink-0">
          <div className="flex items-center gap-3">
            <span>Storage: <strong className="font-mono text-lira-text">{storageKey}</strong></span>
            <span>•</span><span>{wordCount(content)} words</span><span>•</span><span>{content.length} characters</span>
          </div>
          <div className="flex items-center gap-2">
            {saveButton}
            <Button variant="secondary" size="xs" onClick={onClose}>Done</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
