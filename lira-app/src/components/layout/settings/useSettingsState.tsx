import { notifySaved } from '../../common/SavedToast';
import {  } from '../../common/dialogs';
import React, { useState, useEffect, useRef } from 'react';
import { loadAccent, saveAccent } from '../../../utils/accent';
import { applyTheme, getTheme } from '../../../utils/theme';
import { useBackupState } from './useBackupState';
import { cleanProfile, loadLocale, loadNotificationPrefs, loadProfile, saveLocale, saveNotificationPrefs, saveProfile } from '../../../utils/userPrefs';

export type SettingsSection = 'appearance' | 'backup' | 'profile' | 'general' | 'notifications' | 'devices';

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
  // The accent is a draft until Save is pressed (see handleSaveAppearance)
  const chooseAccent = (hex: string) => {
    setAccent(hex.toUpperCase());
  };

  // Sync section and theme when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveSection(initialSection);
      setTheme(getTheme()); // an unsaved choice from last time is dropped
      setAccent(loadAccent());
    }
  }, [isOpen, initialSection]);

  // ── Appearance State ────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<'light' | 'dark'>(getTheme);

  // Choosing only changes the draft; nothing is applied until Save
  const handleSelectTheme = (t: 'light' | 'dark') => setTheme(t);

  const appearanceChanged = theme !== getTheme() || accent.toUpperCase() !== loadAccent().toUpperCase();

  const handleSaveAppearance = () => {
    if (!appearanceChanged) { onClose(); return; }
    applyTheme(theme);
    saveAccent(accent);
    notifySaved('Appearance saved');
    onClose();
  };

  // ── Profile State ───────────────────────────────────────────────────────────
  const [profile] = useState(loadProfile);
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
    const updated = cleanProfile({ name, email, initials, role });
    if (JSON.stringify(updated) === JSON.stringify(profile)) { onClose(); return; }
    saveProfile(updated);
    notifySaved('Profile saved');
    onClose(); // saving closes the dialog
  };

  const backup = useBackupState(onToast, showBottomToast);

  // ── General Preferences State ───────────────────────────────────────────────
  const [language, setLanguage] = useState(() => loadLocale().language);
  const [timeZone, setTimeZone] = useState(() => loadLocale().timeZone);
  const [generalSaved, setGeneralSaved] = useState(false);
  const initialLocale = useRef({ language, timeZone });

  const handleSaveGeneral = () => {
    if (language === initialLocale.current.language && timeZone === initialLocale.current.timeZone) { onClose(); return; }
    saveLocale({ language, timeZone });
    notifySaved('General settings saved');
    onClose(); // saving closes the dialog
  };

  // ── Notification Preferences State ──────────────────────────────────────────
  const [notificationPrefs, setNotificationPrefs] = useState(loadNotificationPrefs);
  const [notifSaved, setNotifSaved] = useState(false);
  const initialNotif = useRef(JSON.stringify(notificationPrefs));

  const handleSaveNotifications = () => {
    if (JSON.stringify(notificationPrefs) === initialNotif.current) { onClose(); return; }
    saveNotificationPrefs(notificationPrefs);
    notifySaved('Notification preferences saved');
    onClose(); // saving closes the dialog
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
    appearanceChanged,
    handleSaveAppearance,
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
    ...backup,
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
