import { HardDrive, Download, Upload, RefreshCw, Save } from 'lucide-react';
import type { SettingsState } from './useSettingsState';

/** Disk sync, export and import. */
export function BackupSection(s: SettingsState) {
  const { activeSection, syncState, backupLoading, restoreLoading, importStatus, fileInputRef, handleBackupToDisk, handleExportBackupJson, handleRestoreFromDisk, handleImportFile } = s;
  return (
    <>
          {/* 2. Export & Backup Section */}
          {activeSection === 'backup' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-lira-text">Export, Backup &amp; Local Disk Sync</h3>
                <p className="text-xs text-lira-muted mt-1">
                  Connect directly to the local disk synchronization service to protect, export, or restore your workspace.
                </p>
              </div>

              {/* Local Disk Persistence Card */}
              <div className="p-4 bg-gray-50 rounded-xl border border-lira-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-bold text-lira-text">Local PC Storage Engine</span>
                  </div>
                  <span className={`text-2xs font-semibold px-2.5 py-0.5 rounded-full ${
                    syncState.status === 'saving'
                      ? 'bg-amber-100 text-amber-800'
                      : syncState.status === 'error'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {syncState.status === 'saving' ? 'Saving…' : syncState.status === 'error' ? 'Sync Error' : '● Connected & Synced'}
                  </span>
                </div>

                <div className="text-xs text-lira-muted space-y-1">
                  <p>
                    Storage Path: <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200 font-mono text-2xs text-lira-text">{syncState.filePath}</code>
                  </p>
                  <p>
                    Dual-Sync Snapshot: <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200 font-mono text-2xs text-lira-text">data/lira-workspace.json</code>
                  </p>
                  {syncState.lastSaved && (
                    <p className="text-2xs text-gray-500">
                      Last disk save: {new Date(syncState.lastSaved).toLocaleTimeString()} ({new Date(syncState.lastSaved).toLocaleDateString()})
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Backup Now to Disk */}
                <button
                  type="button"
                  onClick={handleBackupToDisk}
                  disabled={backupLoading}
                  className="flex items-center justify-between p-3.5 bg-lira-blue-light hover:brightness-95 text-lira-blue border border-lira-border rounded-xl transition-all cursor-pointer font-semibold text-xs shadow-2xs group"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <Save className={`w-4 h-4 ${backupLoading ? 'animate-spin' : 'group-hover:scale-110 transition-transform'}`} />
                    <div>
                      <div className="text-sm font-bold">Backup Now</div>
                      <div className="text-2xs text-lira-blue font-normal">Sync database to PC disk</div>
                    </div>
                  </div>
                  <span className="text-3xs bg-lira-blue text-lira-on-blue px-2 py-0.5 rounded-full font-bold">
                    Disk Save
                  </span>
                </button>

                {/* Export Download JSON */}
                <button
                  type="button"
                  onClick={handleExportBackupJson}
                  className="flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100 text-lira-text border border-lira-border rounded-xl transition-all cursor-pointer font-semibold text-xs shadow-2xs group"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <Download className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="text-sm font-bold">Export Backup JSON</div>
                      <div className="text-2xs text-lira-muted font-normal">Download single backup file</div>
                    </div>
                  </div>
                  <span className="text-3xs bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">
                    Download
                  </span>
                </button>

                {/* Restore From Disk */}
                <button
                  type="button"
                  onClick={handleRestoreFromDisk}
                  disabled={restoreLoading}
                  className="flex items-center justify-between p-3.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl transition-all cursor-pointer font-semibold text-xs shadow-2xs group"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <RefreshCw className={`w-4 h-4 text-amber-700 ${restoreLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                    <div>
                      <div className="text-sm font-bold">Restore From Disk</div>
                      <div className="text-2xs text-amber-700 font-normal">Reload IndexedDB from disk</div>
                    </div>
                  </div>
                  <span className="text-3xs bg-amber-600 text-white px-2 py-0.5 rounded-full font-bold">
                    Reload
                  </span>
                </button>

                {/* Import Backup JSON */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={restoreLoading}
                  className="flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100 text-lira-text border border-lira-border rounded-xl transition-all cursor-pointer font-semibold text-xs shadow-2xs group"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <Upload className="w-4 h-4 text-lira-blue group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="text-sm font-bold">Import Backup File</div>
                      <div className="text-2xs text-lira-muted font-normal">Restore &amp; overwrite data</div>
                    </div>
                  </div>
                  <span className="text-3xs bg-lira-blue text-lira-on-blue px-2 py-0.5 rounded-full font-bold">
                    Browse
                  </span>
                </button>
              </div>

              {/* Hidden file input for import */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />

              {importStatus && (
                <div className={`p-3 rounded-lg text-xs font-medium border ${
                  !importStatus.startsWith('Error')
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                  {importStatus}
                </div>
              )}
            </div>
          )}
    </>
  );
}
