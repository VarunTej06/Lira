import type {  } from '../../../types/space';
import { BoardSettingsModal, WIPLimitsModal, BulkActionsModal } from '../BoardModals';
import { FormsModal } from '../FormsModal';
import { DocumentsModal } from '../DocumentsModal';
import { AttachmentsModal } from '../AttachmentsModal';
import { ReportsModal } from '../ReportsModal';
import type { ActionBarState } from './useActionBarState';

/** Board settings, WIP limits, bulk actions, forms, documents, attachments and reports. */
export function OverflowModals(s: ActionBarState) {
  const { space, issues, setWipEnabled, showBoardSettingsModal, setShowBoardSettingsModal, showWipLimitsModal, setShowWipLimitsModal, showBulkActionsModal, setShowBulkActionsModal, showFormsModal, setShowFormsModal, showDocumentsModal, setShowDocumentsModal, showAttachmentsModal, setShowAttachmentsModal, showReportsModal, setShowReportsModal } = s;
  return (
    <>
      {/* ── Space Overflow Modals ── */}
      <BoardSettingsModal
        isOpen={showBoardSettingsModal}
        onClose={() => setShowBoardSettingsModal(false)}
        space={space}
      />
      <WIPLimitsModal
        isOpen={showWipLimitsModal}
        onClose={() => setShowWipLimitsModal(false)}
        space={space}
        onConfigSaved={cfg => setWipEnabled(cfg.enabled)}
      />
      <BulkActionsModal
        isOpen={showBulkActionsModal}
        onClose={() => setShowBulkActionsModal(false)}
        space={space}
        issues={issues}
      />
      <FormsModal
        isOpen={showFormsModal}
        onClose={() => setShowFormsModal(false)}
        space={space}
      />
      <DocumentsModal
        isOpen={showDocumentsModal}
        onClose={() => setShowDocumentsModal(false)}
        space={space}
      />
      <AttachmentsModal
        isOpen={showAttachmentsModal}
        onClose={() => setShowAttachmentsModal(false)}
        space={space}
      />
      <ReportsModal
        isOpen={showReportsModal}
        onClose={() => setShowReportsModal(false)}
        space={space}
        issues={issues}
      />
    </>
  );
}
