import React, { useState } from 'react';
import {
  GripVertical, MoreHorizontal, User,
  Clock, Star, LayoutGrid, Map, Calendar, Folder,
  Filter, LayoutDashboard, Database, Users
} from 'lucide-react';
import { Modal } from '../common/Modal';

export interface SidebarConfig {
  forYou: boolean;
  recent: boolean;
  starred: boolean;
  apps: boolean;
  roadmaps: boolean;
  plans: boolean;
  spaces: boolean;
  filters: boolean;
  dashboards: boolean;
  assets: boolean;
  teams: boolean;
}

export const DEFAULT_SIDEBAR_CONFIG: SidebarConfig = {
  forYou: true,
  recent: false,
  starred: true,
  apps: false,
  roadmaps: false,
  plans: false,
  spaces: true,
  filters: false,
  dashboards: false,
  assets: false,
  teams: false,
};

interface CustomiseSidebarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (config: SidebarConfig) => void;
}

export const CustomiseSidebarModal: React.FC<CustomiseSidebarModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [config, setConfig] = useState<SidebarConfig>(() => {
    try {
      const saved = localStorage.getItem('lira_sidebar_customization');
      return saved ? { ...DEFAULT_SIDEBAR_CONFIG, ...JSON.parse(saved) } : DEFAULT_SIDEBAR_CONFIG;
    } catch {
      return DEFAULT_SIDEBAR_CONFIG;
    }
  });

  const toggleItem = (key: keyof SidebarConfig) => {
    if (key === 'forYou') return; // Locked like Jira
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    localStorage.setItem('lira_sidebar_customization', JSON.stringify(config));
    onSave?.(config);
    onClose();
  };

  const navItems = [
    { key: 'forYou' as const, label: 'For you', icon: <User className="w-4 h-4 text-gray-500" />, locked: true },
    { key: 'recent' as const, label: 'Recent', icon: <Clock className="w-4 h-4 text-gray-500" /> },
    { key: 'starred' as const, label: 'Starred', icon: <Star className="w-4 h-4 text-amber-500" /> },
    { key: 'apps' as const, label: 'Apps', icon: <LayoutGrid className="w-4 h-4 text-gray-500" /> },
    { key: 'roadmaps' as const, label: 'Roadmaps', icon: <Map className="w-4 h-4 text-gray-500" /> },
    { key: 'plans' as const, label: 'Plans', icon: <Calendar className="w-4 h-4 text-gray-500" /> },
    { key: 'spaces' as const, label: 'Spaces', icon: <Folder className="w-4 h-4 text-gray-500" /> },
    { key: 'filters' as const, label: 'Filters', icon: <Filter className="w-4 h-4 text-gray-500" /> },
    { key: 'dashboards' as const, label: 'Dashboards', icon: <LayoutDashboard className="w-4 h-4 text-gray-500" /> },
  ];

  const appShortcuts = [
    { key: 'assets' as const, label: 'Assets', icon: <Database className="w-4 h-4 text-gray-500" /> },
    { key: 'teams' as const, label: 'Teams', icon: <Users className="w-4 h-4 text-gray-500" /> },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Customise your sidebar" size="md">
      <div className="p-6 space-y-5 text-jira-text max-h-[80vh] overflow-y-auto">
        <p className="text-xs text-jira-muted leading-relaxed">
          Selected items will always be visible in the sidebar. You can still access unselected items from the{' '}
          <strong className="text-jira-text">More</strong> menu in the sidebar.
          <br />
          The changes you make here only affect you and not anyone else on your site.
        </p>

        {/* Jira navigation section */}
        <div>
          <h3 className="text-sm font-bold text-jira-text">Jira navigation</h3>
          <p className="text-xs text-jira-muted mb-3">The following navigation items are available in Jira.</p>

          <div className="space-y-1">
            {navItems.map(item => (
              <div
                key={item.key}
                onClick={() => toggleItem(item.key)}
                className={`flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer select-none ${
                  config[item.key] ? 'bg-blue-50/30' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="w-3.5 h-3.5 text-gray-300" />
                  <input
                    type="checkbox"
                    checked={config[item.key]}
                    disabled={item.locked}
                    onChange={() => {}}
                    className="w-4 h-4 text-jira-blue rounded border-gray-300 focus:ring-jira-blue"
                  />
                  <span>{item.icon}</span>
                  <span className="text-sm font-medium text-jira-text">{item.label}</span>
                </div>
                <MoreHorizontal className="w-4 h-4 text-gray-400" />
              </div>
            ))}
          </div>
        </div>

        {/* App shortcuts section */}
        <div className="border-t border-jira-border pt-4">
          <h3 className="text-sm font-bold text-jira-text">App shortcuts</h3>
          <p className="text-xs text-jira-muted mb-3">The following Atlassian apps are available for your organisation.</p>

          <div className="space-y-1">
            {appShortcuts.map(item => (
              <div
                key={item.key}
                onClick={() => toggleItem(item.key)}
                className={`flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer select-none ${
                  config[item.key] ? 'bg-blue-50/30' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="w-3.5 h-3.5 text-gray-300" />
                  <input
                    type="checkbox"
                    checked={config[item.key]}
                    onChange={() => {}}
                    className="w-4 h-4 text-jira-blue rounded border-gray-300 focus:ring-jira-blue"
                  />
                  <span>{item.icon}</span>
                  <span className="text-sm font-medium text-jira-text">{item.label}</span>
                </div>
                <MoreHorizontal className="w-4 h-4 text-gray-400" />
              </div>
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 border-t border-jira-border pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-jira-muted hover:text-jira-text rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-semibold bg-jira-blue text-white rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
          >
            Save changes
          </button>
        </div>
      </div>
    </Modal>
  );
};
