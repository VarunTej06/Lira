import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Settings, Plus, HardDrive, CheckCircle2, AlertCircle } from 'lucide-react';
import { exportBackup, importBackup } from '../../db/storageService';
import { subscribeToSyncStatus, saveToDiskNow } from '../../services/localDiskSync';
import { AccountDropdown } from './AccountDropdown';
import { SettingsModal, type SettingsSection } from './SettingsModal';
import {
  GeneralSettingsModal,
  NotificationSettingsModal,
  ManageSpacesModal,
  WorkItemsModal,
  MarketplaceModal,
  UserManagementModal,
  BillingModal,
} from './SettingsModals';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { AppLauncher } from './topnav/AppLauncher';
import { YourWorkDropdown } from './topnav/YourWorkDropdown';
import { FiltersDropdown } from './topnav/FiltersDropdown';
import { OmniSearch } from './topnav/OmniSearch';
import { NotificationsBell } from './topnav/NotificationsBell';
import { SystemSettingsModal } from './topnav/SystemSettingsModal';
import { appStorage } from '../../utils/appStorage';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TopNavigationProps {
  onCreateIssue?: () => void;
  onToggleAI?: () => void;
  issues?: Issue[];
  spaces?: Space[];
  onSelectIssue?: (issue: Issue) => void;
  onApplyFilter?: (filter: string) => void;
  onNavigateToFilters?: () => void;
  onNavigateToProjects?: () => void;
}

// ─── Main TopNavigation Export ────────────────────────────────────────────────

export const TopNavigation: React.FC<TopNavigationProps> = ({
  onCreateIssue,
  onToggleAI,
  issues = [],
  spaces = [],
  onSelectIssue,
  onApplyFilter,
  onNavigateToFilters,
  onNavigateToProjects,
}) => {
  const [showUnifiedSettingsModal, setShowUnifiedSettingsModal] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsSection>('appearance');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const [showSystemModal, setShowSystemModal] = useState(false);
  const [showGeneralModal, setShowGeneralModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showSpacesModal, setShowSpacesModal] = useState(false);
  const [showWorkItemsModal, setShowWorkItemsModal] = useState(false);
  const [showMarketplaceModal, setShowMarketplaceModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<{ status: string; lastSaved: Date | null; filePath: string }>({
    status: 'synced',
    lastSaved: null,
    filePath: 'data/lira-workspace.json',
  });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return subscribeToSyncStatus(setSyncState);
  }, []);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const result = await importBackup(file);
      const msg = `Imported ${result.spaces} spaces and ${result.issues} issues!`;
      setImportStatus(msg);
      showToast(msg, 'success');
    } catch (err) {
      const errText = `Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setImportStatus(`Error: ${errText}`);
      showToast(errText, 'error');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [showToast]);

  const handleExport = useCallback(async () => {
    try {
      await exportBackup();
      const msg = 'Backup downloaded & synced to PC disk (data/spaces/*.json)!';
      setImportStatus(msg);
      showToast(msg, 'success');
    } catch (err) {
      const errText = `Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setImportStatus(`Error: ${errText}`);
      showToast(errText, 'error');
    }
  }, [showToast]);

  return (
    <nav className="mx-2 mt-2 h-14 rounded-2xl bg-lira-nav border border-white/[0.08] shadow-[0_8px_26px_rgba(0,0,0,0.32)] flex items-center px-3 gap-2 flex-shrink-0 z-40 relative">
      {/* App Launcher with Custom Geometric Logo */}
      <AppLauncher
        onToggleAI={onToggleAI}
        onNavigateToProjects={onNavigateToProjects}
        onOpenBackup={() => {
          setSettingsInitialSection('backup');
          setShowUnifiedSettingsModal(true);
        }}
      />

      {/* Lira Logo + Brand */}
      <div className="flex-shrink-0 flex items-center gap-2 mr-2 px-1.5 py-1 rounded-xl cursor-pointer select-none transition-transform duration-200 hover:scale-[1.04]">
        <img
          src="/lira-logo.png"
          alt="Lira Logo"
          className="w-7 h-7 object-contain drop-shadow-xs"
        />
        <span className="text-white font-bold text-base tracking-tight">Lira</span>
      </div>

      {/* Nav items — Your work + Filters */}
      <div className="hidden md:flex items-center gap-0.5">
        <YourWorkDropdown issues={issues} spaces={spaces} onSelectIssue={onSelectIssue} />
        <FiltersDropdown
          onApplyFilter={onApplyFilter}
          onNavigateToFilters={onNavigateToFilters}
        />
      </div>

      {/* Omni-Search */}
      <OmniSearch issues={issues} spaces={spaces} onSelectIssue={onSelectIssue} />

      {/* Create button */}
      <button
        onClick={onCreateIssue}
        className="flex items-center gap-1.5 px-4 py-2 bg-lira-blue hover:bg-lira-blue-hover text-lira-on-blue text-sm font-semibold rounded-xl shadow-[0_4px_14px_rgb(var(--lira-blue)/0.35)] hover:shadow-[0_6px_18px_rgb(var(--lira-blue)/0.5)] hover:-translate-y-px active:translate-y-0 transition-all duration-200 ml-1 cursor-pointer"
        title="Create a ticket — you'll choose the space"
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">Create</span>
      </button>

      {/* Local PC Storage Indicator */}
      <button
        type="button"
        onClick={async () => {
          const ok = await saveToDiskNow();
          showToast(
            ok ? 'Workspace saved to local PC disk (data/spaces/*.json)!' : 'Failed to save to PC disk',
            ok ? 'success' : 'error'
          );
        }}
        className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all border border-white/15 hover:border-white/30 hover:bg-white/5 ml-auto cursor-pointer"
        title={`Saved locally on your PC in: ${syncState.filePath}\nClick to force save now.`}
      >
        <HardDrive className="w-3.5 h-3.5 text-white/60" />
        {syncState.status === 'saving' ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-amber-300 text-2xs font-medium">Saving to PC…</span>
          </>
        ) : syncState.status === 'error' ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="text-red-300 text-2xs font-medium">Save error</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-emerald-300 text-2xs font-medium">PC Saved</span>
          </>
        )}
      </button>

      {/* Right utilities */}
      <div className="flex items-center gap-1 ml-1">
        <NotificationsBell issues={issues} onSelectIssue={onSelectIssue} />

        {/* Wired Settings Gear Icon Button */}
        <button
          onClick={() => {
            setSettingsInitialSection('appearance');
            setShowUnifiedSettingsModal(true);
          }}
          className={`p-2 rounded-xl hover:bg-white/10 transition-all duration-200 hover:rotate-45 cursor-pointer ${
            showUnifiedSettingsModal ? 'bg-white/15 text-white ring-1 ring-white/30' : 'text-white/70 hover:text-white'
          }`}
          title="Settings & Administration"
        >
          <Settings className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
        </button>

        <AccountDropdown />
      </div>

      {/* Hidden file input for import */}
      <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

      {/* Unified Settings Modal (Appearance, Export/Backup, Profile) */}
      <SettingsModal
        isOpen={showUnifiedSettingsModal}
        onClose={() => setShowUnifiedSettingsModal(false)}
        initialSection={settingsInitialSection}
        onToast={showToast}
      />

      {/* Toast Feedback Banner */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold animate-scale-in transition-all ${
          toast.type === 'error'
            ? 'bg-red-900/95 text-red-100 border-red-700'
            : 'bg-lira-nav/95 text-white border-white/20'
        }`}>
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* System Settings & Data Backup Modal */}
      <SystemSettingsModal
        isOpen={showSystemModal}
        onClose={() => { setShowSystemModal(false); setImportStatus(null); }}
        importing={importing}
        importStatus={importStatus}
        onExport={handleExport}
        onImportClick={() => fileRef.current?.click()}
      />

      {/* Settings modals */}
      <GeneralSettingsModal isOpen={showGeneralModal} onClose={() => setShowGeneralModal(false)} />
      <NotificationSettingsModal isOpen={showNotifModal} onClose={() => setShowNotifModal(false)} />
      <ManageSpacesModal
        isOpen={showSpacesModal}
        onClose={() => setShowSpacesModal(false)}
        spaces={spaces}
        onSelectSpace={(id) => {
          appStorage.set('lira_active_space_id', String(id));
          window.location.reload();
        }}
      />
      <WorkItemsModal isOpen={showWorkItemsModal} onClose={() => setShowWorkItemsModal(false)} />
      <MarketplaceModal isOpen={showMarketplaceModal} onClose={() => setShowMarketplaceModal(false)} />
      <UserManagementModal isOpen={showUsersModal} onClose={() => setShowUsersModal(false)} />
      <BillingModal isOpen={showBillingModal} onClose={() => setShowBillingModal(false)} />
    </nav>
  );
};
