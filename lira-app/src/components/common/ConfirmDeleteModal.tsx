import React, { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  issueKey: string;
  issueTitle?: string;
  childCount?: number;
  isEpic?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  issueKey,
  issueTitle,
  childCount = 0,
  isEpic = false,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsDeleting(false);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={e => {
        if (e.target === e.currentTarget && !isDeleting) onClose();
      }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-jira-border w-full max-w-md overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
      >
        {/* Top red danger accent line */}
        <div className="h-1 bg-red-600 w-full" />

        <div className="p-6">
          <div className="flex items-start gap-4">
            {/* Warning Icon with soft red halo */}
            <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600 ring-4 ring-red-50">
              <AlertTriangle className="w-5 h-5" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3
                  id="confirm-delete-title"
                  className="text-base font-semibold text-jira-text leading-6"
                >
                  Delete {issueKey}?
                </h3>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={onClose}
                  className="text-jira-muted hover:text-jira-text rounded-md p-1 hover:bg-gray-100 transition-colors disabled:opacity-50"
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {issueTitle && (
                <p className="mt-1.5 text-xs text-jira-muted truncate font-medium bg-gray-50 px-2 py-1 rounded border border-gray-100">
                  <span className="font-mono text-jira-text font-semibold mr-1.5">{issueKey}:</span>
                  {issueTitle}
                </p>
              )}

              <p className="mt-3 text-sm text-jira-text leading-relaxed">
                You are about to permanently delete this issue and all its activity, attachments, and subtasks.
              </p>

              {/* Warning for Epics or issues with child issues */}
              {(childCount > 0 || isEpic) && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-red-900">
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    Permanent hierarchy deletion
                  </div>
                  <p>
                    {childCount > 0
                      ? `This issue currently contains ${childCount} child issue${childCount > 1 ? 's' : ''}. Deleting it will also delete all of its child issues.`
                      : 'Deleting this Epic will also remove all connected child issues.'}
                  </p>
                </div>
              )}

              <p className="mt-2 text-xs text-jira-muted">
                This action <span className="font-semibold text-red-600">cannot be undone</span>.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-jira-border flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-jira-text bg-white border border-jira-border hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDelete}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

