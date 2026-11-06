import React, { useState } from 'react';
import { Download, Upload, HardDrive } from 'lucide-react';
import { Modal } from '../../common/Modal';

export const SystemSettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  importing: boolean;
  importStatus: string | null;
  onExport: () => void;
  onImportClick: () => void;
}> = ({ isOpen, onClose, importing, importStatus, onExport, onImportClick }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('lira_theme') as 'light' | 'dark') ?? 'dark';
  });

  const handleThemeToggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('lira_theme', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="System & Data Management" size="md">
      <div className="p-6 space-y-6 text-jira-text">
        {/* PC Disk info */}
        <div>
          <h3 className="text-sm font-bold text-jira-text flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-600" />
            Local PC Disk Persistence
          </h3>
          <p className="text-xs text-jira-muted mt-1 leading-relaxed">
            All data is partitioned into individual space files (<code className="bg-gray-100 px-1 py-0.5 rounded font-mono">data/spaces/*.json</code>) and simultaneously consolidated at <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">data/lira-workspace.json</code>.
          </p>
        </div>

        {/* Backup actions */}
        <div className="space-y-3">
          <button
            onClick={onExport}
            className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 text-jira-blue rounded-xl hover:bg-blue-100 transition-colors text-sm font-semibold cursor-pointer border border-blue-200"
          >
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export Unified JSON Backup
            </span>
            <span className="text-[11px] bg-jira-blue text-white px-2 py-0.5 rounded-full font-medium">
              Download + Disk Sync
            </span>
          </button>

          <button
            onClick={onImportClick}
            disabled={importing}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-jira-text rounded-xl hover:bg-gray-100 transition-colors text-sm font-semibold border border-jira-border disabled:opacity-50 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-gray-600" />
              {importing ? 'Importing dataset...' : 'Import JSON Backup'}
            </span>
            <span className="text-[11px] text-jira-muted">Restore &amp; Overwrite</span>
          </button>
        </div>

        {importStatus && (
          <div className={`text-xs p-3 rounded-lg ${importStatus.startsWith('✅') ? 'bg-green-50 text-green-700 font-medium' : 'bg-red-50 text-red-700'}`}>
            {importStatus}
          </div>
        )}

        {/* Theme Settings */}
        <div className="border-t border-jira-border pt-4 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-jira-text">Appearance Theme</h4>
            <p className="text-xs text-jira-muted">Toggle between dark and light workspace interface</p>
          </div>
          <button
            onClick={handleThemeToggle}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-800'
            }`}
          >
            {theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
