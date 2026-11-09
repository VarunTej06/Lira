import { appStorage } from './appStorage';
/** The person's own settings (profile, language and time zone, notifications), kept in the browser and mirrored to data/settings.json. */

interface Profile { name: string; email: string; initials: string; role: string }
interface LocalePrefs { language: string; timeZone: string }
interface NotificationPrefs { inAppFeed: boolean; soundFeedback: boolean; mentionsOnly: boolean }

const read = <T,>(key: string): T | undefined => {
  try { const raw = appStorage.get(key); return raw ? (JSON.parse(raw) as T) : undefined; } catch { return undefined; }
};

export function loadProfile(): Profile {
  return read<Profile>('lira_user_profile') ?? {
    name: appStorage.get('lira_user_name') || 'Varuntej Yadla',
    email: appStorage.get('lira_user_email') || 'yvaruntej0612@gmail.com',
    initials: appStorage.get('lira_user_initials') || 'VY',
    role: appStorage.get('lira_user_role') || 'MLOps & Platform Engineer',
  };
}

/** Cleans what was typed (initials default to the first two letters of the name; role to Software Engineer). */
export function cleanProfile(p: Profile): Profile {
  return { name: p.name.trim(), email: p.email.trim(), initials: (p.initials.trim() || p.name.trim().slice(0, 2)).toUpperCase(), role: p.role.trim() || 'Software Engineer' };
}

export function saveProfile(p: Profile) {
  appStorage.set('lira_user_profile', JSON.stringify(p));
  appStorage.set('lira_user_name', p.name);
  appStorage.set('lira_user_email', p.email);
  appStorage.set('lira_user_initials', p.initials);
  appStorage.set('lira_user_role', p.role);
}

export function loadLocale(): LocalePrefs {
  const saved = read<Partial<LocalePrefs>>('lira_locale_prefs');
  return {
    language: saved?.language || appStorage.get('lira_pref_lang') || 'en-US',
    timeZone: saved?.timeZone || appStorage.get('lira_pref_tz') || 'Asia/Kolkata',
  };
}

export function saveLocale(p: LocalePrefs) {
  appStorage.set('lira_locale_prefs', JSON.stringify(p));
  appStorage.set('lira_pref_lang', p.language);
  appStorage.set('lira_pref_tz', p.timeZone);
}

export const loadNotificationPrefs = (): NotificationPrefs => read<NotificationPrefs>('lira_notification_prefs') ?? { inAppFeed: true, soundFeedback: false, mentionsOnly: true };

export function saveNotificationPrefs(p: NotificationPrefs) {
  appStorage.set('lira_notification_prefs', JSON.stringify(p));
  appStorage.set('lira_notif_config', JSON.stringify(p));
}
