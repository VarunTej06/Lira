import { useEffect, useRef, useState } from 'react';
import { confirmDialog } from '../../common/dialogs';
import { saveToDiskNow, initLocalDiskSync, subscribeToSyncStatus } from '../../../services/localDiskSync';
import { exportBackup, importBackup } from '../../../db/storageService';

type Toast = (message: string, type?: 'success' | 'error') => void;
const reason = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/** Backup and restore: save to the disk folder, download a backup file, reload from disk, and import a backup file. */
export function useBackupState(onToast: Toast | undefined, showBottomToast: (msg?: string) => void) {
  const [syncState, setSyncState] = useState<{ status: string; lastSaved: Date | null; filePath: string }>({ status: 'synced', lastSaved: null, filePath: 'data/spaces/*.json' });
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => subscribeToSyncStatus(setSyncState), []);

  /** Runs one of the actions with its loading flag, and clears the status line after a few seconds. */
  const run = async (setLoading: (v: boolean) => void, action: () => Promise<void>) => {
    setLoading(true);
    try { await action(); } finally { setLoading(false); setTimeout(() => setImportStatus(null), 4000); }
  };

  const handleBackupToDisk = () => run(setBackupLoading, async () => {
    try {
      if (!(await saveToDiskNow())) throw new Error('Save operation failed');
      showBottomToast('✓ Saved');
      onToast?.('Backup successfully saved to local PC disk (data/spaces/*.json)!', 'success');
      setImportStatus('Workspace saved to local PC disk successfully.');
    } catch {
      onToast?.('Failed to backup to disk. Please check console.', 'error');
      setImportStatus('Error: could not save the backup to disk.');
    }
  });

  const handleExportBackupJson = async () => {
    try {
      await exportBackup();
      showBottomToast('✓ Saved');
      onToast?.('Unified JSON backup downloaded and synced to disk!', 'success');
    } catch (err) {
      onToast?.(`Export failed: ${reason(err, 'Unknown error')}`, 'error');
    }
  };

  const handleRestoreFromDisk = async () => {
    if (!(await confirmDialog({ title: 'Restore from disk', message: 'Restore the workspace from the local PC disk files? Any unsaved in-memory changes will be reloaded.', confirmLabel: 'Restore' }))) return;
    await run(setRestoreLoading, async () => {
      try {
        await initLocalDiskSync();
        onToast?.('Workspace successfully reloaded and restored from PC disk!', 'success');
        setImportStatus('Workspace restored from local PC disk files.');
      } catch (err) {
        onToast?.(`Restore failed: ${reason(err, 'Unknown error')}`, 'error');
        setImportStatus('Error: could not restore the workspace from disk.');
      }
    });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await run(setRestoreLoading, async () => {
      try {
        const result = await importBackup(file);
        showBottomToast('✓ Saved');
        onToast?.(`Restored ${result.spaces} spaces and ${result.issues} issues!`, 'success');
        setImportStatus(`Successfully imported ${result.spaces} spaces and ${result.issues} issues.`);
      } catch (err) {
        onToast?.(`Import failed: ${reason(err, 'Invalid file')}`, 'error');
        setImportStatus(`Error: import failed: ${reason(err, 'Invalid file')}`);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    });
  };

  return { syncState, setSyncState, backupLoading, setBackupLoading, restoreLoading, setRestoreLoading, importStatus, setImportStatus, fileInputRef, handleBackupToDisk, handleExportBackupJson, handleRestoreFromDisk, handleImportFile };
}
