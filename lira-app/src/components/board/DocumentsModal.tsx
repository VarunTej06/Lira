import { notifySaved } from '../common/SavedToast';
import { confirmDialog } from '../common/dialogs';
import React, { useState, useEffect, useRef } from 'react';
import { FileText, Save, Check, Eye, Edit3, Download, Bold, Italic, Heading, List, CheckSquare, Code, Trash2, Copy } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { Space } from '../../types/space';

interface DocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space | undefined;
}

const DEFAULT_DOC_TEMPLATE = `# Space Documentation & Notes

Welcome to the project documentation space for **[SPACE_NAME]**.
Keep your architecture decisions, sprint notes, and links here.

## Quick Links & Resources
- **Repository**: [GitHub](https://github.com)
- **Design Specs**: Figma workspace
- **Staging URL**: https://staging.example.com

## Sprint Objectives
- [x] Complete MVP core features
- [ ] Implement space documentation modal
- [ ] Connect drag-and-drop calendar triage

## Architecture Decisions
1. **Local-first Dexie DB**: IndexedDB storage ensures 100% offline access.
2. **Tailwind CSS**: Strict adherence to the Lira design tokens.
`;

const templateFor = (spaceName: string | undefined) => DEFAULT_DOC_TEMPLATE.replace(/\[SPACE_NAME\]/g, spaceName || 'Workspace');

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

/** A small reader for the notes: headings, checklists, bullets, numbers and paragraphs. */
function MarkdownPreview({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, idx) => {
        if (line.startsWith('### ')) return <h3 key={idx} className="text-sm font-bold text-lira-text mt-2 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith('## ')) return <h2 key={idx} className="text-base font-bold text-lira-text mt-3 mb-1.5">{line.slice(3)}</h2>;
        if (line.startsWith('# ')) return <h1 key={idx} className="text-xl font-bold text-lira-text border-b pb-1 mt-3 mb-2">{line.slice(2)}</h1>;
        const check = /^- \[([ xX])\] /.exec(line);
        if (check) {
          const done = check[1] !== ' ';
          return (
            <div key={idx} className={`flex items-center gap-2 my-0.5 text-xs ${done ? 'text-gray-500 line-through' : 'text-lira-text'}`}>
              <input type="checkbox" checked={done} readOnly className="rounded text-lira-blue" />
              <span>{line.slice(6)}</span>
            </div>
          );
        }
        if (/^[-*] /.test(line)) return <li key={idx} className="text-xs text-lira-text ml-4 list-disc my-0.5">{line.slice(2)}</li>;
        if (/^\d+\.\s/.test(line)) return <li key={idx} className="text-xs text-lira-text ml-4 list-decimal my-0.5">{line.replace(/^\d+\.\s/, '')}</li>;
        if (line.trim() === '') return <div key={idx} className="h-2" />;
        return <p key={idx} className="text-xs text-lira-text leading-relaxed my-1">{line}</p>;
      })}
    </>
  );
}

const TAB = 'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5';
const TOOL = 'p-1.5 hover:bg-gray-100 hover:text-lira-text rounded cursor-pointer';
const ACTION = 'p-1.5 hover:bg-gray-100 hover:text-lira-text rounded cursor-pointer flex items-center gap-1 text-[11px]';

export const DocumentsModal: React.FC<DocumentsModalProps> = ({ isOpen, onClose, space }) => {
  const storageKey = `lira_docs_${space?.id ?? 'global'}`;
  const textarea = useRef<HTMLTextAreaElement>(null);

  const [content, setContent] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [isSaved, setIsSaved] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load the notes (or the template the first time)
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(storageKey);
      const text = saved ?? templateFor(space?.name);
      if (saved === null) localStorage.setItem(storageKey, text);
      setContent(text);
      setIsSaved(true);
    } catch {
      setContent('');
    }
  }, [isOpen, storageKey, space?.name]);

  const save = (text = content) => {
    try {
      localStorage.setItem(storageKey, text);
      setIsSaved(true);
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      console.error('Failed to save document to localStorage', e);
    }
  };
  /** Saves when there is something to save (and says so); the Save buttons also close the window, Ctrl+S does not. */
  const saveAndClose = (close = true) => {
    if (!isSaved) { save(); notifySaved('Document saved'); }
    if (close) onClose();
  };

  /** Wraps the selected text (or the word "text") in the given marks, then puts the cursor back on it. */
  const insertMarkdown = (before: string, after = '') => {
    const el = textarea.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end, value } = el;
    const selected = value.slice(start, end);
    setContent(value.slice(0, start) + before + (selected || 'text') + after + value.slice(end));
    setIsSaved(false);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + before.length, start + before.length + (selected.length || 4)); }, 10);
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

  const reset = async () => {
    if (await confirmDialog({ title: 'Reset document', message: 'Reset this document to the default template? Any unsaved edits will be lost.', confirmLabel: 'Reset', tone: 'danger' })) {
      const text = templateFor(space?.name);
      setContent(text);
      save(text);
    }
  };

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const saveButton = (
    <Button variant="primary" size="xs" onClick={() => saveAndClose()} className="flex items-center gap-1"><Save className="w-3.5 h-3.5" />Save</Button>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Documents & Notes · ${space?.name || 'Workspace'}`} size="xl">
      <div className="flex flex-col h-[600px] text-lira-text">
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-lira-border bg-gray-50/70 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            {([['edit', Edit3, 'Markdown Editor'], ['preview', Eye, 'Preview Document']] as const).map(([tab, Icon, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`${TAB} ${activeTab === tab ? 'bg-lira-blue text-white shadow-xs' : 'text-lira-muted hover:text-lira-text hover:bg-gray-200/60'}`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs">
            {isSaved ? (
              <span className="text-emerald-700 font-medium flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <Check className="w-3.5 h-3.5" /> Saved {lastSavedAt && `at ${lastSavedAt}`}
              </span>
            ) : (
              <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Unsaved changes</span>
            )}
            {saveButton}
          </div>
        </div>

        {activeTab === 'edit' && (
          <div className="flex items-center justify-between px-6 py-1.5 border-b border-lira-border bg-white text-xs text-lira-muted flex-shrink-0">
            <div className="flex items-center gap-1">
              {FORMAT_BUTTONS.map((b, i) => b === null
                ? <div key={i} className="w-px h-4 bg-lira-border mx-1" />
                : <button key={b[0]} type="button" onClick={() => insertMarkdown(b[2], b[3])} className={TOOL} title={b[0]}>{React.createElement(b[1], { className: 'w-3.5 h-3.5' })}</button>)}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={copy} className={ACTION} title="Copy markdown text"><Copy className="w-3 h-3" />{copied ? 'Copied!' : 'Copy'}</button>
              <button type="button" onClick={download} className={ACTION} title="Export as Markdown (.md)"><Download className="w-3 h-3" />Export .md</button>
              <button type="button" onClick={reset} className={`${ACTION} hover:bg-red-50 hover:text-red-600`} title="Reset note"><Trash2 className="w-3 h-3" />Reset</button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden p-6 bg-white flex flex-col">
          {activeTab === 'edit' ? (
            <textarea
              ref={textarea}
              id="docs-textarea"
              value={content}
              onChange={e => { setContent(e.target.value); setIsSaved(false); }}
              onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveAndClose(false); } }}
              placeholder="Type your markdown documentation, sprint plan, or architecture notes here... (Ctrl+S to save)"
              className="w-full flex-1 p-4 font-mono text-xs text-lira-text border border-lira-border rounded-xl resize-none focus:outline-none focus:border-lira-blue focus:ring-1 focus:ring-lira-blue leading-relaxed bg-gray-50/30"
              spellCheck={false}
            />
          ) : (
            <div className="w-full flex-1 p-6 border border-lira-border rounded-xl overflow-y-auto bg-gray-50/20">
              {content.trim() ? <MarkdownPreview text={content} /> : (
                <div className="text-center py-16 text-lira-muted">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">This document is empty. Switch to the editor to add notes.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-2.5 border-t border-lira-border bg-gray-50 flex items-center justify-between text-[11px] text-lira-muted flex-shrink-0">
          <div className="flex items-center gap-3">
            <span>Storage: <strong className="font-mono text-lira-text">{storageKey}</strong></span>
            <span>•</span><span>{words} words</span><span>•</span><span>{content.length} characters</span>
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
