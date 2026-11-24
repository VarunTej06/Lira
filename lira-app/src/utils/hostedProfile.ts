import type { Me } from '../services/authApi';
import { appStorage } from './appStorage';
import { WORKSPACE_KEY, chooseOrg, setActiveOrg, setOrganisations } from './hostedOrg';
import { cleanProfile, saveProfile } from './userPrefs';

/** Up to two capital letters from a name: "Asha Rao" gives "AR", "Asha" gives "A". */
export const initialsOf = (name: string): string =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();

/**
 * Hosted edition: the profile shown in the app (account menu, assignee, mentions) is the signed-in person's own, from the
 * server, never the local default. It is written to the same places the local profile uses, every time the session is checked.
 */
export function applyServerProfile(me: Me): void {
  const current = chooseOrg(me.organisations, appStorage.get(WORKSPACE_KEY));
  const role = current?.role ?? 'member';
  setOrganisations(me.organisations);
  setActiveOrg(current?.orgId ?? null, current?.role ?? null, current?.hideSprints === true);
  saveProfile(cleanProfile({
    name: me.user.name,
    email: me.user.email,
    initials: initialsOf(me.user.name),
    role: role.charAt(0).toUpperCase() + role.slice(1),
  }));
}
