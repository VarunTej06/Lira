import { refreshCollections } from './kvMirror';
import { refreshFromServer } from './hostedRefresh';

/** How long to wait for more notes before asking the server, so a burst of changes is one refresh. */
const DELAY_MS = 250;

export interface Note { kind: 'ticket' | 'space' | 'object'; spaceId: number | null }

let source: EventSource | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let wantedSpaces = new Set<number | null>();
let wantedObjects = false;
let dropped = false;

/** A note from the server is `{ kind, spaceId }`; anything else is ignored (undefined). */
export function noteOf(data: unknown): Note | undefined {
  if (typeof data !== 'string') return undefined;
  let note: unknown;
  try { note = JSON.parse(data); } catch { return undefined; }
  const n = note as { kind?: unknown; spaceId?: unknown } | null;
  if (n?.kind !== 'ticket' && n?.kind !== 'space' && n?.kind !== 'object') return undefined;
  if (n.spaceId === null) return { kind: n.kind, spaceId: null };
  return typeof n.spaceId === 'number' && Number.isInteger(n.spaceId) ? { kind: n.kind, spaceId: n.spaceId } : undefined;
}

function later(note: Note | 'everything'): void {
  if (note === 'everything') { wantedSpaces.add(null); wantedObjects = true; }
  else if (note.kind === 'object') wantedObjects = true;
  else wantedSpaces.add(note.spaceId);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    const spaces = wantedSpaces; const objects = wantedObjects;
    wantedSpaces = new Set(); wantedObjects = false;
    // One space is refreshed on its own; anything about everything (or two or more spaces) is one full refresh.
    if (spaces.size > 0) void refreshFromServer(spaces.size === 1 ? [...spaces][0] : null).catch(() => undefined);
    if (objects) void refreshCollections().catch(() => undefined);
  }, DELAY_MS);
}

/** Opens the stream of changes for the organisation, once. The browser reconnects by itself; after a break everything is refreshed, in case a note was missed. */
export function startHostedLive(orgId: string): void {
  if (source || typeof EventSource === 'undefined') return;
  source = new EventSource(`/api/orgs/${encodeURIComponent(orgId)}/events`);
  source.onmessage = e => { const note = noteOf(e.data); if (note) later(note); };
  source.onerror = () => { dropped = true; };
  source.onopen = () => { if (dropped) { dropped = false; later('everything'); } };
}

export function stopHostedLive(): void {
  source?.close();
  source = undefined;
  if (timer) clearTimeout(timer);
  timer = undefined; wantedSpaces = new Set(); wantedObjects = false; dropped = false;
}
