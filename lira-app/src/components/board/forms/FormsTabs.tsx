import { Plus, Check } from 'lucide-react';
import type { FormsState } from './useFormsState';

/** Tabs (saved forms, builder) and the success banner. */
export function FormsTabs(s: FormsState) {
  const { forms, activeTab, setActiveTab, previewForm, setPreviewForm, successToast } = s;
  return (
    <>
        {/* Top Header Tabs */}
        <div className="flex items-center justify-between px-6 pt-3 pb-2 border-b border-lira-border bg-gray-50/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveTab('list'); setPreviewForm(null); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'list' && !previewForm
                  ? 'bg-lira-blue text-white shadow-xs'
                  : 'text-lira-muted hover:text-lira-text hover:bg-gray-200/60'
              }`}
            >
              Saved Forms ({forms.length})
            </button>
            <button
              onClick={() => { setActiveTab('builder'); setPreviewForm(null); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'builder'
                  ? 'bg-lira-blue text-white shadow-xs'
                  : 'text-lira-muted hover:text-lira-text hover:bg-gray-200/60'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Create New Form
            </button>
          </div>

          {previewForm && (
            <button
              onClick={() => setPreviewForm(null)}
              className="text-xs text-lira-blue hover:underline cursor-pointer flex items-center gap-1"
            >
              ← Back to forms list
            </button>
          )}
        </div>

        {/* Success toast banner */}
        {successToast && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2 text-xs font-medium text-emerald-800 flex items-center gap-2 flex-shrink-0">
            <Check className="w-4 h-4 text-emerald-600" />
            {successToast}
          </div>
        )}
    </>
  );
}
