import React from 'react';
import { Check } from 'lucide-react';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { useIssueDetail, type IssueDetailModalProps } from './detail/useIssueDetail';
import { IssueHeader } from './detail/IssueHeader';
import { IssueMain } from './detail/IssueMain';
import { IssueSidebar } from './detail/IssueSidebar';
import { motion, dialogBackdrop, dialogPanel } from '../common/motion';

/** The ticket popup: header, description / child work / activity on the left, details on the right. */
export const IssueDetailModal: React.FC<IssueDetailModalProps> = (props) => {
  const s = useIssueDetail(props);
  if (!s) return null;
  return (
    <motion.div
      {...dialogBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) s.onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, x: 60, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={dialogPanel.transition}
        className="bg-white rounded-xl shadow-modal w-full flex flex-col overflow-hidden"
        style={{ maxWidth: '1120px', maxHeight: '93vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Status colour banner */}
        <div className="h-1.5 w-full flex-shrink-0" style={{ backgroundColor: s.bannerColor }} />
        <IssueHeader {...s} />
        <div className="flex flex-1 overflow-hidden min-h-0">
          <IssueMain {...s} />
          <IssueSidebar {...s} />
        </div>
      </motion.div>
    
      {/* Confirmation Modal for Issue Deletion */}
      <ConfirmDeleteModal
        isOpen={s.showDeleteConfirm}
        onClose={() => s.setShowDeleteConfirm(false)}
        onConfirm={s.handleConfirmDelete}
        issueKey={s.local.key}
        issueTitle={s.local.title}
        childCount={s.childCount}
        isEpic={s.local.type === 'epic'}
      />
    
      {/* 2-second green toast */}
      {s.savedToast && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-xl animate-fade-in pointer-events-none">
          <Check className="w-4 h-4 text-white" />
          <span>Saved ✓</span>
        </div>
      )}
    </motion.div>
  );
};
