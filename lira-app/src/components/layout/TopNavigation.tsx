import React, { useState, useCallback, useEffect } from 'react';
import {
  Search, Bell, Settings, ChevronDown, Grid3X3,
  Plus, Download, Upload, HardDrive
} from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { Modal } from '../common/Modal';
import { exportBackup, importBackup } from '../../db/storageService';
import { subscribeToSyncStatus, saveToDiskNow } from '../../services/localDiskSync';
import { LiraAIAvatar } from '../ai/LiraAIAvatar';

interface TopNavigationProps {
  onCreateIssue?: () => void;
  onToggleAI?: () => void;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({ onCreateIssue, onToggleAI }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showBackup, setShowBackup] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<{ status: string; lastSaved: Date | null; filePath: string }>({
    status: 'synced',
    lastSaved: null,
    filePath: 'data/lira-workspace.json',
  });
  const fileRef = React.useRef<HTMLInputElement>(null);

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
      setImportStatus(`✅ Imported ${result.spaces} spaces and ${result.issues} issues. Refresh to see changes.`);
    } catch (err) {
      setImportStatus(`❌ Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, []);

  return (
    <nav className="h-14 bg-[#1D2125] flex items-center px-3 gap-2 flex-shrink-0 z-40 relative">
      {/* App switcher */}
      <button className="p-1.5 rounded hover:bg-white/10 transition-colors text-white/70 hover:text-white">
        <Grid3X3 className="w-5 h-5" />
      </button>

      {/* Lira Logo + Brand */}
      <div className="flex items-center gap-2 mr-2 cursor-pointer select-none">
        <img
          src="/lira-logo.png"
          alt="Lira Logo"
          className="w-7 h-7 object-contain drop-shadow-xs"
        />
        <span className="text-white font-bold text-base tracking-tight">Lira</span>
      </div>

      {/* Nav items */}
      <div className="hidden md:flex items-center gap-0.5">
        {['Your work', 'Projects', 'Filters', 'Dashboards', 'Teams'].map(item => (
          <button
            key={item}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[13px] text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            {item} <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex-1 max-w-xs mx-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white/10 text-white placeholder-white/40 text-xs rounded pl-8 pr-3 py-1.5 border border-white/10 focus:outline-none focus:bg-white/15 focus:border-white/30 transition-all"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/30 font-mono">/</kbd>
        </div>
      </div>

      {/* Create button */}
      <button
        onClick={onCreateIssue}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0052CC] hover:bg-[#0065FF] text-white text-sm font-medium rounded transition-colors ml-1"
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">Create</span>
      </button>

      {/* Lira AI Button */}
      <button
        type="button"
        onClick={onToggleAI}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md hover:shadow-purple-500/25 transition-all cursor-pointer ml-1"
        title="Open Lira AI Chatbot & Autonomous Agent"
      >
        <LiraAIAvatar size={18} hasSparkles={false} />
        <span className="hidden sm:inline">Lira AI</span>
      </button>

      {/* Local PC Storage Indicator */}
      <button
        type="button"
        onClick={() => saveToDiskNow()}
        className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all border border-white/15 hover:border-white/30 hover:bg-white/5 ml-auto cursor-pointer"
        title={`Saved locally on your PC in: ${syncState.filePath}\nClick to force save now.`}
      >
        <HardDrive className="w-3.5 h-3.5 text-white/60" />
        {syncState.status === 'saving' ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-amber-300 text-[11px] font-medium">Saving to PC…</span>
          </>
        ) : syncState.status === 'error' ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="text-red-300 text-[11px] font-medium">Save error</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-emerald-300 text-[11px] font-medium">PC Saved</span>
          </>
        )}
      </button>

      {/* Right utilities */}
      <div className="flex items-center gap-1 ml-1">
        <button
          onClick={() => setShowBackup(true)}
          className="p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          title="Backup & Restore"
        >
          <Download className="w-4.5 h-4.5" style={{width: 18, height: 18}} />
        </button>
        <button className="relative p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors">
          <Bell className="w-4.5 h-4.5" style={{width: 18, height: 18}} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-[#1D2125]" />
        </button>
        <button className="p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors">
          <Settings className="w-4.5 h-4.5" style={{width: 18, height: 18}} />
        </button>
        <Avatar initials="VY" size="sm" color="#0052CC" className="cursor-pointer hover:ring-2 hover:ring-white/50 transition-all ml-1" />
      </div>

      {/* Backup/Restore Modal */}
      <Modal isOpen={showBackup} onClose={() => { setShowBackup(false); setImportStatus(null); }} title="Backup & Restore" size="sm">
        <div className="p-6 space-y-4">
          <p className="text-sm text-jira-muted">
            All data is stored directly on your PC disk (<code className="text-xs bg-gray-100 px-1 py-0.5 rounded text-jira-text font-mono">data/lira-workspace.json</code>) and in local browser storage.
          </p>
          <div className="space-y-3">
            <button
              onClick={async () => {
                try {
                  await exportBackup();
                  setImportStatus('✅ Backup downloaded to your computer & synced to PC disk (data/spaces/*.json)');
                } catch (err) {
                  setImportStatus(`❌ Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                }
              }}
              className="w-full flex items-center justify-between px-4 py-3 bg-jira-blue-light text-jira-blue rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export JSON Backup
              </span>
              <span className="text-[11px] bg-jira-blue/15 px-2 py-0.5 rounded text-jira-blue font-semibold">
                PC File + Download
              </span>
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-jira-text rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium border border-jira-border disabled:opacity-50 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                {importing ? 'Importing...' : 'Import JSON Backup'}
              </span>
              <span className="text-[11px] text-jira-muted font-normal">
                Restore & Sync
              </span>
            </button>
            <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          </div>
          {importStatus && (
            <div className={`text-xs p-3 rounded-lg ${importStatus.startsWith('✅') ? 'bg-green-50 text-green-700 font-medium' : 'bg-red-50 text-red-700'}`}>
              {importStatus}
            </div>
          )}
          <div className="text-xs text-jira-muted bg-amber-50 border border-amber-200 rounded-lg p-3">
            ⚠️ Importing a backup will <strong>replace all current data</strong> in your browser and on your PC disk. Make sure to export first.
          </div>
        </div>
      </Modal>
    </nav>
  );
};
