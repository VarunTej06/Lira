# 03 — Database & Storage

> **Updated November 2026.** This document was written earlier; the last section, "Update (November 2026)", lists what has changed since. The root [README](../README.md), [SETUP](../SETUP.md) and [ROADMAP](../ROADMAP.md) are always the most current.

## 1. Why IndexedDB over LocalStorage

| Feature | LocalStorage | IndexedDB (via Dexie.js) |
|---------|-------------|------------------------|
| Storage limit | ~5 MB per origin | Hundreds of GB (disk-quota based) |
| Data types | Strings only — must JSON.stringify/parse | Native JS objects, Dates, Blobs, ArrayBuffers |
| Querying | None — full scan required | B-tree indexes, range queries, compound keys |
| Transactions | None | ACID transactions prevent partial writes |
| Async | Synchronous — blocks UI thread | Fully asynchronous (Promises / async-await) |
| Binary files | Not practical | Native Blob storage (attachments, images) |
| Schema versions | Manual | Built-in versioned migrations |
| Reactivity | None | Dexie `useLiveQuery` — auto re-renders on change |

**In plain English:** LocalStorage is like a single Post-it note.  IndexedDB
is like a full filing cabinet with labelled folders, tabs, and a search index.

---

## 2. Dexie.js Schema (`src/db/db.ts`)

```typescript
import Dexie, { type Table } from 'dexie';
import type { Issue } from '../types/issue';
import type { Space, Column } from '../types/space';

export class LiraDatabase extends Dexie {
  spaces!: Table<Space, number>;
  issues!: Table<Issue, number>;
  columns!: Table<Column, string>;

  constructor() {
    super('LiraDB');

    // Version 1 — initial schema
    this.version(1).stores({
      spaces: '++id, name, key, createdAt',
      issues: '++id, spaceId, key, status, priority, assignee, dueDate, rank, createdAt, updatedAt, [spaceId+status]',
      columns: 'id, spaceId, order',
    });

    // Version 2 — adds parentId & epicId for hierarchy
    this.version(2).stores({
      spaces: '++id, name, key, createdAt',
      issues: '++id, spaceId, key, status, priority, assignee, dueDate, rank, createdAt, updatedAt, [spaceId+status], parentId, epicId',
      columns: 'id, spaceId, order',
    });
  }
}

export const db = new LiraDatabase();
```

### Index explanation

| Index | Type | Usage |
|-------|------|-------|
| `++id` | Auto-increment primary key | Unique row ID |
| `spaceId` | Single | Filter all issues belonging to a space |
| `key` | Single | Look up `CERT-1` directly |
| `status` | Single | Filter by Backlog/Todo/InProgress/Done |
| `[spaceId+status]` | **Compound** | Efficient Kanban column query |
| `parentId` | Single | Fetch all direct children of an issue |
| `epicId` | Single | Fetch all issues belonging to an Epic |
| `rank` | Single | Sort cards within a column |

---

## 3. TypeScript Interfaces

### Space
```typescript
export interface Space {
  id?: number;          // auto-assigned by Dexie
  name: string;         // "Certifications"
  key: string;          // "CERT" — used as ticket prefix
  icon: string;         // emoji ""
  color: string;        // hex "#0052CC"
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Issue (abridged)
```typescript
export interface Issue {
  id?: number;
  spaceId: number;
  key: string;             // "CERT-3"
  parentId?: number;       // → points to parent issue.id
  epicId?: number;         // → root Epic's id (fast lookup)
  title: string;
  description: string;
  type: 'epic' | 'task' | 'bug' | 'subtask';
  status: 'backlog' | 'todo' | 'inprogress' | 'done' | string;
  priority: 'highest' | 'high' | 'medium' | 'low' | 'lowest';
  assignee?: string;
  dueDate?: Date;
  startDate?: Date;
  labels: string[];
  subtasks: Subtask[];        // Embedded checklist for Tasks
  comments: Comment[];
  activity: ActivityEntry[];
  attachments: Attachment[];
  rank: number;               // float for ordering within column
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  timeEstimate?: number;      // minutes
  timeLogged?: number;        // minutes
  watchers: string[];
  storyPoints?: number;
}
```

---

## 4. Key Queries

### Fetch all root issues in a space (Kanban board)
```typescript
const all = await db.issues.where('spaceId').equals(spaceId).sortBy('rank');
return all.filter(i => !i.parentId); // exclude children
```

### Fetch child issues (ChildIssues table)
```typescript
const children = await db.issues
  .where('parentId').equals(parentId)
  .sortBy('rank');
```

### Reactive Kanban column (via compound index)
```typescript
useLiveQuery(
  () => db.issues.where('[spaceId+status]').equals([spaceId, 'inprogress']).sortBy('rank'),
  [spaceId]
);
```

---

## 5. Binary File Storage (Attachments)

Files attached to issues are stored as **base64 data URLs** inside the
`attachments` array on the Issue row.  This works because IndexedDB can store
arbitrarily large strings and binary data.

```typescript
// IssueAttachments.tsx — reading a file
const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);           // converts to base64
  });

// Stored in the Issue:
const attachment: Attachment = {
  id: uuidv4(),
  name: file.name,
  size: file.size,
  type: file.type,
  dataUrl: await readFileAsDataUrl(file), // persisted in IndexedDB
  createdAt: new Date(),
};
```

Image thumbnails are rendered directly from the stored `dataUrl`:
```tsx
<img src={att.dataUrl} alt={att.name} className="w-10 h-10 object-cover rounded" />
```

---

## 6. Data Durability API

By default, browsers treat IndexedDB as a **best-effort cache** — they can
evict it when disk space is low.  Lira requests **durable (persistent)** storage
on startup:

```typescript
// db/db.ts
export async function requestDurableStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    const already = await navigator.storage.persisted();
    if (!already) return navigator.storage.persist();
    return true;
  }
  return false;
}
```

Once `persist()` returns `true`, the browser **promises never to evict** the
database without user action.  Lira shows a green indicator in the settings
panel when durable storage is active.

> **Analogy:** Without `persist()` your study notes are stored on a whiteboard
> that can be erased.  With `persist()` they're carved in stone.

---

## 7. Schema Migration Strategy

Dexie handles migrations automatically.  When you bump the version number, Dexie
runs the new `.stores()` definition to add or rename indexes while keeping all
existing data intact.

```typescript
// Safe upgrade: only adds indexes, never deletes data
this.version(2).stores({
  issues: '... existing ... , parentId, epicId',  // added two new indexes
});
```

If a breaking change is needed (e.g., renaming a column), use `.upgrade()`:
```typescript
this.version(3).stores({ ... }).upgrade(tx => {
  return tx.issues.toCollection().modify(issue => {
    issue.newField = issue.oldField ?? 'default';
  });
});
```

## Update (November 2026)

- **Source of truth is `data/`.** Tickets: `data/spaces/<KEY>.json`. Everything else: `data/projects.json`, `sprints.json`, `teams.json`, `standups.json`, `settings.json`, `board-config.json`, `roadmaps/<id>.json`. Secrets and the tablet link secret: `data/private/` (git-ignored).
- **`kvMirror.ts`** mirrors every `lira_*` localStorage key to the right file (`fileForKey`) and loads them back before the app renders. **Disk wins on load, unless the browser has unsaved changes** (`lira__kv_dirty`, `lira__issues_dirty`).
- **Dexie version 3** adds `projects`, `sprints`, `teams` and `standups` tables, filled from the files by `structuredStore.ts` as a read-only, queryable copy.
- **New ticket fields:** `sprint` (a month key `YYYY-MM`, or a start date `YYYY-MM-DD` for a weekly, bi-weekly or N-day sprint), `sprintHistory`, `resolvedAt` and `statusLog` (every status change). Database hooks in `db.ts` stamp `resolvedAt` when a ticket reaches Done and clear it when reopened.
- **Sprint data:** goals, capacity, retrospectives, closed state and the spaces working in a sprint are in `lira_sprint_meta`; custom sprint dates in `lira_sprint_defs`; both land in `data/sprints.json`.
- **Writes** go to disk about half a second after a change; only changed files are rewritten and keys are sorted, so git diffs stay small. Each save is noted (file names only) in `data/private/audit.log`.
- **Backups** include all of the above except API keys.
