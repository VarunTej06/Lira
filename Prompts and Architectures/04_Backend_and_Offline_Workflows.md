# 04 — Backend & Offline Workflows

> **Updated November 2026.** This document was written earlier; the last section, "Update (November 2026)", lists what has changed since. The root [README](../README.md), [SETUP](../SETUP.md) and [ROADMAP](../ROADMAP.md) are always the most current.

## 1. Thin-Server, Offline-First Architecture

Lira's screens are a static **Single-Page App (SPA)** that runs in the browser. Because the browser cannot write files, one small local server (a Vite dev-server plugin, see the Update section at the end) saves the data as JSON files under `data/`. Here is how each "backend" concern is handled today:

| Traditional Backend Concern | How Lira handles it today |
|-----------------------------|---------------------------|
| REST API endpoints | Screens read and write through Dexie (`db.issues.add()`, `.update()`, `.where()`). A few local `/api/*` routes persist that data to disk (section "Update") |
| Authentication / sessions | None. Fixed user "VY". This changes with multi-user and SSO (see PUBLIC_EDITION_PLAN.md) |
| Database server | JSON files under `data/` are the source of truth; IndexedDB is a cache |
| File uploads | FileReader API → base64, kept with the ticket (50 MB limit per save) |
| Email notifications | Not built. Calendar invites are `.ics` downloads |
| Real-time sync | Dexie `useLiveQuery` updates every open screen in one browser. There is no sync between users yet |
| Server-side search | Client-side filter on in-memory arrays |
| Schema migrations | Dexie versioned `.upgrade()` functions (3 versions today) |

> **Analogy:** Think of Lira as a spreadsheet application (like Excel) with an autosave file next to it. All computation happens in the browser; the small server only saves and loads files.

---

## 2. Reactive Data Engine (`useLiveQuery`)

The magic of Dexie's React integration is that **any component subscribed to a
live query automatically re-renders when the underlying data changes** — with no
manual `setState`, no polling, no WebSockets.

```typescript
// hooks/useIssues.ts
export function useIssuesBySpace(spaceId: number | undefined) {
  return useLiveQuery(
    () => spaceId
      ? db.issues.where('spaceId').equals(spaceId).sortBy('rank')
      : Promise.resolve([]),
    [spaceId],    // dependency array — re-subscribes if spaceId changes
    []            // initial value before first read completes
  );
}
```

**How it works internally:**
1. Dexie registers an IndexedDB observer for the query.
2. When any `issues` row matching the query is inserted/updated/deleted,
   IndexedDB fires a `versionchange` event.
3. Dexie catches this and re-runs the query.
4. React re-renders the subscribed component with fresh data.

This means when you drag a card from "To Do" to "In Progress":
- The `moveIssue()` call updates the IndexedDB row.
- `useLiveQuery` detects the change.
- All board columns (which are subscribed) re-render instantly.

---

## 3. Export & Import Engine (`src/db/storageService.ts`)

### Export
```typescript
export async function exportBackup(): Promise<void> {
  const spaces = await db.spaces.toArray();
  const issues = await db.issues.toArray();

  const backup = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    spaces,
    issues,
  };

  // Create a Blob and trigger a browser download
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lira-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Import
```typescript
export async function importBackup(file: File): Promise<{ spaces: number; issues: number }> {
  const text = await file.text();
  const backup = JSON.parse(text);           // validate structure

  // Clear all existing data
  await db.spaces.clear();
  await db.issues.clear();

  // Deserialise Date strings back to Date objects
  const spacesWithDates = backup.spaces.map(s => ({
    ...s,
    createdAt: new Date(s.createdAt),
    updatedAt: new Date(s.updatedAt),
  }));

  const issuesWithDates = backup.issues.map(i => ({
    ...i,
    createdAt:   new Date(i.createdAt),
    updatedAt:   new Date(i.updatedAt),
    dueDate:     i.dueDate     ? new Date(i.dueDate)     : undefined,
    startDate:   i.startDate   ? new Date(i.startDate)   : undefined,
    resolvedAt:  i.resolvedAt  ? new Date(i.resolvedAt)  : undefined,
  }));

  await db.spaces.bulkAdd(spacesWithDates);
  await db.issues.bulkAdd(issuesWithDates);

  return { spaces: backup.spaces.length, issues: backup.issues.length };
}
```

### JSON Snapshot Format
```json
{
  "version": "1.0.0",
  "exportedAt": "2026-10-28T06:00:00.000Z",
  "spaces": [
    { "id": 3, "name": "Certifications", "key": "CERT", "icon": "", "color": "#0052CC" }
  ],
  "issues": [
    {
      "id": 1, "spaceId": 3, "key": "CERT-1",
      "title": "HashiCorp Certified: Terraform Associate",
      "status": "done", "priority": "highest",
      "subtasks": [...], "comments": [...], "activity": [...]
    }
  ]
}
```

---

## 4. Offline Capability Guarantee

| Scenario | Result |
|----------|--------|
| WiFi turns off mid-session | App continues working 100% — no network calls |
| Browser restarted | Data reloads from IndexedDB instantly |
| Laptop rebooted | Data persists — IndexedDB is on disk, not in RAM |
| OS reinstalled | Data lost — restore from JSON backup |
| Different browser | Data not available — IndexedDB is origin-scoped |
| Incognito / private mode | Data persists only for the session |

---

## 5. Seed Data System

On first launch, `seedDatabase()` is called.  It checks if any spaces exist —
if not, it inserts 5 spaces and ~15 pre-seeded issues covering:

- **CERT-1 through CERT-8**: HashiCorp Terraform, AWS SAA-C03, KCNA, CKA,
  GitHub Actions, GCP Data Engineer, Docker DCA, LFCS — complete with
  subtasks, comments, time estimates, and activity history.
- **CRS-1**: MLOps Specialization (DeepLearning.AI / Coursera).
- **ATMOS-1 through ATMOS-3**: Weather App dev tickets.
- **GEN-1**: Proxmox homelab setup.

This seed data runs only once (guarded by `if (count > 0) return`).

## Update (November 2026)

- **There is a small server**, the Vite dev-server plugin (`vite.config.ts`, `server/`). Endpoints: `GET /api/health`, `GET /api/data`, `POST /api/save` (tickets), `GET/POST /api/kv` (everything else), `GET /api/spaces`, `GET /api/lan` (this computer only).
- **Guard (`server/guard.ts`):** the host and origin must be this computer; writes must be JSON, at most 50 MB; reserved keys (`__proto__`...) and unusual file names are refused; every response carries security headers (CSP, no framing, no sniffing).
- **Tablet and phone mode (`npm run dev:lan`):** also accepts addresses from your own network (never web names). Devices other than this computer must arrive once with the private link (`?key=`), receive an HttpOnly cookie, and never receive or change the API key.
- **Still no cloud and no accounts.** The dev server is the only server; `npm run preview` or a built copy cannot save to disk.
- See [SECURITY_REPORT.md](../SECURITY_REPORT.md).
