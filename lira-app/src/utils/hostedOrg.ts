/**
 * Hosted edition: the organisation whose workspace the app is showing, taken from the server when the session is checked.
 * It is kept in memory only, so it is never stale after a sign-out and never a second copy of what the server says.
 */
let active: string | null = null;

export const setActiveOrg = (orgId: string | null): void => { active = orgId; };
export const activeOrg = (): string | null => active;
