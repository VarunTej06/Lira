import type { Issue } from '../types/issue';
import { countOf, orderForCreation, remapObject, type ImportBundle, type ImportCounts } from '../utils/importWorkspace';
import { createSpaceOnServer, createTicketOnServer, saveObject, updateTicketOnServer, type ObjectKind } from './workspaceApi';

export interface ImportReport { made: ImportCounts; problems: string[] }
const KINDS = [['projects', 'project'], ['roadmaps', 'roadmap'], ['dashboards', 'dashboard']] as const satisfies readonly (readonly [keyof ImportCounts & keyof ImportBundle, ObjectKind])[];

/** A free key for a space whose key is taken: AB, AB2, AB3, and so on. */
const alternatives = (key: string): string[] => Array.from({ length: 8 }, (_, i) => `${key.slice(0, 9)}${i + 2}`);

/**
 * Puts a local workspace into the organisation, through the same calls the app itself uses, so the server checks and audits every
 * space, ticket and object as if the person had made it by hand. Spaces and tickets get new numbers and keys; parents, epics, links and
 * the spaces named by projects, roadmaps and dashboards follow them. A space whose key is taken gets a new key. A ticket the server
 * refuses is reported and left out, and the rest go on. Files attached to tickets are not imported.
 */
export async function importWorkspace(org: string, bundle: ImportBundle, progress: (done: number, total: number) => void = () => undefined): Promise<ImportReport> {
  const total = countOf(bundle);
  const made: ImportCounts = { spaces: 0, tickets: 0, projects: 0, roadmaps: 0, dashboards: 0 };
  const problems: string[] = [];
  const spaceIds = new Map<number, number>(); const keys = new Map<string, string>();
  let done = 0;
  const step = () => progress(++done, total.spaces + total.tickets + total.projects + total.roadmaps + total.dashboards);

  for (const { space, issues } of bundle.spaces) {
    let created = await createSpaceOnServer(org, space);
    for (const key of created.ok || created.status !== 409 ? [] : alternatives(space.key)) {
      created = await createSpaceOnServer(org, { ...space, key });
      if (created.ok || created.status !== 409) break;
    }
    step();
    if (!created.ok) { problems.push(`Space ${space.key} was not imported: ${created.message}`); continue; }
    made.spaces += 1;
    spaceIds.set(space.id!, created.data.id!); keys.set(space.key, created.data.key);
    const newIds = new Map<number, number>(); const made2: { old: Issue; id: number; version: number }[] = [];
    for (const issue of orderForCreation(issues)) {
      const { id: _id, key: _key, version: _version, parentId, epicId, blockedByIds: _blocked, linkedIssues: _links, ...rest } = issue;
      const r = await createTicketOnServer(org, created.data.id!, {
        ...rest, ...(parentId !== undefined && newIds.has(parentId) ? { parentId: newIds.get(parentId) } : {}), ...(epicId !== undefined && newIds.has(epicId) ? { epicId: newIds.get(epicId) } : {}),
        linkedIssues: [],
      });
      step();
      if (!r.ok) { problems.push(`${issue.key}: ${r.message}`); continue; }
      newIds.set(issue.id!, r.data.id!); made.tickets += 1; made2.push({ old: issue, id: r.data.id!, version: r.data.version ?? 1 });
    }
    for (const { old, id, version } of made2) { // links and blockers name other tickets, so they are set once all of them have their new numbers
      const links = (old.linkedIssues ?? []).filter(l => newIds.has(l.issueId)).map(l => ({ ...l, issueId: newIds.get(l.issueId)! }));
      const blocked = (old.blockedByIds ?? []).filter(b => newIds.has(b)).map(b => newIds.get(b)!);
      if (links.length === 0 && blocked.length === 0) continue;
      const r = await updateTicketOnServer(org, id, version, { linkedIssues: links, ...(blocked.length ? { blockedByIds: blocked } : {}) });
      if (!r.ok) problems.push(`${old.key}: its links were not imported (${r.message})`);
    }
  }
  for (const [group, kind] of KINDS) {
    for (const doc of bundle[group]) {
      const r = await saveObject(org, kind, doc.id, { doc: remapObject(kind, doc, spaceIds, keys) });
      step();
      if (r.ok) made[group] += 1; else problems.push(`The ${kind} "${typeof doc.name === 'string' ? doc.name : doc.id}" was not imported: ${r.message}`);
    }
  }
  return { made, problems };
}
