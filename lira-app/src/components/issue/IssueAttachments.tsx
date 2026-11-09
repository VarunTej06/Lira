import React, { useState, useCallback } from 'react';
import { Upload, X, FileText, Download, Plus, ExternalLink, HardDrive, Cloud, Package, Link2 } from 'lucide-react';
import type { Attachment, AttachmentSource } from '../../types/issue';
import { readAttachment, formatBytes, SOURCE_LABEL } from '../../utils/attachments';
import { alertDialog } from '../common/dialogs';
import { AttachPicker } from './AttachPicker';
import { formatDayDateTime } from '../../utils/dateUtils';

const LINK_ICON: Record<AttachmentSource, React.ReactNode> = {
  file: <FileText className="w-5 h-5 text-lira-blue" />,
  drive: <HardDrive className="w-5 h-5 text-emerald-600" />,
  onedrive: <Cloud className="w-5 h-5 text-sky-600" />,
  dropbox: <Package className="w-5 h-5 text-indigo-600" />,
  link: <Link2 className="w-5 h-5 text-amber-600" />,
};

interface CommentFile { attachment: Attachment; author: string; at: Date | string }

interface IssueAttachmentsProps {
  attachments: Attachment[];
  onUpdate: (attachments: Attachment[]) => void;
  /** Files added inside comments. They are listed here too, but are removed by editing the comment. */
  fromComments?: CommentFile[];
}

export const IssueAttachments: React.FC<IssueAttachmentsProps> = ({ attachments, onUpdate, fromComments = [] }) => {
  const [dragging, setDragging] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

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
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-lira-text">Attachments</h3>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-lira-text border border-lira-border rounded-md hover:bg-gray-50 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add attachment
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => setPickerOpen(true)}
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
                  {LINK_ICON[att.source ?? 'file']}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-lira-text truncate">{att.name}</p>
                <p className="text-[10px] text-lira-muted">{att.url ? SOURCE_LABEL[att.source ?? 'link'] : formatBytes(att.size)}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {att.url && (
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-gray-200 text-lira-muted"
                    title="Open link"
                    onClick={e => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
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

      {fromComments.length > 0 && (
        <div data-testid="comment-attachments">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-lira-muted mb-1.5">Added in comments</p>
          <div className="grid grid-cols-2 gap-2">
            {fromComments.map(({ attachment: att, author, at }) => (
              <div key={`${att.id}`} className="flex items-center gap-2 p-2 border border-lira-border rounded-lg bg-gray-50/50">
                {att.dataUrl && att.type.startsWith('image/') ? (
                  <img src={att.dataUrl} alt={att.name} className="w-10 h-10 object-cover rounded flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 bg-blue-50 rounded flex items-center justify-center flex-shrink-0">{LINK_ICON[att.source ?? 'file']}</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-lira-text truncate">{att.name}</p>
                  <p className="text-[10px] text-lira-muted truncate">{att.url ? SOURCE_LABEL[att.source ?? 'link'] : formatBytes(att.size)} · {author}, {formatDayDateTime(at)}</p>
                </div>
                {att.dataUrl && (
                  <a href={att.dataUrl} download={att.name} className="p-1 rounded hover:bg-gray-200 text-lira-muted" aria-label={`Download ${att.name}`}><Download className="w-3 h-3" /></a>
                )}
                {att.url && (
                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-gray-200 text-lira-muted" aria-label={`Open ${att.name}`}><ExternalLink className="w-3 h-3" /></a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <AttachPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onAdd={items => onUpdate([...attachments, ...items])} />
    </div>
  );
};
