import { beforeEach, describe, expect, it } from 'vitest';
import { currentUser, isMine } from './currentUser';
import { saveProfile } from './userPrefs';

describe('The person using Lira', () => {
  beforeEach(() => localStorage.clear());

  it('comes from the profile', () => {
    saveProfile({ name: 'Sam Lee', email: 's@x.io', initials: 'SL', role: 'Dev' });
    expect(currentUser()).toMatchObject({ name: 'Sam Lee', initials: 'SL' });
  });

  it('knows which tickets are mine: by initials, by name, or by the earlier spelling', () => {
    saveProfile({ name: 'Sam Lee', email: 's@x.io', initials: 'SL', role: 'Dev' });
    expect(isMine({ assigneeInitials: 'SL' })).toBe(true);
    expect(isMine({ assignee: 'Sam Lee' })).toBe(true);
    expect(isMine({ assignee: 'SL' })).toBe(true);
    expect(isMine({ assignee: 'Varun Tej' })).toBe(true);
    expect(isMine({ assignee: 'Priya Rao', assigneeInitials: 'PR' })).toBe(false);
    expect(isMine({})).toBe(false);
  });

  it('with no profile saved, the default person owns the tickets assigned to VY', () => {
    expect(isMine({ assigneeInitials: 'VY' })).toBe(true);
  });

  it('follows a changed profile: tickets of the old initials stop being mine', () => {
    saveProfile({ name: 'Sam Lee', email: 's@x.io', initials: 'SL', role: 'Dev' });
    expect(isMine({ assigneeInitials: 'VY' })).toBe(false);
  });
});
