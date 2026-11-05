import React, { useState, useEffect } from 'react';
import {
  FileText, Plus, Trash2, Eye, Check, ChevronRight,
  ListPlus, Sparkles, AlertCircle
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { Space } from '../../types/space';

export type FormFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox';

export interface FormField {
  id: string;
  name: string;
  type: FormFieldType;
  required?: boolean;
  options?: string[];
}

export interface IntakeForm {
  id: string;
  spaceId?: number;
  title: string;
  description?: string;
  fields: FormField[];
  createdAt: string;
}

interface FormsModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space | undefined;
}

const DEFAULT_SAMPLE_FORMS: IntakeForm[] = [
  {
    id: 'sample-bug-form',
    title: 'Customer Bug Report',
    description: 'Standard issue intake for bug triage and repro steps.',
    createdAt: new Date().toISOString(),
    fields: [
      { id: 'f-1', name: 'Issue Summary', type: 'text', required: true },
      { id: 'f-2', name: 'Steps to Reproduce', type: 'textarea', required: true },
      { id: 'f-3', name: 'Severity', type: 'select', options: ['Critical', 'Major', 'Minor', 'Cosmetic'], required: true },
      { id: 'f-4', name: 'Browser / Environment', type: 'text', required: false },
      { id: 'f-5', name: 'Expected Behavior', type: 'textarea', required: false },
    ],
  },
  {
    id: 'sample-feature-form',
    title: 'Feature Request Form',
    description: 'Collect user requirements and business justification.',
    createdAt: new Date().toISOString(),
    fields: [
      { id: 'f-10', name: 'Feature Name', type: 'text', required: true },
      { id: 'f-11', name: 'User Story / Value', type: 'textarea', required: true },
      { id: 'f-12', name: 'Target Release Date', type: 'date', required: false },
      { id: 'f-13', name: 'Acceptance Criteria', type: 'textarea', required: false },
    ],
  },
];

export const FormsModal: React.FC<FormsModalProps> = ({
  isOpen,
  onClose,
  space,
}) => {
  const storageKey = `lira_forms_${space?.id ?? 'global'}`;

  const [forms, setForms] = useState<IntakeForm[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'builder'>('list');
  const [previewForm, setPreviewForm] = useState<IntakeForm | null>(null);

  // Builder form state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);

  // New field inputs
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState<FormFieldType>('text');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldOptions, setFieldOptions] = useState('');
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Load saved forms from localStorage
  useEffect(() => {
    if (!isOpen) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setForms(parsed);
          return;
        }
      }
      // Seed with sample forms if empty
      setForms(DEFAULT_SAMPLE_FORMS);
      localStorage.setItem(storageKey, JSON.stringify(DEFAULT_SAMPLE_FORMS));
    } catch {
      setForms(DEFAULT_SAMPLE_FORMS);
    }
  }, [isOpen, storageKey]);

  const saveFormsToStorage = (updatedForms: IntakeForm[]) => {
    setForms(updatedForms);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedForms));
    } catch (e) {
      console.error('Failed to save intake forms to localStorage', e);
    }
  };

  const handleAddField = () => {
    if (!fieldName.trim()) {
      setBuilderError('Field name cannot be empty.');
      return;
    }
    setBuilderError(null);

    const newField: FormField = {
      id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: fieldName.trim(),
      type: fieldType,
      required: fieldRequired,
      options: fieldType === 'select'
        ? fieldOptions.split(',').map(s => s.trim()).filter(Boolean)
        : undefined,
    };

    setFields(prev => [...prev, newField]);
    setFieldName('');
    setFieldType('text');
    setFieldRequired(false);
    setFieldOptions('');
  };

  const handleRemoveField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setBuilderError('Please provide a form title.');
      return;
    }
    if (fields.length === 0) {
      setBuilderError('Please add at least one field to the form.');
      return;
    }

    const newForm: IntakeForm = {
      id: `form-${Date.now()}`,
      spaceId: space?.id,
      title: formTitle.trim(),
      description: formDesc.trim() || undefined,
      fields,
      createdAt: new Date().toISOString(),
    };

    const updated = [newForm, ...forms];
    saveFormsToStorage(updated);

    // Reset builder
    setFormTitle('');
    setFormDesc('');
    setFields([]);
    setBuilderError(null);
    setSuccessToast('Form saved ✓');
    setActiveTab('list');

    setTimeout(() => setSuccessToast(null), 2000);
  };

  const handleDeleteForm = (id: string) => {
    if (!window.confirm('Are you sure you want to delete this intake form?')) return;
    const updated = forms.filter(f => f.id !== id);
    saveFormsToStorage(updated);
    if (previewForm?.id === id) setPreviewForm(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Intake Forms · ${space?.name || 'Workspace'}`}
      size="lg"
    >
      <div className="flex flex-col h-[580px]">
        {/* Top Header Tabs */}
        <div className="flex items-center justify-between px-6 pt-3 pb-2 border-b border-jira-border bg-gray-50/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveTab('list'); setPreviewForm(null); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'list' && !previewForm
                  ? 'bg-jira-blue text-white shadow-xs'
                  : 'text-jira-muted hover:text-jira-text hover:bg-gray-200/60'
              }`}
            >
              Saved Forms ({forms.length})
            </button>
            <button
              onClick={() => { setActiveTab('builder'); setPreviewForm(null); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'builder'
                  ? 'bg-jira-blue text-white shadow-xs'
                  : 'text-jira-muted hover:text-jira-text hover:bg-gray-200/60'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Create New Form
            </button>
          </div>

          {previewForm && (
            <button
              onClick={() => setPreviewForm(null)}
              className="text-xs text-jira-blue hover:underline cursor-pointer flex items-center gap-1"
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

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-6 text-jira-text">
          {/* VIEW 1: PREVIEW SELECTED FORM */}
          {previewForm ? (
            <div className="space-y-5 max-w-lg mx-auto">
              <div className="border-b border-jira-border pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-blue-50 text-jira-blue rounded-md">
                    <FileText className="w-4 h-4" />
                  </span>
                  <h3 className="text-base font-bold text-jira-text">{previewForm.title}</h3>
                </div>
                {previewForm.description && (
                  <p className="text-xs text-jira-muted mt-1">{previewForm.description}</p>
                )}
              </div>

              <div className="space-y-4 bg-gray-50/60 border border-jira-border p-4 rounded-xl">
                {previewForm.fields.map((f, idx) => (
                  <div key={f.id || idx} className="space-y-1">
                    <label className="block text-xs font-semibold text-jira-text">
                      {f.name} {f.required && <span className="text-red-500">*</span>}
                    </label>

                    {f.type === 'textarea' ? (
                      <textarea
                        rows={3}
                        placeholder={`Enter ${f.name.toLowerCase()}...`}
                        className="w-full px-3 py-1.5 text-xs border border-jira-border rounded-lg bg-white focus:outline-none focus:border-jira-blue"
                      />
                    ) : f.type === 'select' ? (
                      <select className="w-full px-3 py-1.5 text-xs border border-jira-border rounded-lg bg-white focus:outline-none focus:border-jira-blue">
                        <option value="">Select an option...</option>
                        {(f.options || []).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : f.type === 'checkbox' ? (
                      <div className="flex items-center gap-2 pt-1">
                        <input type="checkbox" className="w-4 h-4 rounded text-jira-blue border-gray-300" />
                        <span className="text-xs text-jira-muted">Confirm {f.name.toLowerCase()}</span>
                      </div>
                    ) : (
                      <input
                        type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                        placeholder={`Enter ${f.name.toLowerCase()}...`}
                        className="w-full px-3 py-1.5 text-xs border border-jira-border rounded-lg bg-white focus:outline-none focus:border-jira-blue"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" size="sm" onClick={() => setPreviewForm(null)}>
                  Close Preview
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    alert('Intake form submission received (mock submission).');
                    setPreviewForm(null);
                  }}
                >
                  Submit Response
                </Button>
              </div>
            </div>
          ) : activeTab === 'list' ? (
            /* VIEW 2: SAVED FORMS LIST */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-jira-text">Space Intake Forms</h3>
                  <p className="text-xs text-jira-muted">
                    Custom forms for stakeholders and team members to submit tasks into {space?.name || 'this space'}.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => setActiveTab('builder')}
                  className="flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Form
                </Button>
              </div>

              {forms.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-jira-border rounded-xl">
                  <FileText className="w-8 h-8 text-jira-muted mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-jira-text">No intake forms yet</p>
                  <p className="text-xs text-jira-muted mt-1 max-w-sm mx-auto">
                    Create forms to capture bug reports, customer feedback, and feature requests.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setActiveTab('builder')}
                    className="mt-4"
                  >
                    Build your first form
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {forms.map(form => (
                    <div
                      key={form.id}
                      className="border border-jira-border rounded-xl p-4 hover:border-jira-blue/50 hover:shadow-xs transition-all bg-white flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-blue-50 text-jira-blue rounded-lg">
                              <FileText className="w-4 h-4" />
                            </span>
                            <h4 className="text-sm font-bold text-jira-text group-hover:text-jira-blue transition-colors">
                              {form.title}
                            </h4>
                          </div>
                          <button
                            onClick={() => handleDeleteForm(form.id)}
                            className="p-1 text-jira-muted hover:text-red-600 rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Delete form"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {form.description && (
                          <p className="text-xs text-jira-muted mt-2 line-clamp-2">
                            {form.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-3 text-[11px] text-jira-muted">
                          <span className="font-semibold text-jira-text">{form.fields.length}</span> fields
                          <span>•</span>
                          <span>{new Date(form.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-jira-border/60 mt-3 flex items-center justify-between">
                        <button
                          onClick={() => setPreviewForm(form)}
                          className="text-xs font-semibold text-jira-blue hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Preview Form
                        </button>
                        <ChevronRight className="w-4 h-4 text-jira-muted group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* VIEW 3: INTAKE FORM BUILDER */
            <form onSubmit={handleSaveForm} className="space-y-5">
              {builderError && (
                <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {builderError}
                </div>
              )}

              {/* Form Info */}
              <div className="space-y-3 bg-gray-50/70 p-4 rounded-xl border border-jira-border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-jira-muted">Form Details</h4>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-semibold text-jira-text mb-1">
                      Form Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. User Feedback & Suggestions"
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-jira-border rounded-lg bg-white focus:outline-none focus:border-jira-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-jira-text mb-1">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Instructions for submitter..."
                      value={formDesc}
                      onChange={e => setFormDesc(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-jira-border rounded-lg bg-white focus:outline-none focus:border-jira-blue"
                    />
                  </div>
                </div>
              </div>

              {/* Add Field Box */}
              <div className="space-y-3 bg-blue-50/40 p-4 rounded-xl border border-blue-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-jira-blue flex items-center gap-1.5">
                    <ListPlus className="w-4 h-4" /> Add Field
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-6 space-y-1">
                    <label className="block text-[11px] font-semibold text-jira-text">Field Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Account Number, Error Log"
                      value={fieldName}
                      onChange={e => setFieldName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddField(); } }}
                      className="w-full px-3 py-1.5 text-xs border border-jira-border rounded-lg bg-white focus:outline-none focus:border-jira-blue"
                    />
                  </div>

                  <div className="sm:col-span-4 space-y-1">
                    <label className="block text-[11px] font-semibold text-jira-text">Field Type</label>
                    <select
                      value={fieldType}
                      onChange={e => setFieldType(e.target.value as FormFieldType)}
                      className="w-full px-2.5 py-1.5 text-xs border border-jira-border rounded-lg bg-white focus:outline-none focus:border-jira-blue"
                    >
                      <option value="text">Single-line Text</option>
                      <option value="textarea">Multi-line Paragraph</option>
                      <option value="number">Number</option>
                      <option value="date">Date Picker</option>
                      <option value="select">Dropdown Select</option>
                      <option value="checkbox">Checkbox</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 flex items-center">
                    <button
                      type="button"
                      onClick={handleAddField}
                      className="w-full py-1.5 px-3 bg-jira-blue text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Field
                    </button>
                  </div>
                </div>

                {fieldType === 'select' && (
                  <div className="space-y-1 pt-1">
                    <label className="block text-[11px] font-semibold text-jira-text">
                      Options (comma separated)
                    </label>
                    <input
                      type="text"
                      placeholder="Option A, Option B, Option C"
                      value={fieldOptions}
                      onChange={e => setFieldOptions(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-jira-border rounded-lg bg-white"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <label className="flex items-center gap-1.5 text-xs text-jira-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fieldRequired}
                      onChange={e => setFieldRequired(e.target.checked)}
                      className="rounded border-gray-300 text-jira-blue"
                    />
                    Required field
                  </label>
                </div>
              </div>

              {/* Current Fields List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-jira-muted">
                    Form Schema Fields ({fields.length})
                  </h4>
                  {fields.length > 0 && (
                    <span className="text-[11px] text-jira-muted">Fields will appear in this order</span>
                  )}
                </div>

                {fields.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-jira-border rounded-xl text-xs text-jira-muted">
                    No fields added yet. Use the tool above to add intake form fields.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fields.map((f, i) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-2.5 bg-gray-50 border border-jira-border rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-white border border-jira-border flex items-center justify-center font-bold text-[10px] text-jira-muted">
                            {i + 1}
                          </span>
                          <div>
                            <span className="font-semibold text-jira-text">{f.name}</span>
                            <span className="ml-2 text-[10px] uppercase font-mono px-1.5 py-0.5 bg-gray-200/70 rounded text-jira-muted">
                              {f.type}
                            </span>
                            {f.required && (
                              <span className="ml-1.5 text-[10px] text-red-600 font-bold">Required</span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveField(f.id)}
                          className="p-1 text-jira-muted hover:text-red-600 transition-colors cursor-pointer"
                          title="Remove field"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="flex justify-end gap-2 pt-4 border-t border-jira-border">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => { setActiveTab('list'); setFields([]); }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Save Form
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* 2-second green toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-xl animate-fade-in pointer-events-none">
          <Check className="w-4 h-4 text-white" />
          <span>Form saved ✓</span>
        </div>
      )}
    </Modal>
  );
};
