# ADR-0005: Client data layer, sync and offline behaviour

- **Status:** Proposed
- **Date proposed:** 2026-11-09
- **Decision owner:** (to be named)

## Context
The UI reads and writes through three layers that exist today:
1. **Dexie / IndexedDB** for spaces, issues and columns (`src/db/db.ts`), plus read-only projections of projects, sprints, teams and standups (`src/services/structuredStore.ts`).
2. **`localStorage` keys `lira_*`** as the real store for settings-style data, mirrored to `data/*.json` (`src/services/kvMirror.ts`, rule: disk wins unless the browser has unsaved changes).
3. **Disk sync** of tickets to `data/spaces/<KEY>.json` (`src/services/localDiskSync.ts`).

Since 9 Nov 2026 the app reads and writes these keys only through `src/utils/appStorage.ts` (a pass-through; a test fails if code touches `localStorage` directly), so there is already one seam where keys can be prefixed per user and wiped on sign-out.

With several users, a browser cache can be stale, and "browser wins if dirty" is a conflict rule that cannot work between people. Before the 9 Nov 2026 cleanup, 147 direct `localStorage` calls were spread through the code.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| **A. Server is the source of truth; client keeps a read cache** (TanStack Query or similar) with optimistic updates | Simple mental model; correct under concurrency | Needs network for writes |
| **B. Offline-first with local writes and background sync** (CRDT or operation log) | Works offline | Large complexity; conflict semantics for every field |
| **C. Keep Dexie as source and sync it** | Fewest UI changes | Hardest to make correct; hides conflicts |

## Recommendation
Option A. Introduce a **`DataStore` interface** (load/save tickets, sprints, roadmaps…) with two implementations: `LocalFilesStore` (today's behaviour, local edition) and `ApiStore` (hosted edition). Screens depend only on the interface. Use **optimistic concurrency** (`version` per record; the server rejects stale writes with 409 and the UI offers reload/merge). Add **live updates** by Server-Sent Events or WebSocket events so a board refreshes when a colleague moves a card. Per-user preferences (theme, sidebar) stay in one storage wrapper, never mixed with shared data. If offline use is a hard requirement, scope it to read-only access to the last-viewed spaces.

## Consequences
- The `lira_*` mirror and `structuredStore` projection are removed from the hosted edition; their data moves into real tables (ADR 0003, 0008).
- A migration path (strangler pattern): ship `DataStore`, move one feature at a time behind it.
- Test the conflict path explicitly (two users edit one ticket).

## Security and operations impact
Cache entries must be cleared on logout and user switch (no data from one user visible to the next in a shared browser).

## Revisit when
Offline editing becomes a stated requirement.
