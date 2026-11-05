import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { FolderKanban, Layers, PlusCircle, Check } from 'lucide-react';
import type { Space } from '../../types/space';
import type { Project } from '../../types/project';
import { writeProjects } from '../../hooks/useProjects';
import { createSpace } from '../../hooks/useSpaces';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaces: Space[];
  onProjectCreated: (project: Project) => void;
}

const SPACE_ICONS = ['🚀', '🎯', '⚡', '💡', '🏆', '🔧', '🌐', '🧠', '📋', '✨', '📚', '🌤️'];
const SPACE_COLORS = ['#0052CC', '#00B8D9', '#6554C0', '#36B37E', '#FF5630', '#FFAB00', '#FF991F', '#172B4D'];

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  spaces,
  onProjectCreated,
}) => {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [lead, setLead] = useState('Varun Tej');

  // Space Association Toggle: 'existing' | 'new'
  const [associationType, setAssociationType] = useState<'existing' | 'new'>('existing');
  const [selectedSpaceId, setSelectedSpaceId] = useState<number>(() => spaces[0]?.id || 1);

  // New Space fields
  const [newSpaceIcon, setNewSpaceIcon] = useState('🚀');
  const [newSpaceColor, setNewSpaceColor] = useState('#0052CC');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedToast, setSavedToast] = useState(false);

  // Sync selected space default
  useEffect(() => {
    if (spaces.length > 0 && !spaces.some(s => s.id === selectedSpaceId)) {
      setSelectedSpaceId(spaces[0].id || 1);
    }
  }, [spaces, selectedSpaceId]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!keyEdited) {
      // Auto-generate key from first letter of each word (2-5 uppercase chars)
      const words = val.trim().split(/\s+/).filter(Boolean);
      let gen = '';
      if (words.length === 1) {
        gen = words[0].slice(0, 4).toUpperCase();
      } else {
        gen = words.map(w => w[0]?.toUpperCase() || '').join('').slice(0, 5);
      }
      setKey(gen.replace(/[^A-Z0-9]/g, ''));
    }
  };

  const handleKeyChange = (val: string) => {
    setKeyEdited(true);
    setKey(val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
  };

  const resetForm = () => {
    setName('');
    setKey('');
    setKeyEdited(false);
    setDescription('');
    setLead('Varun Tej');
    setAssociationType('existing');
    setSelectedSpaceId(spaces[0]?.id || 1);
    setNewSpaceIcon('🚀');
    setNewSpaceColor('#0052CC');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }
    if (!key.trim()) {
      setError('Project key is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let targetSpaceId = selectedSpaceId;

      if (associationType === 'new') {
        const now = new Date();
        const createdId = await createSpace({
          name: name.trim(),
          key: key.trim().toUpperCase(),
          icon: newSpaceIcon,
          color: newSpaceColor,
          description: description.trim() || `Dedicated space for project ${name.trim()}`,
          createdAt: now,
          updatedAt: now,
        });
        targetSpaceId = createdId;
      }

      const newProject: Project = {
        id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: name.trim(),
        key: key.trim().toUpperCase(),
        description: description.trim(),
        lead: lead.trim() || 'Varun Tej',
        spaceId: targetSpaceId,
        repoUrl: '',
        environments: ['Development', 'Staging', 'Production'],
        category: 'Software Engineering',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Persist to localStorage array 'lira_projects'
      let existingProjects: Project[] = [];
      try {
        const raw = localStorage.getItem('lira_projects');
        if (raw) existingProjects = JSON.parse(raw);
      } catch {
        existingProjects = [];
      }

      const updated = [newProject, ...existingProjects];
      writeProjects(updated);

      onProjectCreated(newProject);
      setSavedToast(true);
      setTimeout(() => {
        setSavedToast(false);
        resetForm();
        onClose();
      }, 2000);
    } catch (err: unknown) {
      console.error('Failed to create project:', err);
      setError('Failed to create project. Please check your inputs and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { resetForm(); onClose(); }}
      title="Create Project"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* Header callout */}
        <div className="flex items-start gap-3 p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl text-xs text-blue-800">
          <FolderKanban className="w-5 h-5 text-jira-blue flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-jira-blue">Lira Project Architecture</p>
            <p className="text-jira-muted mt-0.5">
              Projects organize technical initiatives, boards, environments, and team workflows. Each project binds to a Space for issue tracking and storage partitioning.
            </p>
          </div>
        </div>

        {/* Project Name & Key */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-jira-muted uppercase tracking-wider mb-1.5">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="e.g. MLOps Automated Pipeline"
              className="w-full text-sm border border-jira-border rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-jira-muted uppercase tracking-wider mb-1.5">
              Key / Prefix <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={key}
              onChange={e => handleKeyChange(e.target.value)}
              placeholder="e.g. MLOP"
              maxLength={6}
              className="w-full text-sm font-mono uppercase border border-jira-border rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue transition-all"
            />
            <p className="text-[10px] text-jira-muted mt-1 font-mono">Issues: {key || 'KEY'}-1</p>
          </div>
        </div>

        {/* Lead / Owner & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-jira-muted uppercase tracking-wider mb-1.5">
              Project Lead / Owner <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={lead}
              onChange={e => setLead(e.target.value)}
              placeholder="e.g. Varun Tej"
              className="w-full text-sm border border-jira-border rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-jira-muted uppercase tracking-wider mb-1.5">
              Project Category
            </label>
            <div className="flex items-center gap-2 h-[42px] px-3.5 bg-gray-50 border border-jira-border rounded-lg text-sm text-jira-text">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Software Engineering</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-jira-muted uppercase tracking-wider mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="High-level mission, engineering deliverables, repository goals, and architectural scope..."
            rows={2}
            className="w-full text-sm border border-jira-border rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-jira-blue resize-none transition-all"
          />
        </div>

        {/* Space Association Radio Section */}
        <div className="space-y-3 pt-2 border-t border-jira-border">
          <label className="block text-xs font-semibold text-jira-muted uppercase tracking-wider">
            Space Association <span className="text-red-500">*</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Option 1: Link to existing Space */}
            <div
              onClick={() => setAssociationType('existing')}
              className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                associationType === 'existing'
                  ? 'border-jira-blue bg-blue-50/40 shadow-xs'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="spaceAssociation"
                  checked={associationType === 'existing'}
                  onChange={() => setAssociationType('existing')}
                  className="w-4 h-4 text-jira-blue focus:ring-jira-blue cursor-pointer"
                />
                <Layers className="w-4 h-4 text-jira-blue" />
                <span className="text-sm font-semibold text-jira-text">Link to existing Space</span>
              </div>
              <p className="text-xs text-jira-muted mt-1.5 pl-6">
                Bind this project to an already established Space and its Kanban board issues.
              </p>
            </div>

            {/* Option 2: Create new Space */}
            <div
              onClick={() => setAssociationType('new')}
              className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                associationType === 'new'
                  ? 'border-jira-blue bg-blue-50/40 shadow-xs'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="spaceAssociation"
                  checked={associationType === 'new'}
                  onChange={() => setAssociationType('new')}
                  className="w-4 h-4 text-jira-blue focus:ring-jira-blue cursor-pointer"
                />
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-jira-text">Create new Space</span>
              </div>
              <p className="text-xs text-jira-muted mt-1.5 pl-6">
                Provision a brand new isolated workspace partition and disk shard.
              </p>
            </div>
          </div>

          {/* Sub-form for Option 1: Existing Space dropdown */}
          {associationType === 'existing' && (
            <div className="p-3 bg-gray-50 border border-jira-border rounded-xl space-y-2 animate-fade-in">
              <label className="block text-xs font-medium text-jira-text">
                Select Space to Link:
              </label>
              <select
                value={selectedSpaceId}
                onChange={e => setSelectedSpaceId(Number(e.target.value))}
                className="w-full text-sm border border-jira-border rounded-lg px-3 py-2 bg-white text-jira-text focus:outline-none focus:border-jira-blue cursor-pointer"
              >
                {spaces.map(sp => (
                  <option key={sp.id} value={sp.id}>
                    {sp.icon} {sp.name} ({sp.key})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sub-form for Option 2: New Space details */}
          {associationType === 'new' && (
            <div className="p-3.5 bg-gray-50 border border-jira-border rounded-xl space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-jira-text uppercase tracking-wider">
                  New Space Customization
                </span>
                <span className="text-[11px] text-jira-muted font-mono">
                  {key || 'KEY'}.json on disk
                </span>
              </div>

              <div>
                <label className="block text-xs text-jira-muted mb-1.5">Space Icon</label>
                <div className="flex flex-wrap gap-1.5">
                  {SPACE_ICONS.map(ic => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setNewSpaceIcon(ic)}
                      className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all cursor-pointer ${
                        newSpaceIcon === ic
                          ? 'ring-2 ring-jira-blue bg-white shadow-xs scale-105'
                          : 'hover:bg-white/70'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-jira-muted mb-1.5">Space Color Accent</label>
                <div className="flex gap-2 flex-wrap items-center">
                  {SPACE_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewSpaceColor(c)}
                      className={`w-6 h-6 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                        newSpaceColor === c
                          ? 'ring-2 ring-offset-2 ring-jira-blue scale-110 shadow-xs'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {newSpaceColor === c && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end items-center gap-3 pt-3 border-t border-jira-border">
          <Button type="button" variant="ghost" onClick={() => { resetForm(); onClose(); }}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading} icon={<FolderKanban className="w-4 h-4" />}>
            Create Project
          </Button>
        </div>
      </form>

      {/* 2-second green toast */}
      {savedToast && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-xl animate-fade-in pointer-events-none">
          <Check className="w-4 h-4 text-white" />
          <span>✓ Saved</span>
        </div>
      )}
    </Modal>
  );
};
