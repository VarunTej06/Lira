import React, { useState, type ReactNode } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { FolderKanban, Layers, PlusCircle, Check } from 'lucide-react';
import type { Space } from '../../types/space';
import type { Project } from '../../types/project';
import { writeProjects } from '../../hooks/useProjects';
import { createSpace } from '../../hooks/useSpaces';
import { cleanProjectKey, suggestProjectKey } from '../../utils/projectKey';
import { useResetWhen } from '../../hooks/useResetWhen';
import { PALETTE } from '../../theme/palette';
import { appStorage } from '../../utils/appStorage';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaces: Space[];
  onProjectCreated: (project: Project) => void;
}

const SPACE_ICONS = ['🚀', '🎯', '⚡', '💡', '🏆', '🔧', '🌐', '🧠', '📋', '✨', '📚', '🌤️'];
const SPACE_COLORS = [PALETTE.brand, PALETTE.info, PALETTE.purple, PALETTE.success, PALETTE.danger, PALETTE.amber, PALETTE.orange, PALETTE.textStrong];
const DEFAULT_LEAD = 'Varun Tej';

const LABEL = 'block text-xs font-semibold text-lira-muted uppercase tracking-wider mb-1.5';
const INPUT = 'w-full text-sm border border-lira-border rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-lira-blue focus:ring-1 focus:ring-lira-blue transition-all';

const Field = ({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) => (
  <div>
    <label className={LABEL}>{label}{required && <> <span className="text-red-500">*</span></>}</label>
    {children}
  </div>
);

/** A selectable card for the two ways of choosing a space. */
function ChoiceCard({ selected, onSelect, icon, title, text }: { selected: boolean; onSelect: () => void; icon: ReactNode; title: string; text: string }) {
  return (
    <div onClick={onSelect} className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${selected ? 'border-lira-blue bg-lira-blue-light/40 shadow-xs' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
      <div className="flex items-center gap-2.5">
        <input type="radio" name="spaceAssociation" checked={selected} onChange={onSelect} className="w-4 h-4 text-lira-blue focus:ring-lira-blue cursor-pointer" />
        {icon}
        <span className="text-sm font-semibold text-lira-text">{title}</span>
      </div>
      <p className="text-xs text-lira-muted mt-1.5 pl-6">{text}</p>
    </div>
  );
}

/** Reads the saved projects (an unreadable list counts as empty). */
function savedProjects(): Project[] {
  try { return JSON.parse(appStorage.get('lira_projects') || '[]'); } catch { return []; }
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, spaces, onProjectCreated }) => {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [lead, setLead] = useState(DEFAULT_LEAD);
  const [associationType, setAssociationType] = useState<'existing' | 'new'>('existing');
  const [selectedSpaceId, setSelectedSpaceId] = useState<number>(() => spaces[0]?.id || 1);
  const [newSpaceIcon, setNewSpaceIcon] = useState('🚀');
  const [newSpaceColor, setNewSpaceColor] = useState(PALETTE.brand);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedToast, setSavedToast] = useState(false);

  // Keep the chosen space valid when the list of spaces changes
  useResetWhen([spaces, selectedSpaceId], () => {
    if (spaces.length > 0 && !spaces.some(s => s.id === selectedSpaceId)) setSelectedSpaceId(spaces[0].id || 1);
  });

  const changeName = (value: string) => {
    setName(value);
    if (!keyEdited) setKey(suggestProjectKey(value)); // until the person types their own key
  };
  const changeKey = (value: string) => { setKeyEdited(true); setKey(cleanProjectKey(value)); };

  const resetForm = () => {
    setName(''); setKey(''); setKeyEdited(false); setDescription(''); setLead(DEFAULT_LEAD);
    setAssociationType('existing'); setSelectedSpaceId(spaces[0]?.id || 1);
    setNewSpaceIcon('🚀'); setNewSpaceColor(PALETTE.brand); setError('');
  };
  const close = () => { resetForm(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Project name is required');
    if (!key.trim()) return setError('Project key is required');

    setLoading(true);
    setError('');
    try {
      const projectKey = key.trim().toUpperCase();
      const spaceId = associationType === 'new'
        ? await createSpace({
            name: name.trim(), key: projectKey, icon: newSpaceIcon, color: newSpaceColor,
            description: description.trim() || `Dedicated space for project ${name.trim()}`,
            createdAt: new Date(), updatedAt: new Date(),
          })
        : selectedSpaceId;

      const now = new Date().toISOString();
      const project: Project = {
        id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: name.trim(), key: projectKey, description: description.trim(), lead: lead.trim() || DEFAULT_LEAD, spaceId,
        repoUrl: '', environments: ['Development', 'Staging', 'Production'], category: 'Software Engineering',
        createdAt: now, updatedAt: now,
      };
      writeProjects([project, ...savedProjects()]);

      onProjectCreated(project);
      setSavedToast(true);
      setTimeout(() => { setSavedToast(false); close(); }, 2000);
    } catch (err: unknown) {
      console.error('Failed to create project:', err);
      setError('Failed to create project. Please check your inputs and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Create Project" size="lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div className="flex items-start gap-3 p-3 bg-lira-blue-light/60 border border-lira-border rounded-xl text-xs text-lira-text">
          <FolderKanban className="w-5 h-5 text-lira-blue flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-lira-blue">Lira Project Architecture</p>
            <p className="text-lira-muted mt-0.5">Projects organize technical initiatives, boards, environments, and team workflows. Each project binds to a Space for issue tracking and storage partitioning.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <Field label="Project Name" required>
              <input type="text" required autoFocus value={name} onChange={e => changeName(e.target.value)} placeholder="e.g. MLOps Automated Pipeline" className={INPUT} />
            </Field>
          </div>
          <Field label="Key / Prefix" required>
            <input type="text" required value={key} onChange={e => changeKey(e.target.value)} placeholder="e.g. MLOP" maxLength={6} className={`${INPUT} font-mono uppercase`} />
            <p className="text-3xs text-lira-muted mt-1 font-mono">Issues: {key || 'KEY'}-1</p>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Project Lead / Owner" required>
            <input type="text" required value={lead} onChange={e => setLead(e.target.value)} placeholder="e.g. Varun Tej" className={INPUT} />
          </Field>
          <Field label="Project Category">
            <div className="flex items-center gap-2 h-[42px] px-3.5 bg-gray-50 border border-lira-border rounded-lg text-sm text-lira-text">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /><span>Software Engineering</span>
            </div>
          </Field>
        </div>

        <Field label="Description">
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="High-level mission, engineering deliverables, repository goals, and architectural scope..." className="w-full text-sm border border-lira-border rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-lira-blue resize-none transition-all" />
        </Field>

        <div className="space-y-3 pt-2 border-t border-lira-border">
          <label className="block text-xs font-semibold text-lira-muted uppercase tracking-wider">Space Association <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ChoiceCard selected={associationType === 'existing'} onSelect={() => setAssociationType('existing')} icon={<Layers className="w-4 h-4 text-lira-blue" />} title="Link to existing Space" text="Bind this project to an already established Space and its Kanban board issues." />
            <ChoiceCard selected={associationType === 'new'} onSelect={() => setAssociationType('new')} icon={<PlusCircle className="w-4 h-4 text-emerald-600" />} title="Create new Space" text="Provision a brand new isolated workspace partition and disk shard." />
          </div>

          {associationType === 'existing' ? (
            <div className="p-3 bg-gray-50 border border-lira-border rounded-xl space-y-2 animate-fade-in">
              <label className="block text-xs font-medium text-lira-text">Select Space to Link:</label>
              <select value={selectedSpaceId} onChange={e => setSelectedSpaceId(Number(e.target.value))} className="w-full text-sm border border-lira-border rounded-lg px-3 py-2 bg-white text-lira-text focus:outline-none focus:border-lira-blue cursor-pointer">
                {spaces.map(sp => <option key={sp.id} value={sp.id}>{sp.icon} {sp.name} ({sp.key})</option>)}
              </select>
            </div>
          ) : (
            <div className="p-3.5 bg-gray-50 border border-lira-border rounded-xl space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-lira-text uppercase tracking-wider">New Space Customization</span>
                <span className="text-2xs text-lira-muted font-mono">{key || 'KEY'}.json on disk</span>
              </div>
              <div>
                <label className="block text-xs text-lira-muted mb-1.5">Space Icon</label>
                <div className="flex flex-wrap gap-1.5">
                  {SPACE_ICONS.map(ic => (
                    <button key={ic} type="button" onClick={() => setNewSpaceIcon(ic)} className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all cursor-pointer ${newSpaceIcon === ic ? 'ring-2 ring-lira-blue bg-white shadow-xs scale-105' : 'hover:bg-white/70'}`}>{ic}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-lira-muted mb-1.5">Space Color Accent</label>
                <div className="flex gap-2 flex-wrap items-center">
                  {SPACE_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setNewSpaceColor(c)} style={{ backgroundColor: c }} className={`w-6 h-6 rounded-full transition-all cursor-pointer flex items-center justify-center ${newSpaceColor === c ? 'ring-2 ring-offset-2 ring-lira-blue scale-110 shadow-xs' : 'hover:scale-105'}`}>
                      {newSpaceColor === c && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">{error}</p>}

        <div className="flex justify-end items-center gap-3 pt-3 border-t border-lira-border">
          <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
          <Button type="submit" variant="primary" loading={loading} icon={<FolderKanban className="w-4 h-4" />}>Create Project</Button>
        </div>
      </form>

      {savedToast && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-xl animate-fade-in pointer-events-none">
          <Check className="w-4 h-4 text-white" /><span>✓ Saved</span>
        </div>
      )}
    </Modal>
  );
};
