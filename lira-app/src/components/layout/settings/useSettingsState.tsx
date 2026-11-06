import React, { useState, useEffect, useRef } from 'react';
import { loadAccent, saveAccent } from '../../../utils/accent';
import { saveToDiskNow, initLocalDiskSync, subscribeToSyncStatus } from '../../../services/localDiskSync';
import { exportBackup, importBackup } from '../../../db/storageService';

export type SettingsSection = 'appearance' | 'backup' | 'profile' | 'general' | 'notifications';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: SettingsSection;
  onToast?: (message: string, type?: 'success' | 'error') => void;
}

/** All the state of the settings dialog: theme, profile, language, notifications, backup and disk sync. */
export function useSettingsState(props: SettingsModalProps) {
  const {
    isOpen,
    onClose,
    initialSection = 'appearance',
    onToast,
  } = props;
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const [accent, setAccent] = useState<string>(loadAccent);
  const chooseAccent = (hex: string, name?: string) => {
    saveAccent(hex);
    setAccent(hex.toUpperCase());
    if (name) onToast?.(`Accent colour: ${name}`, 'success');
  };

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

  return {
    isOpen,
    onClose,
    initialSection,
    onToast,
    activeSection,
    setActiveSection,
    accent,
    setAccent,
    chooseAccent,
    theme,
    setTheme,
    handleSelectTheme,
    name,
    setName,
    email,
    setEmail,
    initials,
    setInitials,
    role,
    setRole,
    profileSaved,
    setProfileSaved,
    bottomToast,
    setBottomToast,
    showBottomToast,
    handleSaveProfile,
    syncState,
    setSyncState,
    backupLoading,
    setBackupLoading,
    restoreLoading,
    setRestoreLoading,
    importStatus,
    setImportStatus,
    fileInputRef,
    handleBackupToDisk,
    handleExportBackupJson,
    handleRestoreFromDisk,
    handleImportFile,
    language,
    setLanguage,
    timeZone,
    setTimeZone,
    generalSaved,
    setGeneralSaved,
    handleSaveGeneral,
    notificationPrefs,
    setNotificationPrefs,
    notifSaved,
    setNotifSaved,
    handleSaveNotifications,
  };
}

export type SettingsState = ReturnType<typeof useSettingsState>;
