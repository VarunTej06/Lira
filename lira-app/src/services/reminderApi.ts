import { send } from './authApi';

/** The signed-in person's own reminder switches. `available` is false when the server has no email service, so the page can say so. */
export interface ReminderPrefs { calls: boolean; due: boolean; available: boolean }

export const getReminders = () => send<ReminderPrefs>('GET', '/api/me/reminders');
export const setReminders = (changes: Partial<Pick<ReminderPrefs, 'calls' | 'due'>>) => send<ReminderPrefs>('PUT', '/api/me/reminders', changes);
