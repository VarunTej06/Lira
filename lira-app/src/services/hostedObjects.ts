import { deleteObject, listObjects, saveObject, type ObjectKind } from './workspaceApi';

/**
 * Hosted edition: projects, roadmaps and dashboards are one row each on the server, so access can be given to one and not another
 * (ADR-0010). The app still holds each kind as one JSON list under its `lira_*` key; this turns that list into rows and back.
 */
export const COLLECTIONS: Readonly<Record<string, ObjectKind>> = { lira_projects: 'project', lira_roadmaps: 'roadmap', lira_dashboards: 'dashboard' };
export const isCollectionKey = (key: string): boolean => key in COLLECTIONS;

interface Known { version: number; json: string }
/** What the server has, as it last confirmed: version and body of each row, by kind. */
const known: Record<string, Map<string, Known>> = {};

export interface Changes {
  put: { id: string; doc: Record<string, unknown>; position: number; version?: number }[];
  remove: { id: string; version: number }[];
}

/** The rows to create or change, and the ones to delete, to make the server match the list. A row without a text id cannot be kept on the server and is skipped. */
export function diffCollection(list: unknown[], have: Map<string, Known>): Changes {
  const changes: Changes = { put: [], remove: [] };
  const seen = new Set<string>();
  list.forEach((item, position) => {
    const doc = item as Record<string, unknown> | null;
    if (!doc || typeof doc !== 'object' || typeof doc.id !== 'string') return;
    seen.add(doc.id);
    const was = have.get(doc.id);
    if (!was) changes.put.push({ id: doc.id, doc, position });
    else if (was.json !== JSON.stringify(doc)) changes.put.push({ id: doc.id, doc, position, version: was.version });
  });
  for (const [id, was] of have) if (!seen.has(id)) changes.remove.push({ id, version: was.version });
  return changes;
}

/** Reads one kind from the server into the list text the app keeps, and remembers what the server has. Null when the server cannot be asked. */
export async function loadCollection(orgId: string, key: string): Promise<{ text: string | null } | null> {
  const kind = COLLECTIONS[key];
  const r = await listObjects(orgId, kind);
  if (!r.ok) return null;
  known[kind] = new Map(r.data.map(o => [o.id, { version: o.version, json: JSON.stringify(o.doc) }]));
  return { text: r.data.length ? JSON.stringify(r.data.map(o => o.doc)) : null };
}

/**
 * Sends what changed in one list. Resolves 'ok' when the server matches the list, 'reload' when it refused (someone else changed it first, or
 * the person may not make that change) so the list must be read again from the server, and 'retry' when the server could not be reached.
 */
export async function syncCollection(orgId: string, key: string, text: string | null): Promise<'ok' | 'reload' | 'retry'> {
  const kind = COLLECTIONS[key];
  const have = (known[kind] ??= new Map());
  let list: unknown[] = [];
  try { const parsed: unknown = text === null ? [] : JSON.parse(text); if (Array.isArray(parsed)) list = parsed; else return 'ok'; } catch { return 'ok'; }
  const changes = diffCollection(list, have);
  for (const item of changes.put) {
    const r = await saveObject(orgId, kind, item.id, { doc: item.doc, position: item.position, ...(item.version ? { version: item.version } : {}) });
    if (r.ok) have.set(item.id, { version: r.data.version, json: JSON.stringify(item.doc) });
    else return r.status === 0 || r.status >= 500 ? 'retry' : 'reload';
  }
  for (const item of changes.remove) {
    const r = await deleteObject(orgId, kind, item.id, item.version);
    if (r.ok || r.status === 404) have.delete(item.id);
    else return r.status === 0 || r.status >= 500 ? 'retry' : 'reload';
  }
  return 'ok';
}

/** For the tests and sign-out: forgets what the server had. */
export function resetHostedObjects(): void { for (const kind of Object.keys(known)) delete known[kind]; }
