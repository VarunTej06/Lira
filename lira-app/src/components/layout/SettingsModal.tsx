import React, { useState, useEffect, useRef } from 'react';
import {
  Moon, Sun, HardDrive, Download, Upload, User, Bell,
  RefreshCw, CheckCircle2, Save, Monitor, Check
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { saveToDiskNow, initLocalDiskSync, subscribeToSyncStatus } from '../../services/localDiskSync';
import { exportBackup, importBackup } from '../../db/storageService';

export type SettingsSection = 'appearance' | 'backup' | 'profile' | 'general' | 'notifications';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: SettingsSection;
  onToast?: (message: string, type?: 'success' | 'error') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialSection = 'appearance',
  onToast,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);

  // Sync section and theme when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveSection(initialSection);
      const currentTheme = (localStorage.getItem('lira_theme') as 'light' | 'dark') ?? 'dark';
      setTheme(currentTheme);
    }
  }, [isOpen, initialSection]);

  // ── Appearance State ────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('lira_theme') as 'light' | 'dark') ?? 'dark';
  });

  const handleSelectTheme = (t: 'light' | 'dark') => {
    setTheme(t);
    localStorage.setItem('lira_theme', t);
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    onToast?.(`Theme switched to ${t === 'dark' ? 'Dark' : 'Light'} Mode`, 'success');
  };

  // ── Profile State ───────────────────────────────────────────────────────────
  const [profile] = useState<{ name: string; email: string; initials: string; role: string }>(() => {
    try {
      const raw = localStorage.getItem('lira_user_profile');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      name: localStorage.getItem('lira_user_name') || 'Varuntej Yadla',
      email: localStorage.getItem('lira_user_email') || 'yvaruntej0612@gmail.com',
      initials: localStorage.getItem('lira_user_initials') || 'VY',
      role: localStorage.getItem('lira_user_role') || 'MLOps & Platform Engineer',
    };
  });
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [initials, setInitials] = useState(profile.initials);
  const [role, setRole] = useState(profile.role);
  const [profileSaved, setProfileSaved] = useState(false);

  const [bottomToast, setBottomToast] = useState<string | null>(null);
  const showBottomToast = (msg: string = '✓ Saved') => {
    setBottomToast(msg);
    setTimeout(() => setBottomToast(null), 2000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    const cleanInitials = (initials.trim() || name.trim().slice(0, 2)).toUpperCase();
    const updated = {
      name: name.trim(),
      email: email.trim(),
      initials: cleanInitials,
      role: role.trim() || 'Software Engineer',
    };
    localStorage.setItem('lira_user_profile', JSON.stringify(updated));
    localStorage.setItem('lira_user_name', updated.name);
    localStorage.setItem('lira_user_email', updated.email);
    localStorage.setItem('lira_user_initials', updated.initials);
    localStorage.setItem('lira_user_role', updated.role);
    setProfileSaved(true);
    showBottomToast('✓ Saved');
    onToast?.('Profile updated successfully!', 'success');
    setTimeout(() => setProfileSaved(false), 2000);
  };

  // ── Backup & Restore State ──────────────────────────────────────────────────
  const [syncState, setSyncState] = useState<{ status: string; lastSaved: Date | null; filePath: string }>({
    status: 'synced',
    lastSaved: null,
    filePath: 'data/spaces/*.json',
  });
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return subscribeToSyncStatus(setSyncState);
  }, []);

  const handleBackupToDisk = async () => {
    setBackupLoading(true);
    try {
      const ok = await saveToDiskNow();
      if (ok) {
        showBottomToast('✓ Saved');
        onToast?.('Backup successfully saved to local PC disk (data/spaces/*.json)!', 'success');
        setImportStatus('✅ Workspace saved to local PC disk successfully.');
      } else {
        throw new Error('Save operation failed');
      }
    } catch {
      onToast?.('Failed to backup to disk. Please check console.', 'error');
      setImportStatus('❌ Error saving backup to disk.');
    } finally {
      setBackupLoading(false);
      setTimeout(() => setImportStatus(null), 4000);
    }
  };

  const handleExportBackupJson = async () => {
    try {
      await exportBackup();
      showBottomToast('✓ Saved');
      onToast?.('Unified JSON backup downloaded and synced to disk!', 'success');
    } catch (err) {
      onToast?.(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const handleRestoreFromDisk = async () => {
    if (!window.confirm('Restore workspace from local PC disk files? Any unsaved in-memory changes will be reloaded.')) {
      return;
    }
    setRestoreLoading(true);
    try {
      await initLocalDiskSync();
      showBottomToast('✓ Saved');
      onToast?.('Workspace successfully reloaded and restored from PC disk!', 'success');
      setImportStatus('✅ Workspace restored from local PC disk files.');
    } catch (err) {
      onToast?.(`Restore failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      setImportStatus('❌ Error restoring workspace from disk.');
    } finally {
      setRestoreLoading(false);
      setTimeout(() => setImportStatus(null), 4000);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreLoading(true);
    try {
      const result = await importBackup(file);
      showBottomToast('✓ Saved');
      onToast?.(`Restored ${result.spaces} spaces and ${result.issues} issues!`, 'success');
      setImportStatus(`✅ Successfully imported ${result.spaces} spaces and ${result.issues} issues.`);
    } catch (err) {
      onToast?.(`Import failed: ${err instanceof Error ? err.message : 'Invalid file'}`, 'error');
      setImportStatus(`❌ Import failed: ${err instanceof Error ? err.message : 'Invalid file'}`);
    } finally {
      setRestoreLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setImportStatus(null), 4000);
    }
  };

  // ── General Preferences State ───────────────────────────────────────────────
  const [language, setLanguage] = useState(() => {
    try {
      const raw = localStorage.getItem('lira_locale_prefs');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.language) return parsed.language;
      }
    } catch {}
    return localStorage.getItem('lira_pref_lang') || 'en-US';
  });
  const [timeZone, setTimeZone] = useState(() => {
    try {
      const raw = localStorage.getItem('lira_locale_prefs');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.timeZone) return parsed.timeZone;
      }
    } catch {}
    return localStorage.getItem('lira_pref_tz') || 'Asia/Kolkata';
  });
  const [generalSaved, setGeneralSaved] = useState(false);

  const handleSaveGeneral = () => {
    const localePrefs = { language, timeZone };
    localStorage.setItem('lira_locale_prefs', JSON.stringify(localePrefs));
    localStorage.setItem('lira_pref_lang', language);
    localStorage.setItem('lira_pref_tz', timeZone);
    setGeneralSaved(true);
    showBottomToast('✓ Saved');
    onToast?.('General settings saved!', 'success');
    setTimeout(() => setGeneralSaved(false), 2000);
  };

  // ── Notification Preferences State ──────────────────────────────────────────
  const [notificationPrefs, setNotificationPrefs] = useState<{
    inAppFeed: boolean;
    soundFeedback: boolean;
    mentionsOnly: boolean;
  }>(() => {
    try {
      const raw = localStorage.getItem('lira_notification_prefs');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      inAppFeed: true,
      soundFeedback: false,
      mentionsOnly: true,
    };
  });
  const [notifSaved, setNotifSaved] = useState(false);

  const handleSaveNotifications = () => {
    localStorage.setItem('lira_notification_prefs', JSON.stringify(notificationPrefs));
    localStorage.setItem('lira_notif_config', JSON.stringify(notificationPrefs));
    setNotifSaved(true);
    showBottomToast('✓ Saved');
    onToast?.('Notification preferences saved!', 'success');
    setTimeout(() => setNotifSaved(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lira Settings & Administration" size="lg">
      <div className="flex flex-col md:flex-row min-h-[480px] max-h-[80vh] overflow-hidden">
        {/* Left Sidebar Navigation */}
        <div className="w-full md:w-56 bg-gray-50 border-b md:border-b-0 md:border-r border-jira-border p-3 flex flex-row md:flex-col gap-1 overflow-x-auto flex-shrink-0">
          <div className="hidden md:block px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Workspace Settings
          </div>

          <button
            onClick={() => setActiveSection('appearance')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left whitespace-nowrap ${
              activeSection === 'appearance'
                ? 'bg-jira-blue text-white shadow-xs'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Sun className="w-4 h-4 flex-shrink-0" />
            <span>Appearance</span>
          </button>

          <button
            onClick={() => setActiveSection('backup')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left whitespace-nowrap ${
              activeSection === 'backup'
                ? 'bg-jira-blue text-white shadow-xs'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <HardDrive className="w-4 h-4 flex-shrink-0" />
            <span>Export &amp; Backup</span>
          </button>

          <button
            onClick={() => setActiveSection('profile')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left whitespace-nowrap ${
              activeSection === 'profile'
                ? 'bg-jira-blue text-white shadow-xs'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <User className="w-4 h-4 flex-shrink-0" />
            <span>Profile</span>
          </button>

          <div className="hidden md:block my-2 border-t border-jira-border" />
          <div className="hidden md:block px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            System
          </div>

          <button
            onClick={() => setActiveSection('general')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left whitespace-nowrap ${
              activeSection === 'general'
                ? 'bg-jira-blue text-white shadow-xs'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Monitor className="w-4 h-4 flex-shrink-0" />
            <span>General &amp; Locale</span>
          </button>

          <button
            onClick={() => setActiveSection('notifications')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left whitespace-nowrap ${
              activeSection === 'notifications'
                ? 'bg-jira-blue text-white shadow-xs'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Bell className="w-4 h-4 flex-shrink-0" />
            <span>Notifications</span>
          </button>
        </div>

        {/* Right Section Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* 1. Appearance Section */}
          {activeSection === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-jira-text">Appearance &amp; Theme</h3>
                <p className="text-xs text-jira-muted mt-1">
                  Customize the look and visual theme of your Lira workspace. Themes apply immediately and persist in your browser.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Dark Theme Option */}
                <div
                  onClick={() => handleSelectTheme('dark')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    theme === 'dark'
                      ? 'border-jira-blue bg-blue-50/20 shadow-md ring-2 ring-blue-500/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-gray-900 text-amber-300 rounded-lg">
                      <Moon className="w-5 h-5" />
                    </div>
                    {theme === 'dark' && (
                      <span className="p-1 rounded-full bg-jira-blue text-white">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-jira-text">Dark Mode (Default)</h4>
                  <p className="text-xs text-jira-muted mt-1">
                    Deep navy and charcoal tones with high-contrast elements. Comfortable for prolonged engineering sessions.
                  </p>
                  <div className="mt-3 h-8 bg-[#1D2125] rounded-md border border-gray-700 flex items-center px-2.5 gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="w-8 h-2 rounded bg-gray-700" />
                    <span className="w-12 h-2 rounded bg-gray-800" />
                  </div>
                </div>

                {/* Light Theme Option */}
                <div
                  onClick={() => handleSelectTheme('light')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    theme === 'light'
                      ? 'border-jira-blue bg-blue-50/20 shadow-md ring-2 ring-blue-500/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                      <Sun className="w-5 h-5" />
                    </div>
                    {theme === 'light' && (
                      <span className="p-1 rounded-full bg-jira-blue text-white">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-jira-text">Light Mode</h4>
                  <p className="text-xs text-jira-muted mt-1">
                    Clean, bright Atlassian Jira aesthetic with crisp contrast, white cards, and light blue accents.
                  </p>
                  <div className="mt-3 h-8 bg-gray-100 rounded-md border border-gray-200 flex items-center px-2.5 gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-jira-blue" />
                    <span className="w-8 h-2 rounded bg-gray-300" />
                    <span className="w-12 h-2 rounded bg-gray-200" />
                  </div>
                </div>
              </div>

              {/* Accent Color Section */}
              <div className="border-t border-jira-border pt-4">
                <h4 className="text-xs font-bold text-jira-muted uppercase tracking-wider mb-2">Accent Branding</h4>
                <div className="flex items-center gap-3">
                  {[
                    { color: '#0052CC', label: 'Classic Jira Blue' },
                    { color: '#6554C0', label: 'Royal Purple' },
                    { color: '#00B8D9', label: 'Teal Sky' },
                    { color: '#36B37E', label: 'Emerald' },
                  ].map(c => (
                    <button
                      key={c.color}
                      onClick={() => onToast?.(`Selected ${c.label}`, 'success')}
                      className="w-8 h-8 rounded-full border-2 border-white shadow-xs hover:scale-110 transition-transform cursor-pointer"
                      style={{ backgroundColor: c.color }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. Export & Backup Section */}
          {activeSection === 'backup' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-jira-text">Export, Backup &amp; Local Disk Sync</h3>
                <p className="text-xs text-jira-muted mt-1">
                  Connect directly to the local disk synchronization service to protect, export, or restore your workspace.
                </p>
              </div>

              {/* Local Disk Persistence Card */}
              <div className="p-4 bg-gray-50 rounded-xl border border-jira-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-bold text-jira-text">Local PC Storage Engine</span>
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                    syncState.status === 'saving'
                      ? 'bg-amber-100 text-amber-800'
                      : syncState.status === 'error'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {syncState.status === 'saving' ? 'Saving…' : syncState.status === 'error' ? 'Sync Error' : '● Connected & Synced'}
                  </span>
                </div>

                <div className="text-xs text-jira-muted space-y-1">
                  <p>
                    Storage Path: <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200 font-mono text-[11px] text-jira-text">{syncState.filePath}</code>
                  </p>
                  <p>
                    Dual-Sync Snapshot: <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200 font-mono text-[11px] text-jira-text">data/lira-workspace.json</code>
                  </p>
                  {syncState.lastSaved && (
                    <p className="text-[11px] text-gray-500">
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
                  className="flex items-center justify-between p-3.5 bg-blue-50 hover:bg-blue-100 text-jira-blue border border-blue-200 rounded-xl transition-all cursor-pointer font-semibold text-xs shadow-2xs group"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <Save className={`w-4 h-4 ${backupLoading ? 'animate-spin' : 'group-hover:scale-110 transition-transform'}`} />
                    <div>
                      <div className="text-sm font-bold">Backup Now</div>
                      <div className="text-[11px] text-blue-600 font-normal">Sync database to PC disk</div>
                    </div>
                  </div>
                  <span className="text-[10px] bg-jira-blue text-white px-2 py-0.5 rounded-full font-bold">
                    Disk Save
                  </span>
                </button>

                {/* Export Download JSON */}
                <button
                  type="button"
                  onClick={handleExportBackupJson}
                  className="flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100 text-jira-text border border-jira-border rounded-xl transition-all cursor-pointer font-semibold text-xs shadow-2xs group"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <Download className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="text-sm font-bold">Export Backup JSON</div>
                      <div className="text-[11px] text-jira-muted font-normal">Download single backup file</div>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">
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
                      <div className="text-[11px] text-amber-700 font-normal">Reload IndexedDB from disk</div>
                    </div>
                  </div>
                  <span className="text-[10px] bg-amber-600 text-white px-2 py-0.5 rounded-full font-bold">
                    Reload
                  </span>
                </button>

                {/* Import Backup JSON */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={restoreLoading}
                  className="flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100 text-jira-text border border-jira-border rounded-xl transition-all cursor-pointer font-semibold text-xs shadow-2xs group"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <Upload className="w-4 h-4 text-purple-600 group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="text-sm font-bold">Import Backup File</div>
                      <div className="text-[11px] text-jira-muted font-normal">Restore &amp; overwrite data</div>
                    </div>
                  </div>
                  <span className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded-full font-bold">
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
                  importStatus.startsWith('✅')
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                  {importStatus}
                </div>
              )}
            </div>
          )}

          {/* 3. Profile Section */}
          {activeSection === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-jira-text">Personal Profile</h3>
                <p className="text-xs text-jira-muted mt-1">
                  Manage your display name, contact email, initials, and role across your Lira workspace.
                </p>
              </div>

              {/* Avatar Preview */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-jira-border">
                <div className="w-14 h-14 rounded-full bg-[#00875A] text-white font-bold text-xl flex items-center justify-center shadow-xs">
                  {initials || 'VY'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-jira-text">{name}</h4>
                  <p className="text-xs text-jira-muted">{email}</p>
                  <span className="inline-block mt-1 text-[10px] font-semibold text-jira-blue bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                    {role}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-jira-muted uppercase mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-jira-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-jira-blue focus:border-jira-blue transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-jira-muted uppercase mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-jira-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-jira-blue focus:border-jira-blue transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-jira-muted uppercase mb-1">Initials (Avatar)</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={initials}
                    onChange={e => setInitials(e.target.value.toUpperCase())}
                    required
                    className="w-full px-3 py-2 text-sm border border-jira-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-jira-blue focus:border-jira-blue transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-jira-muted uppercase mb-1">Job Title / Role</label>
                  <input
                    type="text"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-jira-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-jira-blue focus:border-jira-blue transition-all"
                  />
                </div>
              </div>

              {profileSaved && (
                <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-lg border border-emerald-200 font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Profile saved successfully!
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-jira-border pt-4">
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold bg-jira-blue text-white rounded-lg hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {/* 4. General Settings */}
          {activeSection === 'general' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-jira-text">General Preferences</h3>
                <p className="text-xs text-jira-muted mt-1">
                  Manage display language, localized timezone, and workspace regional standards.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-jira-muted uppercase mb-1">Display Language</label>
                  <select
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-jira-border rounded-lg bg-white"
                  >
                    <option value="en-US">English (United States)</option>
                    <option value="en-GB">English (United Kingdom)</option>
                    <option value="es">Español</option>
                    <option value="de">Deutsch</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-jira-muted uppercase mb-1">Time Zone</label>
                  <select
                    value={timeZone}
                    onChange={e => setTimeZone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-jira-border rounded-lg bg-white"
                  >
                    <option value="Asia/Kolkata">(GMT+05:30) Chennai, Kolkata, Mumbai, New Delhi</option>
                    <option value="UTC">(GMT+00:00) Coordinated Universal Time</option>
                    <option value="America/New_York">(GMT-05:00) Eastern Time (US &amp; Canada)</option>
                    <option value="America/Los_Angeles">(GMT-08:00) Pacific Time (US &amp; Canada)</option>
                    <option value="Europe/London">(GMT+00:00) London, Edinburgh</option>
                  </select>
                </div>
              </div>

              {generalSaved && (
                <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-lg border border-emerald-200 font-medium">
                  ✓ General settings saved!
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-jira-border pt-4">
                <button
                  type="button"
                  onClick={handleSaveGeneral}
                  className="px-5 py-2 text-sm font-semibold bg-jira-blue text-white rounded-lg hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                >
                  Save General Settings
                </button>
              </div>
            </div>
          )}

          {/* 5. Notifications Settings */}
          {activeSection === 'notifications' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-jira-text">Notification Channels</h3>
                <p className="text-xs text-jira-muted mt-1">
                  Configure real-time audit notifications and alerts for ticket updates.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    key: 'inAppFeed' as const,
                    title: 'In-App Live Bell Feed',
                    desc: 'Display updates in the top navigation bell center',
                  },
                  {
                    key: 'soundFeedback' as const,
                    title: 'Sound Feedback',
                    desc: 'Play subtle audio on ticket transitions',
                  },
                  {
                    key: 'mentionsOnly' as const,
                    title: 'Mentions & Direct Assignments',
                    desc: 'Only highlight tickets when explicitly tagged or assigned',
                  },
                ].map(item => (
                  <div
                    key={item.key}
                    onClick={() => setNotificationPrefs(p => ({ ...p, [item.key]: !p[item.key] }))}
                    className="flex items-center justify-between p-3.5 bg-gray-50 hover:bg-blue-50/20 rounded-xl border border-jira-border cursor-pointer transition-colors"
                  >
                    <div>
                      <h4 className="text-sm font-semibold text-jira-text">{item.title}</h4>
                      <p className="text-xs text-jira-muted">{item.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationPrefs[item.key]}
                      onChange={() => {}}
                      className="w-4 h-4 text-jira-blue rounded border-gray-300 pointer-events-none"
                    />
                  </div>
                ))}
              </div>

              {notifSaved && (
                <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-lg border border-emerald-200 font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Notification preferences saved!
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-jira-border pt-4">
                <button
                  type="button"
                  onClick={handleSaveNotifications}
                  className="px-5 py-2 text-sm font-semibold bg-jira-blue text-white rounded-lg hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2-second green toast */}
      {bottomToast && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-xl animate-fade-in pointer-events-none">
          <Check className="w-4 h-4 text-white" />
          <span>{bottomToast}</span>
        </div>
      )}
    </Modal>
  );
};
