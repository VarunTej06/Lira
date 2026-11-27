/**
 * Hosted edition: the organisation whose workspace the app is showing, taken from the server when the session is checked.
 * It is kept in memory only, so it is never stale after a sign-out and never a second copy of what the server says.
 */
export interface OrgChoice { orgId: string; orgName: string; role: string; hideSprints?: boolean }

/** The browser setting that remembers which workspace the person switched to, until they log out. */
export const WORKSPACE_KEY = 'lira_workspace';

let active: string | null = null;
let role: string | null = null;
let noSprints = false;
let known: OrgChoice[] = [];

export const setActiveOrg = (orgId: string | null, roleInOrg: string | null = null, hideSprints = false): void => { active = orgId; role = roleInOrg; noSprints = hideSprints; };
export const activeOrg = (): string | null => active;
/** True for someone who is in this organisation by invitation to its spaces: neither its Owner nor an Admin, who have everything. */
export const isInvitedMember = (): boolean => role !== null && role !== 'owner' && role !== 'admin';
/** True when the owner switched sprints off for this person: the sprint pages and the sidebar's Sprints section are not shown. */
export const sprintsHidden = (): boolean => noSprints;

export const setOrganisations = (list: OrgChoice[]): void => { known = list; };
export const organisations = (): readonly OrgChoice[] => known;

/** The workspace to open: the one the person switched to, when they are still in it, otherwise the first the server lists (their own). */
export const chooseOrg = (list: readonly OrgChoice[], preferred: string | null): OrgChoice | undefined =>
  list.find(o => o.orgId === preferred) ?? list[0];

/** How a workspace is named in the account menu: their own, or the one they were invited to. */
export const workspaceLabel = (o: OrgChoice): string => (o.role === 'owner' ? 'My workspace' : `${o.orgName} (invited)`);
