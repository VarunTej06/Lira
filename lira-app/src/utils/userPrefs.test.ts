import { beforeEach, describe, expect, it } from 'vitest';
import { cleanProfile, loadLocale, loadNotificationPrefs, loadProfile, saveLocale, saveNotificationPrefs, saveProfile } from './userPrefs';

describe('Personal settings', () => {
  beforeEach(() => localStorage.clear());

  it('starts with the defaults and reads the older separate keys', () => {
    expect(loadProfile().initials).toBe('VY');
    localStorage.setItem('lira_user_name', 'Sam Lee');
    expect(loadProfile().name).toBe('Sam Lee');
    expect(loadLocale()).toEqual({ language: 'en-US', timeZone: 'Asia/Kolkata' });
    expect(loadNotificationPrefs()).toEqual({ inAppFeed: true, soundFeedback: false, mentionsOnly: true });
  });

  it('saves the profile in the new key and the older ones, and reads it back', () => {
    saveProfile({ name: 'Sam Lee', email: 's@x.io', initials: 'SL', role: 'Dev' });
    expect(loadProfile()).toEqual({ name: 'Sam Lee', email: 's@x.io', initials: 'SL', role: 'Dev' });
    expect(localStorage.getItem('lira_user_email')).toBe('s@x.io');
  });

  it('cleans typed values: trims, capitalises initials, fills blanks', () => {
    expect(cleanProfile({ name: ' sam lee ', email: ' a@b.c ', initials: '', role: ' ' })).toEqual({ name: 'sam lee', email: 'a@b.c', initials: 'SA', role: 'Software Engineer' });
  });

  it('saves language, time zone and notifications', () => {
    saveLocale({ language: 'de-DE', timeZone: 'Europe/Berlin' });
    expect(loadLocale()).toEqual({ language: 'de-DE', timeZone: 'Europe/Berlin' });
    saveNotificationPrefs({ inAppFeed: false, soundFeedback: true, mentionsOnly: false });
    expect(loadNotificationPrefs().soundFeedback).toBe(true);
    expect(localStorage.getItem('lira_notif_config')).toContain('soundFeedback');
  });

  it('ignores a broken saved value', () => {
    localStorage.setItem('lira_user_profile', '{nope');
    expect(loadProfile().initials).toBe('VY');
  });
});
