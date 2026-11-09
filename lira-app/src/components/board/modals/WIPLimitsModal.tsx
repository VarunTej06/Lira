import { notifySaved } from '../../common/SavedToast';
import React, { useState } from 'react';
import { Modal } from '../../common/Modal';
import type { Space } from '../../../types/space';

/** WIP Limits Modal */

interface WipLimitsConfig {
  enabled: boolean;
  limits: {
    backlog: number;
    todo: number;
    inprogress: number;
    done: number;
  };
}

const DEFAULT_WIP_CONFIG: WipLimitsConfig = {
  enabled: false,
  limits: {
    backlog: 0, // 0 = unlimited
    todo: 5,
    inprogress: 3,
    done: 0,
  },
};

export const WIPLimitsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  space: Space | undefined;
  onConfigSaved?: (cfg: WipLimitsConfig) => void;
}> = ({ isOpen, onClose, space, onConfigSaved }) => {
  const [config, setConfig] = useState<WipLimitsConfig>(() => {
    try {
      const savedLimits = localStorage.getItem('lira_wip_limits');
      const savedConfig = localStorage.getItem('lira_wip_config');
      if (savedLimits && savedLimits.startsWith('{')) {
        const parsedLimits = JSON.parse(savedLimits);
        const hasLimits = Object.values(parsedLimits).some((v: any) => typeof v === 'number' && v > 0);
        return {
          enabled: hasLimits,
          limits: { ...DEFAULT_WIP_CONFIG.limits, ...parsedLimits }
        };
      }
      return savedConfig ? { ...DEFAULT_WIP_CONFIG, ...JSON.parse(savedConfig) } : DEFAULT_WIP_CONFIG;
    } catch {
      return DEFAULT_WIP_CONFIG;
    }
  });

  const handleSave = () => {
    localStorage.setItem('lira_wip_config', JSON.stringify(config));
    if (config.enabled) {
      localStorage.setItem('lira_wip_limits', JSON.stringify(config.limits));
    } else {
      localStorage.setItem('lira_wip_limits', JSON.stringify({}));
    }
    window.dispatchEvent(new Event('lira_wip_limits_changed'));
    onConfigSaved?.(config);
    notifySaved('WIP limits saved');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Work in Progress (WIP) Limits · ${space?.name || 'Workspace'}`} size="md">
      <div className="p-6 space-y-5 text-lira-text">
        <p className="text-xs text-lira-muted leading-relaxed">
          WIP limits restrict the maximum number of items in active workflow columns to prevent bottlenecks and enforce focus. Set 0 for unlimited.
        </p>

        {/* Master Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-lira-border">
          <div>
            <h4 className="text-sm font-bold text-lira-text">Enforce Column WIP Limits</h4>
            <p className="text-xs text-lira-muted">Visual warning indicators when a column exceeds its capacity</p>
          </div>
          <button
            type="button"
            onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
              config.enabled ? 'bg-lira-blue' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                config.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Column limit inputs */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-lira-muted uppercase tracking-wider block">
            Column Capacity Maximums
          </label>

          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'todo' as const, label: 'To Do Limit', defaultVal: 5, desc: 'Ready for dev queue' },
              { key: 'inprogress' as const, label: 'In Progress Limit', defaultVal: 3, desc: 'Active execution cap' },
              { key: 'backlog' as const, label: 'Backlog Limit (0 = ∞)', defaultVal: 0, desc: 'Ideation pool' },
              { key: 'done' as const, label: 'Done Limit (0 = ∞)', defaultVal: 0, desc: 'Completed deliverables' },
            ].map(col => (
              <div key={col.key} className="p-3 bg-white border border-lira-border rounded-xl space-y-1">
                <div className="text-xs font-semibold text-lira-text">{col.label}</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={config.limits[col.key]}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setConfig(prev => ({
                        ...prev,
                        limits: { ...prev.limits, [col.key]: val },
                      }));
                    }}
                    className="w-20 px-2 py-1 text-sm border border-lira-border rounded font-bold text-center bg-gray-50 focus:bg-white focus:border-lira-blue"
                  />
                  <span className="text-[11px] text-lira-muted">{col.desc}</span>
                </div>
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
            className="px-4 py-2 text-sm font-semibold bg-lira-blue text-white rounded-lg hover:bg-blue-700 cursor-pointer shadow-xs"
          >
            Save WIP Limits
          </button>
        </div>
      </div>

    </Modal>
  );
};
