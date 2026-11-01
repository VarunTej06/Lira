import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Download } from 'lucide-react';
import type { Attachment } from '../../types/issue';
import { v4 as uuidv4 } from 'uuid';

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

    for (const file of Array.from(files)) {
      const attachment: Attachment = {
        id: uuidv4(),
        name: file.name,
        size: file.size,
        type: file.type,
        createdAt: new Date(),
      };

      if (file.type.startsWith('image/')) {
        const dataUrl = await readFileAsDataUrl(file);
        attachment.dataUrl = dataUrl;
      }

      newAttachments.push(attachment);
    }

    onUpdate([...attachments, ...newAttachments]);
  }, [attachments, onUpdate]);

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

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
      <h3 className="text-sm font-semibold text-jira-text">Attachments</h3>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all
          ${dragging
            ? 'border-jira-blue bg-jira-blue-light'
            : 'border-jira-border hover:border-jira-blue hover:bg-gray-50'
          }
        `}
      >
        <Upload className="w-5 h-5 mx-auto mb-2 text-jira-muted" />
        <p className="text-xs text-jira-muted">Drop files here or <span className="text-jira-blue font-medium">browse</span></p>
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
            <div key={att.id} className="group flex items-center gap-2 p-2 border border-jira-border rounded-lg hover:bg-gray-50 transition-colors">
              {att.dataUrl ? (
                <img src={att.dataUrl} alt={att.name} className="w-10 h-10 object-cover rounded flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 bg-blue-50 rounded flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-jira-blue" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-jira-text truncate">{att.name}</p>
                <p className="text-[10px] text-jira-muted">{formatBytes(att.size)}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {att.dataUrl && (
                  <a
                    href={att.dataUrl}
                    download={att.name}
                    className="p-1 rounded hover:bg-gray-200 text-jira-muted"
                    onClick={e => e.stopPropagation()}
                  >
                    <Download className="w-3 h-3" />
                  </a>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(att.id); }}
                  className="p-1 rounded hover:bg-red-50 text-jira-muted hover:text-red-500"
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
