import React, { useState, useEffect } from 'react';
import {
  FileText, Save, Check, Eye, Edit3, Download,
  Bold, Italic, Heading, List, CheckSquare, Code,
  Trash2, Copy
} from 'lucide-react';
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

## 🚀 Quick Links & Resources
- **Repository**: [GitHub](https://github.com)
- **Design Specs**: Figma workspace
- **Staging URL**: https://staging.example.com

## 📋 Sprint Objectives
- [x] Complete MVP core features
- [ ] Implement space documentation modal
- [ ] Connect drag-and-drop calendar triage

## 💡 Architecture Decisions
1. **Local-first Dexie DB**: IndexedDB storage ensures 100% offline access.
2. **Tailwind CSS**: Strict adherence to Atlassian Jira design tokens.
`;

export const DocumentsModal: React.FC<DocumentsModalProps> = ({
  isOpen,
  onClose,
  space,
}) => {
  const spaceId = space?.id ?? 'global';
  const storageKey = `lira_docs_${spaceId}`;

  const [content, setContent] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [isSaved, setIsSaved] = useState<boolean>(true);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [savedToast, setSavedToast] = useState<boolean>(false);

  // Load documentation from localStorage
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        setContent(saved);
      } else {
        const templated = DEFAULT_DOC_TEMPLATE.replace(
          /\[SPACE_NAME\]/g,
          space?.name || 'Workspace'
        );
        setContent(templated);
        localStorage.setItem(storageKey, templated);
      }
      setIsSaved(true);
    } catch {
      setContent('');
    }
  }, [isOpen, storageKey, space?.name]);

  const handleSave = (newContent?: string) => {
    const textToSave = newContent !== undefined ? newContent : content;
    try {
      localStorage.setItem(storageKey, textToSave);
      setIsSaved(true);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSavedAt(timeStr);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2000);
    } catch (e) {
      console.error('Failed to save document to localStorage', e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsSaved(false);
  };

  // Keyboard shortcut Ctrl+S / Cmd+S
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  // Insert markdown helpers
  const insertMarkdown = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('docs-textarea') as HTMLTextAreaElement | null;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);
    const replacement = `${prefix}${selected || 'text'}${suffix}`;
    const nextContent = text.substring(0, start) + replacement + text.substring(end);
    setContent(nextContent);
    setIsSaved(false);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected.length || 4));
    }, 10);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${space?.key || 'space'}-docs.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    if (window.confirm('Reset this document to the default template? Any unsaved edits will be lost.')) {
      const templated = DEFAULT_DOC_TEMPLATE.replace(/\[SPACE_NAME\]/g, space?.name || 'Workspace');
      setContent(templated);
      handleSave(templated);
    }
  };

  // Basic markdown parsing to HTML without external dependencies
  const renderMarkdown = (md: string) => {
    const lines = md.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('# ')) {
        return <h1 key={idx} className="text-xl font-bold text-jira-text border-b pb-1 mt-3 mb-2">{line.slice(2)}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx} className="text-base font-bold text-jira-text mt-3 mb-1.5">{line.slice(3)}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="text-sm font-bold text-jira-text mt-2 mb-1">{line.slice(4)}</h3>;
      }
      if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
        return (
          <div key={idx} className="flex items-center gap-2 my-0.5 text-xs text-gray-500 line-through">
            <input type="checkbox" checked readOnly className="rounded text-jira-blue" />
            <span>{line.slice(6)}</span>
          </div>
        );
      }
      if (line.startsWith('- [ ] ')) {
        return (
          <div key={idx} className="flex items-center gap-2 my-0.5 text-xs text-jira-text">
            <input type="checkbox" checked={false} readOnly className="rounded text-jira-blue" />
            <span>{line.slice(6)}</span>
          </div>
        );
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <li key={idx} className="text-xs text-jira-text ml-4 list-disc my-0.5">
            {line.slice(2)}
          </li>
        );
      }
      if (/^\d+\.\s/.test(line)) {
        return (
          <li key={idx} className="text-xs text-jira-text ml-4 list-decimal my-0.5">
            {line.replace(/^\d+\.\s/, '')}
          </li>
        );
      }
      if (line.trim() === '') {
        return <div key={idx} className="h-2" />;
      }
      return (
        <p key={idx} className="text-xs text-jira-text leading-relaxed my-1">
          {line}
        </p>
      );
    });
  };

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const chars = content.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Documents & Notes · ${space?.name || 'Workspace'}`}
      size="xl"
    >
      <div className="flex flex-col h-[600px] text-jira-text">
        {/* Header Toolbar */}
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-jira-border bg-gray-50/70 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('edit')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'edit'
                  ? 'bg-jira-blue text-white shadow-xs'
                  : 'text-jira-muted hover:text-jira-text hover:bg-gray-200/60'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Markdown Editor
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'bg-jira-blue text-white shadow-xs'
                  : 'text-jira-muted hover:text-jira-text hover:bg-gray-200/60'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview Document
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {isSaved ? (
              <span className="text-emerald-700 font-medium flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <Check className="w-3.5 h-3.5" /> Saved {lastSavedAt && `at ${lastSavedAt}`}
              </span>
            ) : (
              <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Unsaved changes
              </span>
            )}

            <Button
              variant="primary"
              size="xs"
              onClick={() => handleSave()}
              className="flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </Button>
          </div>
        </div>

        {/* Markdown Action Controls Toolbar (only when editing) */}
        {activeTab === 'edit' && (
          <div className="flex items-center justify-between px-6 py-1.5 border-b border-jira-border bg-white text-xs text-jira-muted flex-shrink-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => insertMarkdown('**', '**')}
                className="p-1.5 hover:bg-gray-100 hover:text-jira-text rounded cursor-pointer"
                title="Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('*', '*')}
                className="p-1.5 hover:bg-gray-100 hover:text-jira-text rounded cursor-pointer"
                title="Italic"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('## ')}
                className="p-1.5 hover:bg-gray-100 hover:text-jira-text rounded cursor-pointer"
                title="Heading"
              >
                <Heading className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-4 bg-jira-border mx-1" />
              <button
                type="button"
                onClick={() => insertMarkdown('- ')}
                className="p-1.5 hover:bg-gray-100 hover:text-jira-text rounded cursor-pointer"
                title="Bullet List"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('- [ ] ')}
                className="p-1.5 hover:bg-gray-100 hover:text-jira-text rounded cursor-pointer"
                title="Checklist Item"
              >
                <CheckSquare className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('```\n', '\n```')}
                className="p-1.5 hover:bg-gray-100 hover:text-jira-text rounded cursor-pointer"
                title="Code Block"
              >
                <Code className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 hover:bg-gray-100 hover:text-jira-text rounded cursor-pointer flex items-center gap-1 text-[11px]"
                title="Copy markdown text"
              >
                <Copy className="w-3 h-3" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="p-1.5 hover:bg-gray-100 hover:text-jira-text rounded cursor-pointer flex items-center gap-1 text-[11px]"
                title="Export as Markdown (.md)"
              >
                <Download className="w-3 h-3" />
                Export .md
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded cursor-pointer flex items-center gap-1 text-[11px]"
                title="Reset note"
              >
                <Trash2 className="w-3 h-3" />
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-hidden p-6 bg-white flex flex-col">
          {activeTab === 'edit' ? (
            <textarea
              id="docs-textarea"
              value={content}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your markdown documentation, sprint plan, or architecture notes here... (Ctrl+S to save)"
              className="w-full flex-1 p-4 font-mono text-xs text-jira-text border border-jira-border rounded-xl resize-none focus:outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue leading-relaxed bg-gray-50/30"
              spellCheck={false}
            />
          ) : (
            <div className="w-full flex-1 p-6 border border-jira-border rounded-xl overflow-y-auto bg-gray-50/20">
              {content.trim() ? (
                renderMarkdown(content)
              ) : (
                <div className="text-center py-16 text-jira-muted">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">This document is empty. Switch to the editor to add notes.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Meta */}
        <div className="px-6 py-2.5 border-t border-jira-border bg-gray-50 flex items-center justify-between text-[11px] text-jira-muted flex-shrink-0">
          <div className="flex items-center gap-3">
            <span>Storage: <strong className="font-mono text-jira-text">{storageKey}</strong></span>
            <span>•</span>
            <span>{words} words</span>
            <span>•</span>
            <span>{chars} characters</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="xs"
              onClick={() => handleSave()}
              className="flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </Button>
            <Button variant="secondary" size="xs" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>

      {/* 2-second green toast */}
      {savedToast && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-xl animate-fade-in pointer-events-none">
          <Check className="w-4 h-4 text-white" />
          <span>Saved ✓</span>
        </div>
      )}
    </Modal>
  );
};
