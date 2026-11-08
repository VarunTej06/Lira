import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Download } from 'lucide-react';
import type { Attachment } from '../../types/issue';
import { readAttachment } from '../../utils/attachments';
import { alertDialog } from '../common/dialogs';

interface IssueAttachmentsProps {
  attachments: Attachment[];
  onUpdate: (attachments: Attachment[]) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const IssueAttachments: React.FC<IssueAttachmentsProps> = ({ attachments, onUpdate }) => {
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (files: FileList) => {
    const newAttachments: Attachment[] = [];
    const tooBig: string[] = [];

    // every file up to 2 MB is kept inside the ticket, so it can be downloaded again
    for (const file of Array.from(files)) {
      const { attachment, embedded } = await readAttachment(file);
      if (!embedded) tooBig.push(file.name);
      newAttachments.push(attachment);
    }

    onUpdate([...attachments, ...newAttachments]);
    if (tooBig.length) {
      await alertDialog({ title: 'File not stored', message: `${tooBig.join(', ')} ${tooBig.length === 1 ? 'is' : 'are'} bigger than 2 MB. The name is listed, but the file itself is not stored in Lira.` });
    }
  }, [attachments, onUpdate]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleRemove = (id: string) => {
    onUpdate(attachments.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-lira-text">Attachments</h3>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all
          ${dragging
            ? 'border-lira-blue bg-lira-blue-light'
            : 'border-lira-border hover:border-lira-blue hover:bg-gray-50'
          }
        `}
      >
        <Upload className="w-5 h-5 mx-auto mb-2 text-lira-muted" />
        <p className="text-xs text-lira-muted">Drop files here or <span className="text-lira-blue font-medium">browse</span></p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => e.target.files && processFiles(e.target.files)}
        />
      </div>

      {/* Attachment list */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {attachments.map(att => (
            <div key={att.id} className="group flex items-center gap-2 p-2 border border-lira-border rounded-lg hover:bg-gray-50 transition-colors">
              {att.dataUrl ? (
                <img src={att.dataUrl} alt={att.name} className="w-10 h-10 object-cover rounded flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 bg-blue-50 rounded flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-lira-blue" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-lira-text truncate">{att.name}</p>
                <p className="text-[10px] text-lira-muted">{formatBytes(att.size)}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {att.dataUrl && (
                  <a
                    href={att.dataUrl}
                    download={att.name}
                    className="p-1 rounded hover:bg-gray-200 text-lira-muted"
                    onClick={e => e.stopPropagation()}
                  >
                    <Download className="w-3 h-3" />
                  </a>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(att.id); }}
                  className="p-1 rounded hover:bg-red-50 text-lira-muted hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
