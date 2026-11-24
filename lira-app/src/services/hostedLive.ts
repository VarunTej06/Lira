import { refreshFromServer } from './hostedRefresh';

/** How long to wait for more notes before asking the server, so a burst of changes is one refresh. */
const DELAY_MS = 250;

let source: EventSource | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let wanted = new Set<number | null>();
let dropped = false;

/** A note from the server is `{ kind, spaceId }`; anything else is ignored. Returns the space it is about, undefined when it is not a note. */
export function spaceOfNote(data: unknown): number | null | undefined {
  if (typeof data !== 'string') return undefined;
  let note: unknown;
  try { note = JSON.parse(data); } catch { return undefined; }
  const n = note as { kind?: unknown; spaceId?: unknown } | null;
  if (n?.kind !== 'ticket' && n?.kind !== 'space') return undefined;
  if (n.spaceId === null) return null;
  return typeof n.spaceId === 'number' && Number.isInteger(n.spaceId) ? n.spaceId : undefined;
}

function later(space: number | null): void {
  wanted.add(space);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    const batch = wanted;
    wanted = new Set();
    // One space is refreshed on its own; anything about everything (or two or more spaces) is one full refresh.
    const only = batch.size === 1 ? [...batch][0] : null;
    void refreshFromServer(only).catch(() => undefined);
  }, DELAY_MS);
}

/** Opens the stream of changes for the organisation, once. The browser reconnects by itself; after a break everything is refreshed, in case a note was missed. */
export function startHostedLive(orgId: string): void {
  if (source || typeof EventSource === 'undefined') return;
  source = new EventSource(`/api/orgs/${encodeURIComponent(orgId)}/events`);
  source.onmessage = e => { const space = spaceOfNote(e.data); if (space !== undefined) later(space); };
  source.onerror = () => { dropped = true; };
  source.onopen = () => { if (dropped) { dropped = false; later(null); } };
}

export function stopHostedLive(): void {
  source?.close();
  source = undefined;
  if (timer) clearTimeout(timer);
  timer = undefined; wanted = new Set(); dropped = false;
}
