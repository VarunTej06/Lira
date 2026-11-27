import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS_PATH, SETTINGS_GROUPS, visibleGroups } from './settingsNav';

const paths = (can: boolean) => visibleGroups(can).flatMap(g => g.items.map(i => i.path));

describe('the Settings rail', () => {
  it('shows every page to a person who may manage access', () => {
    expect(paths(true)).toEqual(['/settings/users', '/settings/teams', '/settings/access', '/settings/account', '/settings/security', '/settings/calls', '/settings/notifications', '/settings/import']);
  });
  it('leaves out the pages that manage people and access, and the group left empty, for everyone else', () => {
    expect(paths(false)).toEqual(['/settings/account', '/settings/security', '/settings/calls', '/settings/notifications']);
    expect(visibleGroups(false).map(g => g.title)).toEqual(['Account', 'Workspace']);
  });
  it('has unique paths, and the default page is one everyone may open', () => {
    const all = SETTINGS_GROUPS.flatMap(g => g.items.map(i => i.path));
    expect(new Set(all).size).toBe(all.length);
    expect(paths(false)).toContain(DEFAULT_SETTINGS_PATH);
  });
});
