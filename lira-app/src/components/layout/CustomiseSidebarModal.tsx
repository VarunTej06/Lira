import { notifySaved } from '../common/savedToastStore';
import React, { useState, useEffect } from 'react';
import {
  GripVertical, MoreHorizontal, User, Map, Folder, Ticket, CalendarClock, LayoutDashboard, EyeOff as HiddenIcon,
  ChevronUp, ChevronDown, Check, ArrowUp, ArrowDown, Eye, EyeOff, RotateCcw, FolderKanban,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { type SidebarConfig, DEFAULT_NAV_ORDER, DEFAULT_SECTION_ORDER, loadSidebarConfig, CONFIG_VERSION, DEFAULT_VISIBILITY } from './sidebarConfig';
import { useResetWhen } from '../../hooks/useResetWhen';
import { appStorage } from '../../utils/appStorage';

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

const ico = 'w-4 h-4 text-gray-500';
const NAV_ITEMS: Record<string, SidebarItemDef> = {
  forYou: { key: 'forYou', label: 'For you', icon: <User className={ico} />, locked: true },
  projects: { key: 'projects', label: 'Projects', icon: <FolderKanban className="w-4 h-4 text-violet-500" /> },
  sprints: { key: 'sprints', label: 'Sprints', icon: <CalendarClock className="w-4 h-4 text-teal-500" /> },
  allTickets: { key: 'allTickets', label: 'All tickets', icon: <Ticket className="w-4 h-4 text-yellow-500" /> },
  roadmaps: { key: 'roadmaps', label: 'Roadmaps', icon: <Map className="w-4 h-4 text-orange-500" /> },
  dashboards: { key: 'dashboards', label: 'Dashboards', icon: <LayoutDashboard className="w-4 h-4 text-purple-500" /> },
};

const SECTION_ITEMS: Record<string, SidebarItemDef> = {
  sec_spaces: { key: 'sec_spaces', label: 'Spaces', icon: <Folder className={ico} /> },
  sec_projects: { key: 'sec_projects', label: 'Projects', icon: <FolderKanban className={ico} /> },
  sec_sprints: { key: 'sec_sprints', label: 'Sprints', icon: <CalendarClock className={ico} /> },
  sec_hidden: { key: 'sec_hidden', label: 'Hidden spaces', icon: <HiddenIcon className="w-4 h-4 text-amber-500" /> },
};

type Section = 'nav' | 'sections';

export const CustomiseSidebarModal: React.FC<CustomiseSidebarModalProps> = ({ isOpen, onClose, onSave }) => {
  const initial = loadSidebarConfig();
  const [navOrder, setNavOrder] = useState<string[]>(initial.navOrder);
  const [sectionOrder, setSectionOrder] = useState<string[]>(initial.sectionOrder);
  const [visibility, setVisibility] = useState<Record<string, boolean>>(initial.visibility);

  // Re-read the saved layout each time the dialog opens, so Cancel really discards edits
  useResetWhen([isOpen], () => {
    if (!isOpen) return;
    const cfg = loadSidebarConfig();
    setNavOrder(cfg.navOrder);
    setSectionOrder(cfg.sectionOrder);
    setVisibility(cfg.visibility);
  });

  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);

  // An open "..." menu closes on a click anywhere else (or Escape), not only on its own button
  useEffect(() => {
    if (!openMenuKey) return;
    const away = (e: MouseEvent) => {
      const holder = (e.target as Element | null)?.closest?.('[data-sidebar-menu]');
      if (holder?.getAttribute('data-sidebar-menu') !== openMenuKey) setOpenMenuKey(null);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpenMenuKey(null); } };
    document.addEventListener('mousedown', away, true);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', away, true); document.removeEventListener('keydown', esc, true); };
  }, [openMenuKey]);

  const toggleVisibility = (key: string) => {
    if (key === 'forYou') return; // locked: it is always shown
    setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const moveItem = (section: Section, fromIdx: number, toIdx: number) => {
    const setter = section === 'nav' ? setNavOrder : setSectionOrder;
    const length = section === 'nav' ? navOrder.length : sectionOrder.length;
    if (section === 'nav' && (fromIdx === 0 || toIdx === 0)) return; // 'forYou' stays at top
    if (toIdx < 0 || toIdx >= length) return;
    setter(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setOpenMenuKey(null);
  };

  const handleResetDefaults = () => {
    setNavOrder(DEFAULT_NAV_ORDER);
    setSectionOrder(DEFAULT_SECTION_ORDER);
    setVisibility(DEFAULT_VISIBILITY);
  };

  const handleSave = () => {
    const finalConfig: SidebarConfig = { version: CONFIG_VERSION, navOrder, sectionOrder, visibility };
    let previous = '';
    try {
      const raw = appStorage.get('lira_sidebar_customization');
      const base = raw ? JSON.parse(raw) : { navOrder: DEFAULT_NAV_ORDER, sectionOrder: DEFAULT_SECTION_ORDER, visibility: DEFAULT_VISIBILITY };
      previous = JSON.stringify([base.navOrder, base.sectionOrder, base.visibility]);
    } catch { /* treat as changed */ }
    if (previous === JSON.stringify([navOrder, sectionOrder, visibility])) { onClose(); return; }
    appStorage.set('lira_sidebar_customization', JSON.stringify(finalConfig));
    onSave?.(finalConfig);
    notifySaved('Sidebar saved');
    onClose();
  };

  /** One list of reorderable, toggleable rows (used for both blocks). */
  const renderList = (section: Section, order: string[], defs: Record<string, SidebarItemDef>) => {
    const first = section === 'nav' ? 1 : 0; // For you is fixed at index 0 in the nav block
    return (
      <div className="space-y-1">
        {order.map((key, idx) => {
          const item = defs[key];
          if (!item) return null;
          const isVisible = visibility[key] !== false;
          const canUp = idx > first;
          const canDown = idx < order.length - 1;
          return (
            <div
              key={key}
              draggable={!item.locked}
              onDragStart={() => setDraggedKey(key)}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedKey && draggedKey !== key && !item.locked) {
                  const fromIdx = order.indexOf(draggedKey);
                  if (fromIdx >= first && idx >= first) moveItem(section, fromIdx, idx);
                }
              }}
              onDragEnd={() => setDraggedKey(null)}
              className={`group relative flex items-center justify-between p-2 rounded-lg transition-colors border ${
                isVisible ? 'bg-blue-50/20 border-blue-100 hover:bg-blue-50/40' : 'bg-white border-transparent hover:bg-gray-50'
              } ${draggedKey === key ? 'opacity-50 ring-2 ring-lira-blue' : ''}`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {item.locked ? (
                  <div className="w-5 flex items-center justify-center text-gray-300">
                    <Check className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                ) : (
                  <div className="flex items-center gap-0.5 text-gray-400">
                    <div className="cursor-grab active:cursor-grabbing p-0.5 hover:text-lira-blue" title="Drag to reorder">
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col">
                      <button type="button" onClick={() => moveItem(section, idx, idx - 1)} disabled={!canUp} className="p-0.2 hover:text-lira-blue disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed" title="Move up">
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={() => moveItem(section, idx, idx + 1)} disabled={!canDown} className="p-0.2 hover:text-lira-blue disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed" title="Move down">
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

                <input
                  type="checkbox"
                  checked={isVisible}
                  disabled={item.locked}
                  onChange={() => toggleVisibility(key)}
                  className="w-4 h-4 text-lira-blue rounded border-gray-300 focus:ring-lira-blue cursor-pointer disabled:opacity-50"
                />
                <span className="flex-shrink-0">{item.icon}</span>
                <span className={`text-xs font-medium truncate ${isVisible ? 'text-lira-text' : 'text-lira-muted'}`}>{item.label}</span>
              </div>

              {!item.locked && (
                <div className="relative" data-sidebar-menu={key}>
                  <button
                    type="button"
                    onClick={() => setOpenMenuKey(openMenuKey === key ? null : key)}
                    className="p-1 rounded text-gray-400 hover:text-lira-text hover:bg-gray-100 transition-colors cursor-pointer"
                    title="More options"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {openMenuKey === key && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-lira-border rounded-lg shadow-xl py-1 z-50 text-xs text-lira-text animate-scale-in" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => moveItem(section, idx, idx - 1)} disabled={!canUp} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left disabled:opacity-40 cursor-pointer">
                        <ArrowUp className="w-3.5 h-3.5" /> Move up
                      </button>
                      <button type="button" onClick={() => moveItem(section, idx, idx + 1)} disabled={!canDown} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left disabled:opacity-40 cursor-pointer">
                        <ArrowDown className="w-3.5 h-3.5" /> Move down
                      </button>
                      <button type="button" onClick={() => moveItem(section, idx, first)} disabled={!canUp} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left disabled:opacity-40 cursor-pointer">
                        <ArrowUp className="w-3.5 h-3.5" /> Move to top
                      </button>
                      <button type="button" onClick={() => moveItem(section, idx, order.length - 1)} disabled={!canDown} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left disabled:opacity-40 cursor-pointer">
                        <ArrowDown className="w-3.5 h-3.5" /> Move to bottom
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      <button type="button" onClick={() => { toggleVisibility(key); setOpenMenuKey(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left cursor-pointer">
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
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Customise your sidebar" size="md">
      <div className="p-6 space-y-5 text-lira-text max-h-[82vh] overflow-y-auto">
        <p className="text-xs text-lira-muted leading-relaxed">
          Selected items will always be visible in the sidebar. Drag items, or use the arrows, to change their order.
          <br />
          The changes you make here only affect you and not anyone else on your site.
        </p>

        {/* 1. Navigation */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-lira-text">Navigation</h3>
            <span className="text-2xs text-lira-muted">Reorder &amp; toggle visibility</span>
          </div>
          <p className="text-xs text-lira-muted mb-3">Pages shown at the top of the sidebar.</p>
          {renderList('nav', navOrder, NAV_ITEMS)}
        </div>

        {/* 2. Sections */}
        <div className="border-t border-lira-border pt-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-lira-text">Sections</h3>
            <span className="text-2xs text-lira-muted">Reorder &amp; toggle visibility</span>
          </div>
          <p className="text-xs text-lira-muted mb-3">Expandable lists below the navigation.</p>
          {renderList('sections', sectionOrder, SECTION_ITEMS)}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-lira-border pt-4">
          <button type="button" onClick={handleResetDefaults} className="flex items-center gap-1.5 text-xs text-lira-muted hover:text-lira-text font-medium px-2 py-1.5 rounded hover:bg-gray-100 transition-colors cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to default
          </button>

          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-lira-muted hover:text-lira-text rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="button" onClick={handleSave} className="px-4 py-2 text-sm font-semibold bg-lira-blue text-white rounded-lg hover:bg-blue-700 transition-colors shadow-xs cursor-pointer">
              Save changes
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
