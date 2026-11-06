import { Download, FileJson, FileText } from 'lucide-react';
import type {  } from '../../../types/space';
import { Modal } from '../../common/Modal';
import { Button } from '../../common/Button';
import type { ActionBarState } from './useActionBarState';

/** Share the board. */
export function ShareModal(s: ActionBarState) {
  const {  showShare, setShowShare, copied, exportToast, handleCopyLink, handleExportCSV, handleExportJSON } = s;
  return (
    <>
      {/* ── Share Modal ── */}
      <Modal isOpen={showShare} onClose={() => setShowShare(false)} title="Share Board" size="sm">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm text-green-700 font-medium">Space access: Open</span>
          </div>
          <p className="text-sm text-jira-muted">
            Anyone with the link can view this board. Since Lira is offline-first, your data never leaves your device.
          </p>

          {/* Copy link */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-jira-border">
            <span className="text-xs text-jira-muted flex-1 truncate font-mono">{window.location.href}</span>
            <Button variant="primary" size="xs" onClick={handleCopyLink}>
              {copied ? '✓ Copied!' : 'Copy link'}
            </Button>
          </div>

          {/* Exports */}
          <div className="border-t border-jira-border pt-4 space-y-2">
            <p className="text-xs font-semibold text-jira-muted uppercase tracking-wide mb-2">Export</p>
            <button
              onClick={handleExportCSV}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-jira-text border border-jira-border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FileText className="w-4 h-4 text-green-600" />
              Export CSV
              <Download className="w-3.5 h-3.5 ml-auto text-jira-muted" />
            </button>
            <button
              onClick={handleExportJSON}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-jira-text border border-jira-border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FileJson className="w-4 h-4 text-blue-600" />
              Export JSON
              <Download className="w-3.5 h-3.5 ml-auto text-jira-muted" />
            </button>
            {exportToast && (
              <p className="text-xs text-green-600 font-medium text-center py-1 bg-green-50 rounded-lg border border-green-200">
                ✓ {exportToast}
              </p>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
