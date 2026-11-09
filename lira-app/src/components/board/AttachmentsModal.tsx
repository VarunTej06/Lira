import { confirmDialog } from '../common/dialogs';
import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, File, FileText, Image as ImageIcon, Trash2, Download, Paperclip, CheckCircle2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { Space } from '../../types/space';

interface AttachmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space | undefined;
}

interface AttachmentItem {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  previewUrl?: string;
}

/** Sizes as people read them: 245.8 KB, 1 MB (no trailing .0). */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${parseFloat((bytes / 1024 ** i).toFixed(1))} ${units[i]}`;
}

const SAMPLE_ATTACHMENTS: AttachmentItem[] = [
  { id: 'att-1', name: 'architecture_diagram_v2.png', size: 245760, type: 'image/png', uploadedAt: new Date(Date.now() - 3600000 * 4).toISOString() },
  { id: 'att-2', name: 'sprint_4_requirements.pdf', size: 1048576, type: 'application/pdf', uploadedAt: new Date(Date.now() - 3600000 * 24).toISOString() },
];

function FileIcon({ type }: { type: string }) {
  if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-indigo-500" />;
  if (type.includes('pdf') || type.includes('text') || type.includes('doc')) return <FileText className="w-5 h-5 text-amber-500" />;
  return <File className="w-5 h-5 text-blue-500" />;
}

/** One file in the list: thumbnail or icon, name, size and date, with open and delete. */
function AttachmentRow({ att, onDelete }: { att: AttachmentItem; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between p-3 border border-lira-border rounded-xl hover:border-lira-blue/40 hover:bg-gray-50/50 transition-all group bg-white shadow-2xs">
      <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
        {att.previewUrl ? (
          <img src={att.previewUrl} alt={att.name} className="w-10 h-10 rounded-lg object-cover border border-lira-border flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-gray-50 border border-lira-border flex items-center justify-center flex-shrink-0"><FileIcon type={att.type} /></div>
        )}
        <div className="min-w-0 flex-1">
          <h5 className="text-xs font-bold text-lira-text truncate group-hover:text-lira-blue transition-colors" title={att.name}>{att.name}</h5>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-lira-muted">
            <span>{formatBytes(att.size)}</span><span>•</span><span>{new Date(att.uploadedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {att.previewUrl && (
          <a href={att.previewUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-lira-muted hover:text-lira-blue rounded-lg hover:bg-gray-100 transition-colors" title="Open image in new tab"><Download className="w-4 h-4" /></a>
        )}
        <button onClick={() => onDelete(att.id)} className="p-1.5 text-lira-muted hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer" title="Delete attachment"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

export const AttachmentsModal: React.FC<AttachmentsModalProps> = ({ isOpen, onClose, space }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [draggingOver, setDraggingOver] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const storageKey = `lira_attachments_${space?.id ?? 'global'}`;

  // Load this space's list when the window opens (the sample files the first time)
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (Array.isArray(saved) && saved.length > 0) return setAttachments(saved);
      setAttachments(SAMPLE_ATTACHMENTS);
      localStorage.setItem(storageKey, JSON.stringify(SAMPLE_ATTACHMENTS));
    } catch {
      setAttachments(SAMPLE_ATTACHMENTS);
    }
  }, [isOpen, storageKey]);

  const flashSaved = () => { setSavedToast(true); setTimeout(() => setSavedToast(false), 2000); };

  /** Shows the new list and saves it (the thumbnails are only for this visit, so they are not saved). */
  const save = (items: AttachmentItem[]) => {
    setAttachments(items);
    try {
      localStorage.setItem(storageKey, JSON.stringify(items.map(({ id, name, size, type, uploadedAt }) => ({ id, name, size, type, uploadedAt }))));
    } catch (e) {
      console.error('Failed to save attachments to localStorage', e);
    }
  };

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: AttachmentItem[] = Array.from(files).map(file => ({
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name, size: file.size, type: file.type || 'application/octet-stream', uploadedAt: new Date().toISOString(),
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    save([...added, ...attachments]);
    flashSaved();
    setUploadNote(`Added ${added.length} file${added.length > 1 ? 's' : ''}!`);
    setTimeout(() => setUploadNote(null), 2500);
  };

  const dragEvents = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDraggingOver(true); },
    onDragLeave: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDraggingOver(false); },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDraggingOver(false); addFiles(e.dataTransfer.files); },
  };

  const remove = (id: string) => {
    const item = attachments.find(a => a.id === id);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    save(attachments.filter(a => a.id !== id));
  };
  const clearAll = async () => {
    if (!(await confirmDialog({ title: 'Clear attachments', message: 'Clear all attachments for this space?', confirmLabel: 'Clear all', tone: 'danger' }))) return;
    attachments.forEach(a => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); });
    save([]);
  };

  const totalBytes = attachments.reduce((sum, item) => sum + item.size, 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Space Attachments · ${space?.name || 'Workspace'}`} size="lg">
      <div className="flex flex-col h-[560px] text-lira-text">
        <div className="p-6 pb-4 flex-shrink-0">
          <input type="file" ref={fileInput} onChange={e => { addFiles(e.target.files); if (fileInput.current) fileInput.current.value = ''; }} multiple className="hidden" />
          <div
            {...dragEvents}
            onClick={() => fileInput.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all select-none ${draggingOver ? 'border-lira-blue bg-blue-50/80 ring-4 ring-lira-blue/15 scale-[1.01]' : 'border-lira-border bg-gray-50/60 hover:bg-gray-100/60 hover:border-lira-blue/60'}`}
          >
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 bg-white rounded-full shadow-xs border border-lira-border text-lira-blue"><UploadCloud className="w-6 h-6 animate-pulse" /></div>
              <div>
                <p className="text-sm font-semibold text-lira-text">Drop files to upload or <span className="text-lira-blue hover:underline">browse</span></p>
                <p className="text-xs text-lira-muted mt-0.5">Supports images, documents, PDFs, specifications (unlimited local storage)</p>
              </div>
            </div>
          </div>
        </div>

        {uploadNote && (
          <div className="mx-6 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-2 flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />{uploadNote}
          </div>
        )}

        <div className="px-6 py-2 flex items-center justify-between text-xs text-lira-muted border-b border-lira-border flex-shrink-0">
          <div className="flex items-center gap-2 font-medium">
            <Paperclip className="w-3.5 h-3.5 text-lira-muted" /><span>Files ({attachments.length})</span><span>•</span><span>Total size: {formatBytes(totalBytes)}</span>
          </div>
          {attachments.length > 0 && <button onClick={clearAll} className="text-lira-muted hover:text-red-600 transition-colors cursor-pointer text-xs font-medium">Clear all</button>}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
          {attachments.length === 0 ? (
            <div className="text-center py-12 text-lira-muted">
              <File className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-medium">No attachments uploaded yet</p>
              <p className="text-[11px] text-lira-muted mt-0.5">Drop files into the zone above to attach to this space.</p>
            </div>
          ) : attachments.map(att => <AttachmentRow key={att.id} att={att} onDelete={remove} />)}
        </div>

        <div className="px-6 py-3 border-t border-lira-border bg-gray-50 flex items-center justify-between text-xs flex-shrink-0">
          <span className="text-lira-muted text-[11px]">Storage: <strong className="font-mono text-lira-text">{storageKey}</strong></span>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => { save(attachments); flashSaved(); }}>Save Attachments</Button>
            <Button variant="secondary" size="sm" onClick={onClose}>Done</Button>
          </div>
        </div>
      </div>

      {savedToast && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-xl animate-fade-in pointer-events-none">
          <CheckCircle2 className="w-4 h-4 text-white" /><span>✓ Saved</span>
        </div>
      )}
    </Modal>
  );
};
