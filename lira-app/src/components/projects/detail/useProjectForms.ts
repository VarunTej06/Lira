import { confirmDialog } from '../../common/dialogStore';
import React, { useState } from 'react';
import type { Project } from '../../../types/project';
import { writeProjects } from '../../../hooks/useProjects';
import { DEFAULT_CUSTOM_FIELDS, DEFAULT_WORKFLOW_STATES, type CustomFieldItem, type WorkflowStateItem } from './types';
import { useResetWhen } from '../../../hooks/useResetWhen';
import { appStorage } from '../../../utils/appStorage';

/** The technical-details form and the settings (workflow states, custom fields). Kept in the parent so edits survive switching tabs. */
export function useProjectForms(
  project: Project,
  onUpdateProject?: (updated: Project) => void,
  onDeleteProject?: (projectId: string) => void,
) {
  // ── Tab 4: Technical Details Form State ──
  const [repoUrl, setRepoUrl] = useState(project.repoUrl || '');
  const [description, setDescription] = useState(project.description || '');
  const [lead, setLead] = useState(project.lead || 'Varun Tej');
  const [environments, setEnvironments] = useState<string[]>(
    project.environments && project.environments.length > 0
      ? project.environments
      : ['Development', 'Staging', 'Production']
  );
  const [newEnvInput, setNewEnvInput] = useState('');
  const [techSavedToast, setTechSavedToast] = useState(false);

  useResetWhen([project], () => {
    setRepoUrl(project.repoUrl || '');
    setDescription(project.description || '');
    setLead(project.lead || 'Varun Tej');
    if (project.environments && project.environments.length > 0) {
      setEnvironments(project.environments);
    }
  });

  const handleAddEnv = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEnvInput.trim()) return;
    const env = newEnvInput.trim();
    if (!environments.includes(env)) {
      setEnvironments(prev => [...prev, env]);
    }
    setNewEnvInput('');
  };

  const handleRemoveEnv = (env: string) => {
    setEnvironments(prev => prev.filter(e => e !== env));
  };

  const handleSaveTechnicalDetails = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Project = {
      ...project,
      repoUrl: repoUrl.trim(),
      description: description.trim(),
      lead: lead.trim() || 'Varun Tej',
      environments,
      updatedAt: new Date().toISOString(),
    };

    try {
      const raw = appStorage.get('lira_projects');
      if (raw) {
        const list: Project[] = JSON.parse(raw);
        const next = list.map(p => p.id === project.id ? updated : p);
        writeProjects(next);
      }
    } catch (err) {
      console.error('Failed to update project in localStorage:', err);
    }

    onUpdateProject?.(updated);
    setTechSavedToast(true);
    setTimeout(() => setTechSavedToast(false), 2000);
  };

  // ── Tab 5: Settings State ──
  const [workflowStates, setWorkflowStates] = useState<WorkflowStateItem[]>(() => {
    try {
      const raw = appStorage.get(`lira_project_settings_${project.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.workflowStates) && parsed.workflowStates.length > 0) {
          return parsed.workflowStates;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_WORKFLOW_STATES;
  });

  const [customFields, setCustomFields] = useState<CustomFieldItem[]>(() => {
    try {
      const raw = appStorage.get(`lira_project_settings_${project.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.customFields) && parsed.customFields.length > 0) {
          return parsed.customFields;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_CUSTOM_FIELDS;
  });

  const [settingsSavedToast, setSettingsSavedToast] = useState(false);
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('Text');
  const [newFieldDesc, setNewFieldDesc] = useState('');

  const handleRenameState = (id: string, newLabel: string) => {
    setWorkflowStates(prev => prev.map(s => s.id === id ? { ...s, label: newLabel } : s));
  };

  const handleAddCustomField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldName.trim()) return;
    const newField: CustomFieldItem = {
      id: `cf-${Date.now()}`,
      name: newFieldName.trim(),
      type: newFieldType,
      description: newFieldDesc.trim() || `Configured field for ${project.name}`,
    };
    setCustomFields(prev => [...prev, newField]);
    setNewFieldName('');
    setNewFieldDesc('');
    setShowAddFieldModal(false);
  };

  const handleRemoveCustomField = (id: string) => {
    setCustomFields(prev => prev.filter(f => f.id !== id));
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        workflowStates,
        customFields,
        updatedAt: new Date().toISOString(),
      };
      appStorage.set(`lira_project_settings_${project.id}`, JSON.stringify(payload));
      setSettingsSavedToast(true);
      setTimeout(() => setSettingsSavedToast(false), 2000);
    } catch (err) {
      console.error('Failed to save project settings:', err);
    }
  };

  const handleDeleteProject = async () => {
    if (await confirmDialog({ title: 'Delete project', message: `Delete the project "${project.name}"? This cannot be undone. Its tickets stay in their space.`, confirmLabel: 'Delete project', tone: 'danger' })) {
      onDeleteProject?.(project.id);
    }
  };

  // Deleting is handled with the settings form (see handleDeleteProject above)
  return {
    repoUrl,
    setRepoUrl,
    description,
    setDescription,
    lead,
    setLead,
    environments,
    setEnvironments,
    newEnvInput,
    setNewEnvInput,
    techSavedToast,
    handleAddEnv,
    handleRemoveEnv,
    handleSaveTechnicalDetails,
    workflowStates,
    setWorkflowStates,
    customFields,
    setCustomFields,
    settingsSavedToast,
    showAddFieldModal,
    setShowAddFieldModal,
    newFieldName,
    setNewFieldName,
    newFieldType,
    setNewFieldType,
    newFieldDesc,
    setNewFieldDesc,
    handleRenameState,
    handleAddCustomField,
    handleRemoveCustomField,
    handleSaveSettings,
    handleDeleteProject,
  };
}

export type ProjectForms = ReturnType<typeof useProjectForms>;
