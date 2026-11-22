import { useEffect, useState } from 'react';
import { myAccess } from '../../services/accessApi';
import { activeOrg } from '../../utils/hostedOrg';

/** The role of the person using the app in their organisation, asked once and kept for the next buttons that need it. */
const asked = new Map<string, Promise<string | null>>();

export function forgetCallAccess(): void { asked.clear(); }

/**
 * Whether the person is an Owner or Admin, who schedule and manage calls (everyone else only sees the calls they are invited to).
 * It is false until the server has answered; the server checks it again on every call, so this only decides what to show.
 */
export function useCanManageCalls(): boolean {
  const org = activeOrg();
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    if (!org) return;
    let current = true;
    let pending = asked.get(org);
    if (!pending) { pending = myAccess(org).then(r => (r.ok ? r.data.role : null)); asked.set(org, pending); }
    void pending.then(r => { if (current) setRole(r); });
    return () => { current = false; };
  }, [org]);
  return role === 'owner' || role === 'admin';
}
