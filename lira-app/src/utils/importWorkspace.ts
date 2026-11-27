import type { Issue } from '../types/issue';
import type { Space } from '../types/space';

/** One of the local edition's files, as the browser read it. */
export interface PickedFile { name: string; text: string }
type Obj = Record<string, unknown> & { id: string };
export interface ImportSpace { space: Space; issues: Issue[] }
export interface ImportBundle { spaces: ImportSpace[]; projects: Obj[]; roadmaps: Obj[]; dashboards: Obj[] }
export interface ParsedImport { bundle: ImportBundle; ignored: string[]; problems: string[] }
export interface ImportCounts { spaces: number; tickets: number; projects: number; roadmaps: number; dashboards: number }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const SPACE_KEY = /^[A-Z][A-Z0-9]{1,9}$/;

/** A space the server would accept, or why not. Dates are not needed: the server dates what it makes. */
function checkSpace(raw: unknown): Space | string {
  if (!isObject(raw) || typeof raw.id !== 'number') return 'a space without a number';
  if (!text(raw.key, 10) || !SPACE_KEY.test(raw.key)) return `the space key "${String(raw.key)}" is not 2 to 10 capital letters or digits`;
  if (!text(raw.name, 100)) return `the space ${raw.key} has no name`;
  return { id: raw.id, key: raw.key, name: raw.name, icon: typeof raw.icon === 'string' && raw.icon ? raw.icon.slice(0, 32) : 'folder',
    color: typeof raw.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(raw.color) ? raw.color : '#336699', ...(typeof raw.description === 'string' ? { description: raw.description.slice(0, 2000) } : {}),
    createdAt: new Date(), updatedAt: new Date() };
}

function checkIssue(raw: unknown): Issue | null {
  if (!isObject(raw) || typeof raw.id !== 'number' || typeof raw.spaceId !== 'number' || !text(raw.title, 500)) return null;
  if (typeof raw.type !== 'string' || typeof raw.status !== 'string' || typeof raw.priority !== 'string') return null;
  return raw as unknown as Issue;
}

function objectsOf(list: unknown, ignored: string[], what: string): Obj[] {
  if (!Array.isArray(list)) return [];
  const out: Obj[] = [];
  for (const item of list) {
    if (isObject(item) && typeof item.id === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(item.id)) out.push(item as Obj);
    else ignored.push(`a ${what} without a usable id`);
  }
  return out;
}

/**
 * Reads the files of a local workspace, whichever way they were picked (the one `lira-workspace.json`, or `spaces.json` with the files
 * under `spaces/`, with `projects.json`, `dashboards.json` and `roadmaps/*.json`). A file is recognised by what is in it, not by its
 * name. Anything that is not understood is listed, never guessed at, and nothing is sent anywhere here.
 */
export function parseImportFiles(files: PickedFile[]): ParsedImport {
  const bySpace = new Map<string, ImportSpace>();
  const bundle: ImportBundle = { spaces: [], projects: [], roadmaps: [], dashboards: [] };
  const ignored: string[] = []; const problems: string[] = [];
  const addSpace = (rawSpace: unknown, rawIssues: unknown) => {
    const space = checkSpace(rawSpace);
    if (typeof space === 'string') { problems.push(`Skipped ${space}.`); return; }
    const issues = (Array.isArray(rawIssues) ? rawIssues : []).map(checkIssue).filter((i): i is Issue => i !== null && i.spaceId === space.id);
    const lost = (Array.isArray(rawIssues) ? rawIssues.length : 0) - issues.length;
    if (lost > 0) problems.push(`${lost} ticket(s) of ${space.key} were not usable and are left out.`);
    if (!bySpace.has(space.key)) bySpace.set(space.key, { space, issues });
  };
  for (const file of files) {
    let json: unknown;
    try { json = JSON.parse(file.text); } catch { ignored.push(`${file.name} (not JSON)`); continue; }
    if (!isObject(json)) { ignored.push(`${file.name} (not a Lira file)`); continue; }
    const entries = isObject(json.entries) ? json.entries : null;
    if (Array.isArray(json.spaces) && Array.isArray(json.issues) && json.spaces.every(isObject) && json.spaces.some(s => 'key' in s)) {
      for (const s of json.spaces) addSpace(s, (json.issues as unknown[]).filter(i => isObject(i) && i.spaceId === s.id));
    } else if (isObject(json.space) && Array.isArray(json.issues)) addSpace(json.space, json.issues);
    else if (entries && Array.isArray(entries.lira_projects)) bundle.projects.push(...objectsOf(entries.lira_projects, ignored, 'project'));
    else if (entries && Array.isArray(entries.lira_dashboards)) bundle.dashboards.push(...objectsOf(entries.lira_dashboards, ignored, 'dashboard'));
    else if (isObject(json.roadmap)) bundle.roadmaps.push(...objectsOf([json.roadmap], ignored, 'roadmap'));
    else ignored.push(file.name);
  }
  bundle.spaces = [...bySpace.values()];
  return { bundle, ignored, problems };
}

export const countOf = (b: ImportBundle): ImportCounts =>
  ({ spaces: b.spaces.length, tickets: b.spaces.reduce((n, s) => n + s.issues.length, 0), projects: b.projects.length, roadmaps: b.roadmaps.length, dashboards: b.dashboards.length });

/** Tickets in the order they can be made: a ticket's parent and epic come before it. One that points at something missing, or in a loop, comes last and loses the link. */
export function orderForCreation(issues: Issue[]): Issue[] {
  const byId = new Map(issues.map(i => [i.id!, i]));
  const done = new Set<number>(); const out: Issue[] = [];
  const visit = (issue: Issue, path: Set<number>) => {
    if (done.has(issue.id!) || path.has(issue.id!)) return;
    path.add(issue.id!);
    for (const ref of [issue.parentId, issue.epicId]) { const next = ref === undefined ? undefined : byId.get(ref); if (next) visit(next, path); }
    done.add(issue.id!); out.push(issue);
  };
  for (const issue of issues) visit(issue, new Set());
  return out;
}

/** The space numbers inside a project, roadmap or dashboard, moved to the numbers the spaces were given on the server. */
export function remapObject(kind: 'project' | 'roadmap' | 'dashboard', doc: Obj, spaceIds: Map<number, number>, keys: Map<string, string>): Obj {
  const next: Obj = { ...doc };
  const move = (n: unknown) => (typeof n === 'number' ? spaceIds.get(n) ?? n : n);
  if (kind === 'project' && typeof doc.spaceId === 'number') next.spaceId = move(doc.spaceId);
  if (kind === 'roadmap' && typeof doc.spaceKey === 'string') next.spaceKey = keys.get(doc.spaceKey) ?? doc.spaceKey;
  if (kind === 'dashboard') {
    const remap = (f: unknown) => (isObject(f) && Array.isArray(f.spaceIds) ? { ...f, spaceIds: f.spaceIds.map(move) } : f);
    if (doc.filters !== undefined) next.filters = remap(doc.filters);
    if (Array.isArray(doc.widgets)) next.widgets = doc.widgets.map(w => (isObject(w) && w.filters !== undefined ? { ...w, filters: remap(w.filters) } : w));
  }
  return next;
}
