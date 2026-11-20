import { beforeEach, describe, expect, it } from 'vitest';
import { appStorage } from './appStorage';
import { applyServerProfile, initialsOf } from './hostedProfile';
import { loadProfile } from './userPrefs';

const me = (name: string, role = 'owner') => ({ user: { id: '1', email: 'test@gmail.com', name }, organisations: [{ orgId: 'o', orgName: 'x', role }] });

beforeEach(() => { appStorage.remove('lira_user_profile'); appStorage.remove('lira_user_name'); appStorage.remove('lira_user_email'); appStorage.remove('lira_user_initials'); });

describe('initialsOf', () => {
  it('takes the first letters of up to two words, in capitals', () => {
    expect(initialsOf('Asha Rao')).toBe('AR');
    expect(initialsOf('asha')).toBe('A');
    expect(initialsOf('  Yadla Sai Varun Teja ')).toBe('YS');
    expect(initialsOf('')).toBe('');
  });
});

describe('applyServerProfile', () => {
  it('replaces the local default with the signed-in person, so the owner\'s own details are never shown to someone else', () => {
    applyServerProfile(me('Test User'));
    expect(loadProfile()).toEqual({ name: 'Test User', email: 'test@gmail.com', initials: 'TU', role: 'Owner' });
    expect(appStorage.get('lira_user_email')).toBe('test@gmail.com');
  });

  it('overwrites an earlier person\'s profile in the same browser', () => {
    applyServerProfile(me('First Person'));
    applyServerProfile({ user: { id: '2', email: 'second@example.com', name: 'Second' }, organisations: [] });
    expect(loadProfile()).toMatchObject({ name: 'Second', email: 'second@example.com', initials: 'S', role: 'Member' });
  });
});
