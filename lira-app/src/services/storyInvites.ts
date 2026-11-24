import { setGrant, type Level } from './accessApi';

export interface Invitees { teams: string[]; users: string[] }
type Grant = typeof setGrant;

const LEVEL: Level = 'view'; // seeing a story box is all that is needed to give points in it
const TRIES = 8;
const WAIT_MS = 1000;

/**
 * Gives the chosen teams and people a place in a story box. The box is saved to the server a moment after it is made, and a grant needs
 * the box to be there, so a "not found" is tried again for a few seconds. Returns how many could not be given, with the server's reason.
 */
export async function inviteToBox(
  orgId: string, boxId: string, who: Invitees,
  deps: { grant?: Grant; wait?: (ms: number) => Promise<void> } = {},
): Promise<{ failed: number; reason: string }> {
  const grant = deps.grant ?? setGrant;
  const wait = deps.wait ?? ((ms: number) => new Promise<void>(r => { window.setTimeout(r, ms); }));
  const subjects = [...who.teams.map(id => ({ subjectType: 'team' as const, subjectId: id })), ...who.users.map(id => ({ subjectType: 'user' as const, subjectId: id }))];
  let failed = 0; let reason = '';
  for (const s of subjects) {
    let done = false;
    for (let attempt = 0; attempt < TRIES && !done; attempt++) {
      const r = await grant(orgId, { ...s, kind: 'storybox', objectId: boxId, level: LEVEL });
      if (r.ok) { done = true; break; }
      reason = r.message;
      if (r.status !== 404) break; // only a box that has not arrived yet is worth waiting for
      await wait(WAIT_MS);
    }
    if (!done) failed += 1;
  }
  return { failed, reason };
}
