export interface SettingsItem { id: string; label: string; path: string; /** Only for people who may manage access: the server decides, the rail only follows its answer. */ identity: boolean }
export interface SettingsGroup { title: string; items: SettingsItem[] }

const item = (id: string, label: string, identity = false): SettingsItem => ({ id, label, path: `/settings/${id}`, identity });

/** The Settings pages by group, in the order the left rail shows them. */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  { title: 'Identity and management', items: [item('users', 'Users', true), item('teams', 'Teams', true), item('access', 'Access', true)] },
  { title: 'Account', items: [item('account', 'Account settings'), item('security', 'Security')] },
  { title: 'Workspace', items: [item('calls', 'Calls'), item('notifications', 'Notifications'), item('import', 'Import', true)] },
];

/** The groups a person may see: without the right to manage access, the pages that manage it are left out, and so are empty groups. */
export const visibleGroups = (canManageAccess: boolean): SettingsGroup[] =>
  SETTINGS_GROUPS.map(g => ({ ...g, items: g.items.filter(i => canManageAccess || !i.identity) })).filter(g => g.items.length > 0);

/** Where "/settings" itself goes: the first page everyone may open. */
export const DEFAULT_SETTINGS_PATH = '/settings/account';
