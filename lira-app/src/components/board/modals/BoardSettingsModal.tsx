import { notifySaved } from '../../common/savedToastStore';
import React, { useState } from 'react';
import { Layers, User, Tag, Calendar, Eye } from 'lucide-react';
import { Modal } from '../../common/Modal';
import type { Space } from '../../../types/space';
import { appStorage } from '../../../utils/appStorage';

/** Board Settings Modal */

interface BoardSettingsConfig {
  density: 'comfortable' | 'compact';
  showStoryPoints: boolean;
  showEpicBadge: boolean;
  showDueDate: boolean;
  showAssignee: boolean;
  showPriority: boolean;
  estimationType: 'points' | 'count';
}

const DEFAULT_BOARD_SETTINGS: BoardSettingsConfig = {
  density: 'comfortable',
  showStoryPoints: true,
  showEpicBadge: true,
  showDueDate: true,
  showAssignee: true,
  showPriority: true,
  estimationType: 'points',
};

export const BoardSettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  space: Space | undefined;
}> = ({ isOpen, onClose, space }) => {
  const spaceId = space?.id ?? 'global';
  const storageKey = `lira_board_settings_${spaceId}`;

  const [config, setConfig] = useState<BoardSettingsConfig>(() => {
    try {
      const saved = appStorage.get(storageKey) || appStorage.get('lira_board_settings');
      return saved ? { ...DEFAULT_BOARD_SETTINGS, ...JSON.parse(saved) } : DEFAULT_BOARD_SETTINGS;
    } catch {
      return DEFAULT_BOARD_SETTINGS;
    }
  });

  const handleSave = () => {
    appStorage.set(storageKey, JSON.stringify(config));
    appStorage.set('lira_board_settings', JSON.stringify(config));
    window.dispatchEvent(new Event('lira_board_settings_changed'));
    notifySaved('Board settings saved');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Board Settings · ${space?.name || 'Workspace'}`} size="md">
      <div className="p-6 space-y-5 text-lira-text">
        <p className="text-xs text-lira-muted leading-relaxed">
          Customize card density, badge visibility, and estimation metrics for this board.
        </p>

        {/* Card Density */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-lira-muted uppercase tracking-wider block">
            Card Layout &amp; Density
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setConfig(prev => ({ ...prev, density: 'comfortable' }))}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                config.density === 'comfortable'
                  ? 'border-lira-blue bg-lira-blue-light/50 ring-1 ring-lira-blue'
                  : 'border-lira-border hover:bg-gray-50'
              }`}
            >
              <div className="text-sm font-semibold text-lira-text">Comfortable</div>
              <div className="text-2xs text-lira-muted mt-0.5">Spacious cards with full metadata &amp; labels</div>
            </button>
            <button
              type="button"
              onClick={() => setConfig(prev => ({ ...prev, density: 'compact' }))}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                config.density === 'compact'
                  ? 'border-lira-blue bg-lira-blue-light/50 ring-1 ring-lira-blue'
                  : 'border-lira-border hover:bg-gray-50'
              }`}
            >
              <div className="text-sm font-semibold text-lira-text">Compact</div>
              <div className="text-2xs text-lira-muted mt-0.5">Dense card view with slim padding</div>
            </button>
          </div>
        </div>

        {/* Card Badges & Metadata Visibility */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-lira-muted uppercase tracking-wider block">
            Card Badges &amp; Details
          </label>
          <div className="divide-y divide-lira-border border border-lira-border rounded-xl overflow-hidden bg-gray-50/50">
            {[
              { key: 'showStoryPoints' as const, label: 'Story points badge', desc: 'Display estimated points on card footer', icon: <Tag className="w-4 h-4 text-purple-500" /> },
              { key: 'showEpicBadge' as const, label: 'Epic badge', desc: 'Show parent epic pill at top of card', icon: <Layers className="w-4 h-4 text-indigo-500" /> },
              { key: 'showDueDate' as const, label: 'Due dates & overdue indicators', desc: 'Alert on approaching or past-due dates', icon: <Calendar className="w-4 h-4 text-amber-500" /> },
              { key: 'showAssignee' as const, label: 'Assignee avatar', desc: 'Show user initials avatar on card', icon: <User className="w-4 h-4 text-lira-blue" /> },
              { key: 'showPriority' as const, label: 'Priority badge & chevron', desc: 'Show high / medium / low indicator', icon: <Eye className="w-4 h-4 text-emerald-500" /> },
            ].map(item => (
              <div
                key={item.key}
                onClick={() => setConfig(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                className="flex items-center justify-between p-3 hover:bg-white cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <div>
                    <div className="text-xs font-semibold text-lira-text">{item.label}</div>
                    <div className="text-2xs text-lira-muted">{item.desc}</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config[item.key]}
                  onChange={() => {}}
                  className="w-4 h-4 text-lira-blue rounded border-gray-300 pointer-events-none"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-lira-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-lira-muted hover:text-lira-text rounded-lg hover:bg-gray-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-semibold bg-lira-blue text-lira-on-blue rounded-lg hover:bg-lira-blue-hover cursor-pointer shadow-xs"
          >
            Save Changes
          </button>
        </div>
      </div>

    </Modal>
  );
};
