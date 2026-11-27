import Dexie, { type Transaction } from 'dexie';
import { db } from '../db/db';
import type { Issue } from '../types/issue';
import type { Space } from '../types/space';
import { activeOrg } from '../utils/hostedOrg';
import {
  createSpaceOnServer, createTicketOnServer, deleteSpaceOnServer, deleteTicketOnServer, listSpaces, listTickets, updateSpaceOnServer, updateTicketOnServer,
} from './workspaceApi';

/**
 * Hosted edition: the server is the only copy that counts (ADR-0005, ADR-0010). The browser's database is a cache that makes pages
 * load fast; it is filled from the server at start, and every change made to it is sent to the server a moment later. Nothing is
 * seeded and nothing is kept only here: if the server cannot be reached the change stays queued and is tried again.
 */
const DELAY_MS = 300;
const RETRY_MS = 5000;

/** Transactions that write the server's answer into the cache. Their writes are not sent back. Marked per transaction, so a person's own edit made at the same moment is still queued. */
const fromServer = new WeakSet<Transaction>();
let hooked = false;
const dirtySpaces = new Set<number>();
const dirtyIssues = new Set<number>();
const deletedSpaces = new Map<number, number>();
const deletedIssues = new Map<number, number>();
let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<void> = Promise.resolve();

const orgOrThrow = (): string => {
  const org = activeOrg();
  if (!org) throw new Error('Not signed in to an organisation.');
  return org;
};

/** Writes to the cache without queueing them for the server. */
function quietly<T>(write: () => Promise<T>): Promise<T> {
  return db.transaction('rw', db.spaces, db.issues, async () => { fromServer.add(Dexie.currentTransaction); return write(); });
}

/** What is still waiting to be sent to the server, so that bringing in other people's changes never overwrites it. */
export const waitingIssues = (): ReadonlySet<number> => new Set([...dirtyIssues, ...deletedIssues.keys()]);
export const waitingSpaces = (): ReadonlySet<number> => new Set([...dirtySpaces, ...deletedSpaces.keys()]);
/** Writes the server's answer to the cache without sending it back. */
export const writeFromServer = quietly;

/** Fills the cache from the server. The cache is replaced, not merged: whatever it held before is not the truth. */
export async function initHostedSync(): Promise<void> {
  const org = orgOrThrow();
  const spaces = await listSpaces(org);
  if (!spaces.ok) throw new Error(spaces.message);
  const tickets = await Promise.all(spaces.data.map(space => listTickets(org, space.id!)));
  const failed = tickets.find(t => !t.ok);
  if (failed && !failed.ok) throw new Error(failed.message);
  await quietly(async () => {
    await db.spaces.clear();
    await db.issues.clear();
    await db.spaces.bulkPut(spaces.data);
    await db.issues.bulkPut(tickets.flatMap(t => (t.ok ? t.data : [])));
  });
  registerHooks();
}

function schedule(delay = DELAY_MS): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = undefined; running = running.then(sendQueued); }, delay);
}

function registerHooks(): void {
  if (hooked) return;
  hooked = true;
  db.issues.hook('updating', (_mods, id, _row, tx) => { if (!fromServer.has(tx)) { dirtyIssues.add(Number(id)); schedule(); } });
  db.spaces.hook('updating', (_mods, id, _row, tx) => { if (!fromServer.has(tx)) { dirtySpaces.add(Number(id)); schedule(); } });
  db.issues.hook('deleting', (id, row, tx) => {
    if (fromServer.has(tx)) return;
    dirtyIssues.delete(Number(id));
    if (row.version) { deletedIssues.set(Number(id), row.version); schedule(); }
  });
  db.spaces.hook('deleting', (id, row, tx) => {
    if (fromServer.has(tx)) return;
    dirtySpaces.delete(Number(id));
    if (row.version) { deletedSpaces.set(Number(id), row.version); schedule(); }
  });
}

/** After a refusal for a stale version, the server's copy replaces ours: someone else changed it first. */
async function reloadSpaces(org: string): Promise<void> {
  const all = await listSpaces(org);
  if (all.ok) await quietly(() => db.spaces.bulkPut(all.data));
}

async function reloadTickets(org: string, spaceId: number): Promise<void> {
  const tickets = await listTickets(org, spaceId);
  if (tickets.ok) await quietly(() => db.issues.bulkPut(tickets.data));
}

async function sendDeletes(org: string): Promise<boolean> {
  let ok = true;
  for (const [id, version] of [...deletedIssues]) {
    const r = await deleteTicketOnServer(org, id, version);
    if (r.ok || r.status === 404) deletedIssues.delete(id); else ok = false;
  }
  for (const [id, version] of [...deletedSpaces]) {
    const r = await deleteSpaceOnServer(org, id, version);
    if (r.ok || r.status === 404) deletedSpaces.delete(id); else ok = false;
  }
  return ok;
}

async function sendSpaces(org: string): Promise<boolean> {
  let ok = true;
  for (const id of [...dirtySpaces]) {
    const row = await db.spaces.get(id);
    dirtySpaces.delete(id);
    if (!row?.version) continue;
    const r = await updateSpaceOnServer(org, id, row.version, { name: row.name, icon: row.icon, color: row.color, description: row.description });
    if (r.ok) await quietly(() => db.spaces.update(id, { version: r.data.version }));
    else if (r.status === 409) await reloadSpaces(org);
    else if (r.status !== 404) { dirtySpaces.add(id); ok = false; }
  }
  return ok;
}

async function sendIssues(org: string): Promise<boolean> {
  let ok = true;
  for (const id of [...dirtyIssues]) {
    const row = await db.issues.get(id);
    dirtyIssues.delete(id);
    if (!row?.version) continue;
    const r = await updateTicketOnServer(org, id, row.version, row);
    if (r.ok) await quietly(() => db.issues.update(id, { version: r.data.version }));
    else if (r.status === 409) await reloadTickets(org, row.spaceId);
    else if (r.status !== 404) { dirtyIssues.add(id); ok = false; }
  }
  return ok;
}

/** Sends what is queued, deletes first. Anything that fails stays queued and is tried again in a few seconds. */
async function sendQueued(): Promise<void> {
  const org = activeOrg();
  if (!org) return;
  const results = [await sendDeletes(org), await sendSpaces(org), await sendIssues(org)];
  if (results.includes(false)) schedule(RETRY_MS);
}

/** Sends everything queued now and waits for it. Used before leaving the page and by the tests. */
export async function flushHostedSync(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = undefined; }
  running = running.then(sendQueued);
  await running;
}

/** Creates the space on the server first, because the server gives it its number; the cache then holds the server's row. */
export async function createSpaceHosted(space: Omit<Space, 'id'>): Promise<number> {
  const r = await createSpaceOnServer(orgOrThrow(), space);
  if (!r.ok) throw new Error(r.message);
  await quietly(() => db.spaces.put(r.data));
  return r.data.id!;
}

/** Creates the ticket on the server first, because the server gives it its number and key; the cache then holds the server's row. */
export async function createIssueHosted(issue: Omit<Issue, 'id'>): Promise<number> {
  const r = await createTicketOnServer(orgOrThrow(), issue.spaceId, issue);
  if (!r.ok) throw new Error(r.message);
  await quietly(() => db.issues.put(r.data));
  return r.data.id!;
}

/** For the tests: forgets the queue and the hooks' state. */
export function resetHostedSync(): void {
  if (timer) clearTimeout(timer);
  timer = undefined; running = Promise.resolve();
  for (const set of [dirtySpaces, dirtyIssues]) set.clear();
  for (const map of [deletedSpaces, deletedIssues]) map.clear();
}
