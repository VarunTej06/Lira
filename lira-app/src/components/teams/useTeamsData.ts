import { useEffect, useState } from 'react';
import { listInvitations, listMembers, listTeams, myAccess, type Invitation, type Member, type Team } from '../../services/accessApi';
import { activeOrg } from '../../utils/hostedOrg';

export type TeamsData =
  | { state: 'loading' }
  | { state: 'denied' }
  | { state: 'error'; message: string }
  | { state: 'ready'; role: string; members: Member[]; teams: Team[]; invitations: Invitation[] };

/**
 * The people, teams and invitations of the organisation, for the Teams page. A person who may not manage access gets "denied"
 * (the server decides; the page only reads its answer). `reload` asks again after any change.
 */
export function useTeamsData(): [TeamsData, () => void] {
  const org = activeOrg();
  const [data, setData] = useState<TeamsData>({ state: 'loading' });
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (!org) return;
    let current = true;
    void (async () => {
      const access = await myAccess(org);
      if (!current) return;
      if (!access.ok) { setData({ state: 'error', message: access.message }); return; }
      if (!access.data.canManageAccess) { setData({ state: 'denied' }); return; }
      const [members, teams, invitations] = await Promise.all([listMembers(org), listTeams(org), listInvitations(org)]);
      if (!current) return;
      const failed = [members, teams, invitations].find(r => !r.ok);
      if (failed && !failed.ok) { setData({ state: 'error', message: failed.message }); return; }
      if (members.ok && teams.ok && invitations.ok) setData({ state: 'ready', role: access.data.role, members: members.data, teams: teams.data, invitations: invitations.data });
    })();
    return () => { current = false; };
  }, [org, reloads]);

  return [org ? data : { state: 'error', message: 'You are not signed in to an organisation.' }, () => setReloads(n => n + 1)];
}
