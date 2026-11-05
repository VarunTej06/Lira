import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud, File, FileText, Image as ImageIcon,
  Trash2, Download, Paperclip, CheckCircle2
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { Space } from '../../types/space';

interface AttachmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space | undefined;
}

export interface AttachmentItem {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  previewUrl?: string;
}

function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const SAMPLE_ATTACHMENTS: AttachmentItem[] = [
  {
    id: 'att-1',
    name: 'architecture_diagram_v2.png',
    size: 245760,
    type: 'image/png',
    uploadedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'att-2',
    name: 'sprint_4_requirements.pdf',
    size: 1048576,
    type: 'application/pdf',
    uploadedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

export const AttachmentsModal: React.FC<AttachmentsModalProps> = ({
  isOpen,
  onClose,
  space,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploadToast, setUploadToast] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  const storageKey = `lira_attachments_${space?.id ?? 'global'}`;

  // Load from state / localStorage on open
  useEffect(() => {
    if (!isOpen) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAttachments(parsed);
          return;
        }
      }
      setAttachments(SAMPLE_ATTACHMENTS);
      localStorage.setItem(storageKey, JSON.stringify(SAMPLE_ATTACHMENTS));
    } catch {
      setAttachments(SAMPLE_ATTACHMENTS);
    }
  }, [isOpen, storageKey]);

  const saveAttachments = (items: AttachmentItem[]) => {
    setAttachments(items);
    try {
      const cleanMetadata = items.map(a => ({
        id: a.id,
        name: a.name,
        size: a.size,
        type: a.type,
        uploadedAt: a.uploadedAt,
      }));
      localStorage.setItem(storageKey, JSON.stringify(cleanMetadata));
    } catch (e) {
      console.error('Failed to save attachments to localStorage', e);
    }
  };

  const handleSaveExplicit = () => {
    saveAttachments(attachments);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  const processFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newItems: AttachmentItem[] = [];
    Array.from(fileList).forEach(file => {
      let previewUrl: string | undefined = undefined;
      if (file.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file);
      }

      newItems.push({
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        previewUrl,
      });
    });

    const updated = [...newItems, ...attachments];
    saveAttachments(updated);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
    setUploadToast(`Added ${newItems.length} file${newItems.length > 1 ? 's' : ''}!`);
    setTimeout(() => setUploadToast(null), 2500);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = (id: string) => {
    const item = attachments.find(a => a.id === id);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    const updated = attachments.filter(a => a.id !== id);
    saveAttachments(updated);
  };

  const handleClearAll = () => {
    if (!window.confirm('Clear all attachments for this space?')) return;
    attachments.forEach(a => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); });
    saveAttachments([]);
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-indigo-500" />;
    if (type.includes('pdf') || type.includes('text') || type.includes('doc')) return <FileText className="w-5 h-5 text-amber-500" />;
    return <File className="w-5 h-5 text-blue-500" />;
  };

  const totalBytes = attachments.reduce((sum, item) => sum + item.size, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Space Attachments · ${space?.name || 'Workspace'}`}
      size="lg"
    >
      <div className="flex flex-col h-[560px] text-jira-text">
        {/* Upload Dropzone */}
        <div className="p-6 pb-4 flex-shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            multiple
            className="hidden"
          />

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all select-none
              ${isDraggingOver
                ? 'border-jira-blue bg-blue-50/80 ring-4 ring-jira-blue/15 scale-[1.01]'
                : 'border-jira-border bg-gray-50/60 hover:bg-gray-100/60 hover:border-jira-blue/60'
              }
            `}
          >
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 bg-white rounded-full shadow-xs border border-jira-border text-jira-blue">
                <UploadCloud className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-semibold text-jira-text">
                  Drop files to upload or <span className="text-jira-blue hover:underline">browse</span>
                </p>
                <p className="text-xs text-jira-muted mt-0.5">
                  Supports images, documents, PDFs, specifications (unlimited local storage)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Upload feedback */}
        {uploadToast && (
          <div className="mx-6 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-2 flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {uploadToast}
          </div>
        )}

        {/* Header summary row */}
        <div className="px-6 py-2 flex items-center justify-between text-xs text-jira-muted border-b border-jira-border flex-shrink-0">
          <div className="flex items-center gap-2 font-medium">
            <Paperclip className="w-3.5 h-3.5 text-jira-muted" />
            <span>Files ({attachments.length})</span>
            <span>•</span>
            <span>Total size: {formatBytes(totalBytes)}</span>
          </div>

          {attachments.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-jira-muted hover:text-red-600 transition-colors cursor-pointer text-xs font-medium"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Preview List */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
          {attachments.length === 0 ? (
            <div className="text-center py-12 text-jira-muted">
              <File className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-medium">No attachments uploaded yet</p>
              <p className="text-[11px] text-jira-muted mt-0.5">Drop files into the zone above to attach to this space.</p>
            </div>
          ) : (
            attachments.map(att => (
              <div
                key={att.id}
                className="flex items-center justify-between p-3 border border-jira-border rounded-xl hover:border-jira-blue/40 hover:bg-gray-50/50 transition-all group bg-white shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                  {/* Thumbnail preview if image, otherwise type icon */}
                  {att.previewUrl ? (
                    <img
                      src={att.previewUrl}
                      alt={att.name}
                      className="w-10 h-10 rounded-lg object-cover border border-jira-border flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-50 border border-jira-border flex items-center justify-center flex-shrink-0">
                      {getFileIcon(att.type)}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-bold text-jira-text truncate group-hover:text-jira-blue transition-colors" title={att.name}>
                      {att.name}
                    </h5>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-jira-muted">
                      <span>{formatBytes(att.size)}</span>
                      <span>•</span>
                      <span>{new Date(att.uploadedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {att.previewUrl && (
                    <a
                      href={att.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-jira-muted hover:text-jira-blue rounded-lg hover:bg-gray-100 transition-colors"
                      title="Open image in new tab"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(att.id)}
                    className="p-1.5 text-jira-muted hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                    title="Delete attachment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-jira-border bg-gray-50 flex items-center justify-between text-xs flex-shrink-0">
          <span className="text-jira-muted text-[11px]">
            Storage: <strong className="font-mono text-jira-text">{storageKey}</strong>
          </span>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={handleSaveExplicit}>
              Save Attachments
            </Button>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>

      {/* 2-second green toast */}
      {savedToast && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-xl animate-fade-in pointer-events-none">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>✓ Saved</span>
        </div>
      )}
    </Modal>
  );
};
