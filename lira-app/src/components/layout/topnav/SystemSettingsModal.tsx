import React, { useState } from 'react';
import { Download, Upload, HardDrive, Moon, Sun } from 'lucide-react';
import { Modal } from '../../common/Modal';
import { applyTheme, getLightPalette, getTheme, isThemeChange, type LightPalette, type Theme } from '../../../utils/theme';
import { THEMES } from '../../../theme/palette';
import { useResetWhen } from '../../../hooks/useResetWhen';

export const SystemSettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  importing: boolean;
  importStatus: string | null;
  onExport: () => void;
  onImportClick: () => void;
}> = ({ isOpen, onClose, importing, importStatus, onExport, onImportClick }) => {
  // The choice is a draft until Apply; closing the dialog drops it
  const [theme, setTheme] = useState<Theme>(getTheme);
  const [palette, setPalette] = useState<LightPalette>(getLightPalette);
  useResetWhen([isOpen], () => { if (isOpen) { setTheme(getTheme()); setPalette(getLightPalette()); } });
  const changed = isThemeChange(theme, palette);
  const handleApply = () => { applyTheme(theme, palette); };
  const pill = (on: boolean) => `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 ${on ? 'bg-lira-blue text-lira-on-blue' : 'bg-gray-200 text-gray-800'}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="System & Data Management" size="md">
      <div className="p-6 space-y-6 text-lira-text">
        {/* PC Disk info */}
        <div>
          <h3 className="text-sm font-bold text-lira-text flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-600" />
            Local PC Disk Persistence
          </h3>
          <p className="text-xs text-lira-muted mt-1 leading-relaxed">
            All data is partitioned into individual space files (<code className="bg-gray-100 px-1 py-0.5 rounded font-mono">data/spaces/*.json</code>) and simultaneously consolidated at <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">data/lira-workspace.json</code>.
          </p>
        </div>

        {/* Backup actions */}
        <div className="space-y-3">
          <button
            onClick={onExport}
            className="w-full flex items-center justify-between px-4 py-3 bg-lira-blue-light text-lira-blue rounded-xl hover:brightness-95 transition-colors text-sm font-semibold cursor-pointer border border-lira-border"
          >
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export Unified JSON Backup
            </span>
            <span className="text-2xs bg-lira-blue text-lira-on-blue px-2 py-0.5 rounded-full font-medium">
              Download + Disk Sync
            </span>
          </button>

          <button
            onClick={onImportClick}
            disabled={importing}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-lira-text rounded-xl hover:bg-gray-100 transition-colors text-sm font-semibold border border-lira-border disabled:opacity-50 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-gray-600" />
              {importing ? 'Importing dataset...' : 'Import JSON Backup'}
            </span>
            <span className="text-2xs text-lira-muted">Restore &amp; Overwrite</span>
          </button>
        </div>

        {importStatus && (
          <div className={`text-xs p-3 rounded-lg ${!importStatus.startsWith('Error') ? 'bg-green-50 text-green-700 font-medium' : 'bg-red-50 text-red-700'}`}>
            {importStatus}
          </div>
        )}

        {/* Theme Settings */}
        <div className="border-t border-lira-border pt-4 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-lira-text">Appearance Theme</h4>
            <p className="text-xs text-lira-muted">Toggle between dark and light workspace interface</p>
          </div>
          <div className="flex items-center gap-2">
            {(['dark', 'light'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setTheme(opt)}
                aria-pressed={theme === opt}
                className={pill(theme === opt)}
              >
                {opt === 'dark' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                {opt === 'dark' ? 'Dark' : 'Light'}
              </button>
            ))}
            <button
              onClick={handleApply}
              disabled={!changed}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Save
            </button>
          </div>
        </div>

        {theme === 'light' && (
          <div className="flex items-center justify-between" role="group" aria-label="Light palette">
            <p className="text-xs text-lira-muted">Which light palette?</p>
            <div className="flex items-center gap-2">
              {(['sorrel', 'fawn'] as const).map(p => (
                <button key={p} onClick={() => setPalette(p)} aria-pressed={palette === p} title={THEMES[p].note} className={pill(palette === p)}>
                  {THEMES[p].label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
