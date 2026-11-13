import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { createSpace, updateSpace } from '../../hooks/useSpaces';
import type { Space } from '../../types/space';
import { useResetWhen } from '../../hooks/useResetWhen';
import { PALETTE } from '../../theme/palette';
import { SpaceIcon, SpaceIconPicker } from '../common/SpaceIcon';
import { DEFAULT_SPACE_ICON, spaceIconKey } from '../../utils/spaceIcon';

interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
  editingSpace?: Space | null;
  onUpdated?: (space: Space) => void;
}

const SPACE_COLORS = [PALETTE.brand, PALETTE.info, PALETTE.purple, PALETTE.success, PALETTE.danger, PALETTE.amber, PALETTE.orange, PALETTE.textStrong];

export const CreateSpaceModal: React.FC<CreateSpaceModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  editingSpace,
  onUpdated,
}) => {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [icon, setIcon] = useState<string>(DEFAULT_SPACE_ICON);
  const [color, setColor] = useState(PALETTE.brand);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setName(''); setKey(''); setIcon(DEFAULT_SPACE_ICON); setColor(PALETTE.brand); setDescription(''); setError('');
  };

  useResetWhen([isOpen, editingSpace], () => {
    if (editingSpace) {
      setName(editingSpace.name || '');
      setKey(editingSpace.key || '');
      setIcon(spaceIconKey(editingSpace.icon)); // an older emoji becomes its icon name on the next save
      setColor(editingSpace.color || PALETTE.brand);
      setDescription(editingSpace.description || '');
      setError('');
    } else {
      resetForm();
    }
  });

  const handleNameChange = (v: string) => {
    setName(v);
    if (!editingSpace) {
      // Auto-generate key from first word(s)
      const generated = v.split(' ')
        .map(w => w[0]?.toUpperCase() || '')
        .join('')
        .slice(0, 5);
      setKey(generated);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    if (!key.trim()) { setError('Key is required'); return; }

    setLoading(true);
    setError('');
    try {
      const now = new Date();
      if (editingSpace?.id) {
        await updateSpace(editingSpace.id, {
          name: name.trim(),
          key: key.toUpperCase().trim(),
          icon,
          color,
          description: description.trim(),
          updatedAt: now,
        });
        onUpdated?.({
          ...editingSpace,
          name: name.trim(),
          key: key.toUpperCase().trim(),
          icon,
          color,
          description: description.trim(),
          updatedAt: now,
        });
        onClose();
      } else {
        const id = await createSpace({
          name: name.trim(),
          key: key.toUpperCase().trim(),
          icon,
          color,
          description: description.trim(),
          createdAt: now,
          updatedAt: now,
        });
        onCreated(id);
        onClose();
        resetForm();
      }
    } catch {
      setError(editingSpace ? 'Failed to update space.' : 'Failed to create space.');
    } finally {
      setLoading(false);
    }
  };

  const modalTitle = editingSpace ? 'Space Settings & Edit' : 'Create Space';
  const submitLabel = editingSpace ? 'Save Changes' : 'Create Space';

  return (
    <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title={modalTitle} size="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* Icon & Color */}
        <div>
          <label className="block text-xs font-semibold text-lira-muted mb-2 uppercase tracking-wide">Icon</label>
          <SpaceIconPicker value={icon} onChange={setIcon} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-lira-muted mb-2 uppercase tracking-wide">Color</label>
          <div className="flex gap-2 flex-wrap">
            {SPACE_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-lira-blue scale-110' : 'hover:scale-105'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-lira-muted mb-1.5 uppercase tracking-wide">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            autoFocus
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="e.g. Python Mastery"
            className="w-full text-sm border border-lira-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-lira-blue focus:ring-1 focus:ring-lira-blue transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-lira-muted mb-1.5 uppercase tracking-wide">
            Key <span className="text-red-500">*</span>
          </label>
          <input
            value={key}
            onChange={e => setKey(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6))}
            placeholder="e.g. PY"
            className="w-full text-sm border border-lira-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-lira-blue focus:ring-1 focus:ring-lira-blue font-mono uppercase transition-all"
          />
          <p className="text-3xs text-lira-muted mt-1">Used as ticket prefix (e.g. {key || 'KEY'}-1)</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-lira-muted mb-1.5 uppercase tracking-wide">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional description..."
            rows={2}
            className="w-full text-sm border border-lira-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-lira-blue resize-none transition-all"
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Preview */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-lira-border">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: color + '22', color }}>
            <SpaceIcon icon={icon} className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-lira-text">{name || 'Space Name'}</p>
            <p className="text-xs text-lira-muted font-mono">{key || 'KEY'}-1, {key || 'KEY'}-2...</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-lira-border">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={loading}>{submitLabel}</Button>
        </div>
      </form>
    </Modal>
  );
};
