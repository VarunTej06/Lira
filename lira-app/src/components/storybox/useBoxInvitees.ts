import { useEffect, useState } from 'react';
import { listMembers, listTeams, type Member, type Team } from '../../services/accessApi';
import { isHosted } from '../../utils/edition';
import { activeOrg } from '../../utils/hostedOrg';

export interface Invitable { teams: Team[]; people: Member[] }

/**
 * The teams and people that can be invited into a new story box (hosted edition, while the form is open). Owners and Admins are left out:
 * they take part in every box anyway. Null in the local edition, which has one person, and until the lists arrive.
 */
export function useBoxInvitees(open: boolean): Invitable | null {
  const org = activeOrg();
  const [found, setFound] = useState<Invitable | null>(null);
  useEffect(() => {
    if (!open || !isHosted() || !org) return;
    let current = true;
    void Promise.all([listTeams(org), listMembers(org)]).then(([teams, members]) => {
      if (!current) return;
      setFound({ teams: teams.ok ? teams.data : [], people: members.ok ? members.data.filter(m => m.role !== 'owner' && m.role !== 'admin') : [] });
    });
    return () => { current = false; };
  }, [open, org]);
  return isHosted() && org ? found : null;
}
