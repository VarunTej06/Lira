import React, { useState, useEffect } from 'react';
import {
  GripVertical, MoreHorizontal, User,
  Clock, Star, LayoutGrid, Map, Calendar, Folder,
  Filter, LayoutDashboard, Database, Users, Target,
  ChevronUp, ChevronDown, Check, ArrowUp, ArrowDown, Eye, EyeOff, RotateCcw,
  List, FolderKanban
} from 'lucide-react';
import { Modal } from '../common/Modal';

export interface SidebarConfig {
  navOrder: string[];
  appsOrder: string[];
  visibility: Record<string, boolean>;
  // Backwards compatibility properties
  forYou?: boolean;
  recent?: boolean;
  starred?: boolean;
  apps?: boolean;
  roadmaps?: boolean;
  plans?: boolean;
  spaces?: boolean;
  filters?: boolean;
  dashboards?: boolean;
  assets?: boolean;
  teams?: boolean;
  goals?: boolean;
  projects?: boolean;
  list?: boolean;
  calendar?: boolean;
}

export const DEFAULT_NAV_ORDER = [
  'forYou', 'projects', 'recent', 'starred', 'apps', 'roadmaps', 'plans', 'spaces', 'filters', 'dashboards', 'list', 'calendar'
];

export const DEFAULT_APPS_ORDER = [
  'assets', 'teams', 'goals', 'projects'
];

export const DEFAULT_VISIBILITY: Record<string, boolean> = {
  forYou: true,
  projects: true,
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
  goals: false,
  list: true,
  calendar: true,
};

export const DEFAULT_SIDEBAR_CONFIG: SidebarConfig = {
  navOrder: DEFAULT_NAV_ORDER,
  appsOrder: DEFAULT_APPS_ORDER,
  visibility: DEFAULT_VISIBILITY,
  ...DEFAULT_VISIBILITY,
};

interface CustomiseSidebarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (config: SidebarConfig) => void;
}

interface SidebarItemDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  locked?: boolean;
}

const ALL_NAV_ITEMS: Record<string, SidebarItemDef> = {
  forYou: { key: 'forYou', label: 'For you', icon: <User className="w-4 h-4 text-gray-500" />, locked: true },
  projects: { key: 'projects', label: 'Projects', icon: <FolderKanban className="w-4 h-4 text-violet-500" /> },
  recent: { key: 'recent', label: 'Recent', icon: <Clock className="w-4 h-4 text-gray-500" /> },
  starred: { key: 'starred', label: 'Starred', icon: <Star className="w-4 h-4 text-amber-500" /> },
  apps: { key: 'apps', label: 'Apps', icon: <LayoutGrid className="w-4 h-4 text-gray-500" /> },
  roadmaps: { key: 'roadmaps', label: 'Roadmaps', icon: <Map className="w-4 h-4 text-gray-500" /> },
  plans: { key: 'plans', label: 'Plans', icon: <Calendar className="w-4 h-4 text-gray-500" /> },
  spaces: { key: 'spaces', label: 'Spaces', icon: <Folder className="w-4 h-4 text-gray-500" /> },
  filters: { key: 'filters', label: 'Filters', icon: <Filter className="w-4 h-4 text-gray-500" /> },
  dashboards: { key: 'dashboards', label: 'Dashboards', icon: <LayoutDashboard className="w-4 h-4 text-gray-500" /> },
  list: { key: 'list', label: 'List', icon: <List className="w-4 h-4 text-gray-500" /> },
  calendar: { key: 'calendar', label: 'Calendar', icon: <Calendar className="w-4 h-4 text-gray-500" /> },
};

const ALL_APP_ITEMS: Record<string, SidebarItemDef> = {
  assets: { key: 'assets', label: 'Assets', icon: <Database className="w-4 h-4 text-gray-500" /> },
  teams: { key: 'teams', label: 'Teams', icon: <Users className="w-4 h-4 text-gray-500" /> },
  goals: { key: 'goals', label: 'Goals', icon: <Target className="w-4 h-4 text-gray-500" /> },
  projects: { key: 'projects', label: 'Projects', icon: <FolderKanban className="w-4 h-4 text-gray-500" /> },
};

export const CustomiseSidebarModal: React.FC<CustomiseSidebarModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [navOrder, setNavOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('lira_sidebar_customization');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.navOrder) && parsed.navOrder.length > 0) {
          // Ensure all default items are present
          const existing = new Set(parsed.navOrder);
          const complete = [...parsed.navOrder, ...DEFAULT_NAV_ORDER.filter(k => !existing.has(k))];
          return complete;
        }
      }
    } catch {}
    return DEFAULT_NAV_ORDER;
  });

  const [appsOrder, setAppsOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('lira_sidebar_customization');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.appsOrder) && parsed.appsOrder.length > 0) {
          const existing = new Set(parsed.appsOrder);
          const complete = [...parsed.appsOrder, ...DEFAULT_APPS_ORDER.filter(k => !existing.has(k))];
          return complete;
        }
      }
    } catch {}
    return DEFAULT_APPS_ORDER;
  });

  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('lira_sidebar_customization');
      const pinnedRaw = localStorage.getItem('lira_sidebar_pinned');
      let vis: Record<string, boolean> = { ...DEFAULT_VISIBILITY };
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.visibility) {
          vis = { ...DEFAULT_VISIBILITY, ...parsed.visibility };
        } else {
          // Fallback to top-level booleans
          Object.keys(DEFAULT_VISIBILITY).forEach(k => {
            if (typeof parsed[k] === 'boolean') vis[k] = parsed[k];
          });
        }
      }
      if (pinnedRaw) {
        const pinnedList: string[] = JSON.parse(pinnedRaw);
        if (Array.isArray(pinnedList)) {
          DEFAULT_NAV_ORDER.forEach(k => {
            if (k !== 'forYou' && k !== 'starred' && k !== 'spaces') {
              vis[k] = pinnedList.includes(k);
            }
          });
        }
      }
      return vis;
    } catch {}
    return DEFAULT_VISIBILITY;
  });

  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem('lira_sidebar_customization');
      const pinnedRaw = localStorage.getItem('lira_sidebar_pinned');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.navOrder) && parsed.navOrder.length > 0) {
          const existing = new Set(parsed.navOrder);
          setNavOrder([...parsed.navOrder, ...DEFAULT_NAV_ORDER.filter(k => !existing.has(k))]);
        }
        if (Array.isArray(parsed.appsOrder) && parsed.appsOrder.length > 0) {
          const existing = new Set(parsed.appsOrder);
          setAppsOrder([...parsed.appsOrder, ...DEFAULT_APPS_ORDER.filter(k => !existing.has(k))]);
        }
        let vis: Record<string, boolean> = { ...DEFAULT_VISIBILITY };
        if (parsed.visibility) {
          vis = { ...DEFAULT_VISIBILITY, ...parsed.visibility };
        } else {
          Object.keys(DEFAULT_VISIBILITY).forEach(k => {
            if (typeof parsed[k] === 'boolean') vis[k] = parsed[k];
          });
        }
        if (pinnedRaw) {
          const pinnedList: string[] = JSON.parse(pinnedRaw);
          if (Array.isArray(pinnedList)) {
            DEFAULT_NAV_ORDER.forEach(k => {
              if (k !== 'forYou' && k !== 'starred' && k !== 'spaces') {
                vis[k] = pinnedList.includes(k);
              }
            });
          }
        }
        setVisibility(vis);
      } else if (pinnedRaw) {
        const pinnedList: string[] = JSON.parse(pinnedRaw);
        if (Array.isArray(pinnedList)) {
          const vis: Record<string, boolean> = { ...DEFAULT_VISIBILITY };
          DEFAULT_NAV_ORDER.forEach(k => {
            if (k !== 'forYou' && k !== 'starred' && k !== 'spaces') {
              vis[k] = pinnedList.includes(k);
            }
          });
          setVisibility(vis);
        }
      }
    } catch {}
  }, [isOpen]);

  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);

  const toggleVisibility = (key: string) => {
    if (key === 'forYou') return; // Locked like Jira
    setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const moveItem = (section: 'nav' | 'apps', fromIdx: number, toIdx: number) => {
    if (section === 'nav') {
      if (fromIdx === 0 || toIdx === 0) return; // 'forYou' stays at top
      if (toIdx < 0 || toIdx >= navOrder.length) return;
      setNavOrder(prev => {
        const next = [...prev];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        return next;
      });
    } else {
      if (toIdx < 0 || toIdx >= appsOrder.length) return;
      setAppsOrder(prev => {
        const next = [...prev];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        return next;
      });
    }
    setOpenMenuKey(null);
  };

  const handleResetDefaults = () => {
    setNavOrder(DEFAULT_NAV_ORDER);
    setAppsOrder(DEFAULT_APPS_ORDER);
    setVisibility(DEFAULT_VISIBILITY);
    const defaultPinned = DEFAULT_NAV_ORDER.filter(
      k => k !== 'forYou' && k !== 'starred' && k !== 'spaces' && DEFAULT_VISIBILITY[k] === true
    );
    localStorage.setItem('lira_sidebar_pinned', JSON.stringify(defaultPinned));
  };

  const handleSave = () => {
    const finalConfig: SidebarConfig = {
      navOrder,
      appsOrder,
      visibility,
      ...visibility,
    };
    localStorage.setItem('lira_sidebar_customization', JSON.stringify(finalConfig));
    const pinned = navOrder.filter(
      k => k !== 'forYou' && k !== 'starred' && k !== 'spaces' && visibility[k] === true
    );
    localStorage.setItem('lira_sidebar_pinned', JSON.stringify(pinned));
    onSave?.(finalConfig);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Customise your sidebar" size="md">
      <div className="p-6 space-y-5 text-jira-text max-h-[82vh] overflow-y-auto">
        <p className="text-xs text-jira-muted leading-relaxed">
          Selected items will always be visible in the sidebar. You can still access unselected items from the{' '}
          <strong className="text-jira-text">More</strong> menu in the sidebar.
          <br />
          The changes you make here only affect you and not anyone else on your site.
        </p>

        {/* 1. Jira Navigation Section */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-jira-text">Jira navigation</h3>
            <span className="text-[11px] text-jira-muted">Reorder &amp; toggle visibility</span>
          </div>
          <p className="text-xs text-jira-muted mb-3">The following navigation items are available in Jira.</p>

          <div className="space-y-1">
            {navOrder.map((key, idx) => {
              const item = ALL_NAV_ITEMS[key];
              if (!item) return null;
              const isVisible = visibility[key] !== false;

              return (
                <div
                  key={key}
                  draggable={!item.locked}
                  onDragStart={() => setDraggedKey(key)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggedKey && draggedKey !== key && !item.locked) {
                      const fromIdx = navOrder.indexOf(draggedKey);
                      if (fromIdx > 0 && idx > 0) {
                        moveItem('nav', fromIdx, idx);
                      }
                    }
                  }}
                  onDragEnd={() => setDraggedKey(null)}
                  className={`group relative flex items-center justify-between p-2 rounded-lg transition-colors border ${
                    isVisible
                      ? 'bg-blue-50/20 border-blue-100 hover:bg-blue-50/40'
                      : 'bg-white border-transparent hover:bg-gray-50'
                  } ${draggedKey === key ? 'opacity-50 ring-2 ring-jira-blue' : ''}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Grip handle & Reorder arrows */}
                    {item.locked ? (
                      <div className="w-5 flex items-center justify-center text-gray-300">
                        <Check className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-0.5 text-gray-400">
                        <div
                          className="cursor-grab active:cursor-grabbing p-0.5 hover:text-jira-blue"
                          title="Drag to reorder"
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => moveItem('nav', idx, idx - 1)}
                            disabled={idx <= 1}
                            className="p-0.2 hover:text-jira-blue disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem('nav', idx, idx + 1)}
                            disabled={idx >= navOrder.length - 1}
                            className="p-0.2 hover:text-jira-blue disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isVisible}
                      disabled={item.locked}
                      onChange={() => toggleVisibility(key)}
                      className="w-4 h-4 text-jira-blue rounded border-gray-300 focus:ring-jira-blue cursor-pointer disabled:opacity-50"
                    />

                    {/* Icon + Label */}
                    <span className="flex-shrink-0">{item.icon}</span>
                    <span className={`text-xs font-medium truncate ${isVisible ? 'text-jira-text' : 'text-jira-muted'}`}>
                      {item.label}
                    </span>
                  </div>

                  {/* Context menu for reordering options */}
                  {!item.locked && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenuKey(openMenuKey === key ? null : key)}
                        className="p-1 rounded text-gray-400 hover:text-jira-text hover:bg-gray-100 transition-colors cursor-pointer"
                        title="More options"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {openMenuKey === key && (
                        <div
                          className="absolute right-0 top-full mt-1 w-44 bg-white border border-jira-border rounded-lg shadow-xl py-1 z-50 text-xs text-jira-text animate-scale-in"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => moveItem('nav', idx, idx - 1)}
                            disabled={idx <= 1}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left disabled:opacity-40 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" /> Move up
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem('nav', idx, idx + 1)}
                            disabled={idx >= navOrder.length - 1}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left disabled:opacity-40 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" /> Move down
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem('nav', idx, 1)}
                            disabled={idx <= 1}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left disabled:opacity-40 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" /> Move to top
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem('nav', idx, navOrder.length - 1)}
                            disabled={idx >= navOrder.length - 1}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left disabled:opacity-40 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" /> Move to bottom
                          </button>
                          <div className="border-t border-gray-100 my-1" />
                          <button
                            type="button"
                            onClick={() => { toggleVisibility(key); setOpenMenuKey(null); }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left cursor-pointer"
                          >
                            {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            {isVisible ? 'Hide from sidebar' : 'Show in sidebar'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. App Shortcuts Section */}
        <div className="border-t border-jira-border pt-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-jira-text">App shortcuts</h3>
            <span className="text-[11px] text-jira-muted">Reorder &amp; toggle visibility</span>
          </div>
          <p className="text-xs text-jira-muted mb-3">The following Atlassian apps are available for your organisation.</p>

          <div className="space-y-1">
            {appsOrder.map((key, idx) => {
              const item = ALL_APP_ITEMS[key];
              if (!item) return null;
              const isVisible = visibility[key] !== false;

              return (
                <div
                  key={key}
                  draggable
                  onDragStart={() => setDraggedKey(key)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggedKey && draggedKey !== key) {
                      const fromIdx = appsOrder.indexOf(draggedKey);
                      if (fromIdx >= 0) {
                        moveItem('apps', fromIdx, idx);
                      }
                    }
                  }}
                  onDragEnd={() => setDraggedKey(null)}
                  className={`group relative flex items-center justify-between p-2 rounded-lg transition-colors border ${
                    isVisible
                      ? 'bg-blue-50/20 border-blue-100 hover:bg-blue-50/40'
                      : 'bg-white border-transparent hover:bg-gray-50'
                  } ${draggedKey === key ? 'opacity-50 ring-2 ring-jira-blue' : ''}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="flex items-center gap-0.5 text-gray-400">
                      <div
                        className="cursor-grab active:cursor-grabbing p-0.5 hover:text-jira-blue"
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => moveItem('apps', idx, idx - 1)}
                          disabled={idx === 0}
                          className="p-0.2 hover:text-jira-blue disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem('apps', idx, idx + 1)}
                          disabled={idx === appsOrder.length - 1}
                          className="p-0.2 hover:text-jira-blue disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => toggleVisibility(key)}
                      className="w-4 h-4 text-jira-blue rounded border-gray-300 focus:ring-jira-blue cursor-pointer"
                    />

                    <span className="flex-shrink-0">{item.icon}</span>
                    <span className={`text-xs font-medium truncate ${isVisible ? 'text-jira-text' : 'text-jira-muted'}`}>
                      {item.label}
                    </span>
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenMenuKey(openMenuKey === key ? null : key)}
                      className="p-1 rounded text-gray-400 hover:text-jira-text hover:bg-gray-100 transition-colors cursor-pointer"
                      title="More options"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {openMenuKey === key && (
                      <div
                        className="absolute right-0 top-full mt-1 w-44 bg-white border border-jira-border rounded-lg shadow-xl py-1 z-50 text-xs text-jira-text animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => moveItem('apps', idx, idx - 1)}
                          disabled={idx === 0}
                          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" /> Move up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem('apps', idx, idx + 1)}
                          disabled={idx === appsOrder.length - 1}
                          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" /> Move down
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem('apps', idx, 0)}
                          disabled={idx === 0}
                          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" /> Move to top
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem('apps', idx, appsOrder.length - 1)}
                          disabled={idx === appsOrder.length - 1}
                          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" /> Move to bottom
                        </button>
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          type="button"
                          onClick={() => { toggleVisibility(key); setOpenMenuKey(null); }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left cursor-pointer"
                        >
                          {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          {isVisible ? 'Hide from sidebar' : 'Show in sidebar'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-jira-border pt-4">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs text-jira-muted hover:text-jira-text font-medium px-2 py-1.5 rounded hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to default
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-jira-muted hover:text-jira-text rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-sm font-semibold bg-jira-blue text-white rounded-lg hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
