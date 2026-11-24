import { db } from '../db/db';
import type { Issue } from '../types/issue';
import type { Space } from '../types/space';
import { activeOrg } from '../utils/hostedOrg';
import { waitingIssues, waitingSpaces, writeFromServer } from './hostedSync';
import { listSpaces, listTickets } from './workspaceApi';

/** True when the cache row is older than the server's, or the server's is new to it. */
const newer = <T extends { id?: number; version?: number }>(local: Map<number, T>, remote: T): boolean => (local.get(remote.id!)?.version ?? 0) < (remote.version ?? 1);

/**
 * Another person changed something. Brings the cache in line with the server, for one space or for everything: what they added or
 * changed arrives, what they deleted (or what this person may no longer see) goes. A change of this person's own that is still waiting
 * to be sent is left alone, so a refresh never undoes it. Does nothing when the server cannot be reached; the next note or the next
 * reconnect tries again.
 */
export async function refreshFromServer(spaceId: number | null): Promise<void> {
  const org = activeOrg();
  if (!org) return;
  const spaces = await listSpaces(org);
  if (!spaces.ok) return;
  const wanted = spaceId === null ? spaces.data : spaces.data.filter(s => s.id === spaceId);
  const lists = await Promise.all(wanted.map(s => listTickets(org, s.id!)));
  if (lists.some(l => !l.ok)) return;
  const tickets = new Map<number, Issue[]>(wanted.map((s, i) => [s.id!, lists[i].ok ? lists[i].data : []]));
  const kept = new Set(spaces.data.map(s => s.id!));
  await writeFromServer(async () => {
    const heldSpaces = waitingSpaces();
    const heldIssues = waitingIssues();
    const localSpaces = new Map<number, Space>((await db.spaces.toArray()).map(s => [s.id!, s]));
    for (const [id, row] of localSpaces) if (row.version && !kept.has(id) && !heldSpaces.has(id)) { await db.spaces.delete(id); await db.issues.where('spaceId').equals(id).delete(); }
    await db.spaces.bulkPut(spaces.data.filter(s => !heldSpaces.has(s.id!) && newer(localSpaces, s)));
    for (const [id, remote] of tickets) {
      const local = new Map<number, Issue>((await db.issues.where('spaceId').equals(id).toArray()).map(i => [i.id!, i]));
      const onServer = new Set(remote.map(i => i.id!));
      for (const [issueId, row] of local) if (row.version && !onServer.has(issueId) && !heldIssues.has(issueId)) await db.issues.delete(issueId);
      await db.issues.bulkPut(remote.filter(i => !heldIssues.has(i.id!) && newer(local, i)));
    }
  });
}
