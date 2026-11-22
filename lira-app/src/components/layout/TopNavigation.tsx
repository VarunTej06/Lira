import { BrandMark } from './BrandMark';
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
import { YourWorkDropdown } from './topnav/YourWorkDropdown';
import { FiltersDropdown } from './topnav/FiltersDropdown';
import { OmniSearch } from './topnav/OmniSearch';
import { NotificationsBell } from './topnav/NotificationsBell';
import { SystemSettingsModal } from './topnav/SystemSettingsModal';
import { appStorage } from '../../utils/appStorage';
import { isHosted } from '../../utils/edition';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TopNavigationProps {
  onCreateIssue?: () => void;
  issues?: Issue[];
  spaces?: Space[];
  onSelectIssue?: (issue: Issue) => void;
  onApplyFilter?: (filter: string) => void;
  onNavigateToFilters?: () => void;
}

// ─── Main TopNavigation Export ────────────────────────────────────────────────

export const TopNavigation: React.FC<TopNavigationProps> = ({
  onCreateIssue,
  issues = [],
  spaces = [],
  onSelectIssue,
  onApplyFilter,
  onNavigateToFilters,
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
    <nav className="mx-2 mt-2 h-14 flex items-center gap-3 flex-shrink-0 z-40 relative">
      {/* Left: the product mark, on the page frame */}
      <BrandMark />

      {/* Centre: the working controls, in one dark box */}
      <div className="flex-[0_1_auto] min-w-0 h-14 rounded-2xl bg-lira-nav border border-white/[0.08] flex items-center px-3 gap-2">
        <div className="hidden md:flex items-center gap-0.5">
          <YourWorkDropdown issues={issues} spaces={spaces} onSelectIssue={onSelectIssue} />
          <FiltersDropdown
            onApplyFilter={onApplyFilter}
            onNavigateToFilters={onNavigateToFilters}
          />
        </div>
        <OmniSearch issues={issues} spaces={spaces} onSelectIssue={onSelectIssue} />
        <button
          onClick={onCreateIssue}
          className="flex items-center gap-1.5 px-4 py-2 bg-lira-blue hover:bg-lira-blue-hover text-lira-on-blue text-sm font-semibold rounded-xl transition-colors duration-150 ml-1 cursor-pointer"
          title="Create a ticket. You'll choose the space"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Create</span>
        </button>
      </div>

      {/* Right: save state and utilities, on the page frame */}
      <div className="flex-1 basis-0 flex items-center justify-end gap-2">

      {/* Local PC Storage Indicator: it saves to this computer's disk through the local server, so the hosted edition has none */}
      {!isHosted() && (
      <button
        type="button"
        onClick={async () => {
          const ok = await saveToDiskNow();
          showToast(
            ok ? 'Workspace saved to local PC disk (data/spaces/*.json)!' : 'Failed to save to PC disk',
            ok ? 'success' : 'error'
          );
        }}
        className="hidden lg:flex items-center gap-1.5 px-2 py-1 text-xs text-lira-text hover:opacity-70 transition-opacity cursor-pointer"
        title={`Saved locally on your PC in: ${syncState.filePath}\nClick to force save now.`}
      >
        <HardDrive className="w-4 h-4" />
        {syncState.status === 'saving' ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-2xs font-medium">Saving to PC…</span>
          </>
        ) : syncState.status === 'error' ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="text-2xs font-medium">Save error</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-2xs font-medium">PC Saved</span>
          </>
        )}
      </button>
      )}

        <NotificationsBell issues={issues} onSelectIssue={onSelectIssue} />

        {/* Wired Settings Gear Icon Button */}
        <button
          onClick={() => {
            setSettingsInitialSection('appearance');
            setShowUnifiedSettingsModal(true);
          }}
          className={`w-10 h-10 rounded-full flex items-center justify-center bg-lira-nav border border-white/10 hover:border-white/30 transition-colors cursor-pointer ${
            showUnifiedSettingsModal ? 'text-white ring-1 ring-white/40' : 'text-white/75 hover:text-white'
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
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-semibold animate-scale-in transition-all ${
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
