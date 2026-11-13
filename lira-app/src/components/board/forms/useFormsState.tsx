import { notifySaved } from '../../common/savedToastStore';
import { confirmDialog } from '../../common/dialogStore';
import React, { useState, useEffect } from 'react';
import type { Space } from '../../../types/space';
import { useResetWhen } from '../../../hooks/useResetWhen';
import { appStorage } from '../../../utils/appStorage';

export type FormFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox';

interface FormField {
  id: string;
  name: string;
  type: FormFieldType;
  required?: boolean;
  options?: string[];
}

interface IntakeForm {
  id: string;
  spaceId?: number;
  title: string;
  description?: string;
  fields: FormField[];
  createdAt: string;
}

export interface FormsModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space | undefined;
}

/** The forms saved for this space, or null when nothing usable is saved yet. */
const savedForms = (key: string): IntakeForm[] | null => {
  try {
    const parsed = JSON.parse(appStorage.get(key) || 'null');
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
};

const DEFAULT_SAMPLE_FORMS: IntakeForm[] = [
  {
    id: 'sample-bug-form',
    title: 'Customer Bug Report',
    description: 'Standard issue intake for bug triage and repro steps.',
    createdAt: new Date().toISOString(),
    fields: [
      { id: 'f-1', name: 'Issue Title', type: 'text', required: true },
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

/** The intake forms of a space: the saved list, the builder fields and saving. */
export function useFormsState(props: FormsModalProps) {
  const {
    isOpen,
    onClose,
    space,
  } = props;
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
  useResetWhen([isOpen, storageKey], () => {
    if (isOpen) setForms(savedForms(storageKey) ?? DEFAULT_SAMPLE_FORMS);
  });
  // Seed the sample forms once, the first time the window opens
  useEffect(() => {
    if (!isOpen || savedForms(storageKey)) return;
    try { appStorage.set(storageKey, JSON.stringify(DEFAULT_SAMPLE_FORMS)); } catch { /* storage unavailable */ }
  }, [isOpen, storageKey]);

  const saveFormsToStorage = (updatedForms: IntakeForm[]) => {
    setForms(updatedForms);
    try {
      appStorage.set(storageKey, JSON.stringify(updatedForms));
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
    notifySaved('Form saved');
    setActiveTab('list');

    setTimeout(() => setSuccessToast(null), 2000);
  };

  const handleDeleteForm = async (id: string) => {
    if (!(await confirmDialog({ title: 'Delete form', message: 'Delete this intake form?', confirmLabel: 'Delete form', tone: 'danger' }))) return;
    const updated = forms.filter(f => f.id !== id);
    saveFormsToStorage(updated);
    if (previewForm?.id === id) setPreviewForm(null);
  };

  return {
    isOpen,
    onClose,
    space,
    storageKey,
    forms,
    setForms,
    activeTab,
    setActiveTab,
    previewForm,
    setPreviewForm,
    formTitle,
    setFormTitle,
    formDesc,
    setFormDesc,
    fields,
    setFields,
    fieldName,
    setFieldName,
    fieldType,
    setFieldType,
    fieldRequired,
    setFieldRequired,
    fieldOptions,
    setFieldOptions,
    builderError,
    setBuilderError,
    successToast,
    setSuccessToast,
    saveFormsToStorage,
    handleAddField,
    handleRemoveField,
    handleSaveForm,
    handleDeleteForm,
  };
}

export type FormsState = ReturnType<typeof useFormsState>;
