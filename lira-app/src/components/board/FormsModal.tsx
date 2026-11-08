import React from 'react';
import { useFormsState, type FormsModalProps } from './forms/useFormsState';
import { FormsTabs } from './forms/FormsTabs';
import { FormPreview } from './forms/FormPreview';
import { FormsList } from './forms/FormsList';
import { FormBuilder } from './forms/FormBuilder';
import { Check } from 'lucide-react';
import { Modal } from '../common/Modal';
export type { FormFieldType, FormField, IntakeForm } from './forms/useFormsState';

/** Intake forms: preview, list of saved forms and the form builder. */
export const FormsModal: React.FC<FormsModalProps> = (props) => {
  const s = useFormsState(props);
  return (
    <Modal
      isOpen={s.isOpen}
      onClose={s.onClose}
      title={`Intake Forms · ${s.space?.name || 'Workspace'}`}
      size="lg"
    >
      <div className="flex flex-col h-[580px]">
        <FormsTabs {...s} />
        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-6 text-lira-text">
          {s.previewForm ? <FormPreview {...s} /> : s.activeTab === 'list' ? <FormsList {...s} /> : <FormBuilder {...s} />}
        </div>
      </div>
    
      {/* 2-second green toast */}
      {s.successToast && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-xl animate-fade-in pointer-events-none">
          <Check className="w-4 h-4 text-white" />
          <span>Form saved ✓</span>
        </div>
      )}
    </Modal>
  );
};
