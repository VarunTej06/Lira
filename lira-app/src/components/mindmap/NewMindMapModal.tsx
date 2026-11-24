import { useState, type FormEvent } from 'react';
import { currentTime } from '../../utils/clock';
import { MIND_TEMPLATES, fromTemplate } from '../../utils/mindTemplates';
import type { MindMap } from '../../utils/mindmap';
import { loadProfile } from '../../utils/userPrefs';
import { Modal } from '../common/Modal';
import { FIELD, LABEL } from '../standup/parts';

/** The form for a new mind map: its name and what to start from. */
export function NewMindMapModal({ isOpen, onClose, onCreate }: { isOpen: boolean; onClose: () => void; onCreate: (map: MindMap) => void }) {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('blank');

  function submit(e: FormEvent) {
    e.preventDefault();
    const now = currentTime().toISOString();
    const nodes = fromTemplate(template, () => crypto.randomUUID());
    const title = name.trim().slice(0, 100) || 'New mind map';
    if (nodes[0] && template === 'blank') nodes[0] = { ...nodes[0], text: title };
    onCreate({ id: crypto.randomUUID(), name: title, nodes, createdAt: now, updatedAt: now, createdBy: loadProfile().name || undefined });
    setName(''); setTemplate('blank');
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New mind map" size="md">
      <form onSubmit={submit} aria-label="New mind map" className="p-6 space-y-4 text-lira-text">
        <div><label className={LABEL} htmlFor="mm-name">Name</label><input id="mm-name" value={name} onChange={e => setName(e.target.value)} placeholder="Product ideas" maxLength={100} className={FIELD} /></div>
        <fieldset>
          <legend className={LABEL}>Start from</legend>
          <div className="grid grid-cols-2 gap-2">
            {MIND_TEMPLATES.map(t => (
              <label key={t.id} className={`rounded-xl border p-3 cursor-pointer ${template === t.id ? 'border-lira-blue bg-lira-blue-light' : 'border-lira-border bg-white hover:bg-gray-50'}`}>
                <input type="radio" name="template" className="sr-only" checked={template === t.id} onChange={() => setTemplate(t.id)} />
                <span className="block text-sm font-medium">{t.name}</span><span className="block text-2xs text-lira-muted">{t.about}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-lira-border bg-white text-lira-text hover:bg-gray-50 cursor-pointer">Cancel</button>
          <button type="submit" className="px-4 py-2 text-sm font-semibold rounded-xl bg-lira-blue text-lira-on-blue hover:bg-lira-blue-hover cursor-pointer">Make the map</button>
        </div>
      </form>
    </Modal>
  );
}
