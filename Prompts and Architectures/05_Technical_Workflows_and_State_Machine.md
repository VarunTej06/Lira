# 05 — Technical Workflows & State Machine

> **Updated November 2026.** This document was written earlier; the last section, "Update (November 2026)", lists what has changed since. The root [README](../README.md), [SETUP](../SETUP.md) and [ROADMAP](../ROADMAP.md) are always the most current.

## 1. Kanban Drag-and-Drop Lifecycle

```
User grabs card ──► onDragStart
                     │ Capture: draggableId (issue.id), source.droppableId (column)
                     │
                     ▼
                 Card follows cursor (CSS transform — no layout shift)
                     │
                     ▼
User drops card ──► onDragEnd (DropResult)
                     │
              ┌──────▼──────┐
              │ Same column?│
              │Same position│
              └──────┬──────┘
                 YES │                      NO
                     │                      │
              ────────────────    ───────────────────────
              │   No-op, return│  │ 1. Compute new rank   │
              ────────────────    │    (avg of neighbours)│
                                  │ 2. Optimistic update  │
                                  │    (in-memory Map)    │
                                  │ 3. Re-render board    │
                                  │    INSTANTLY          │
                                  │ 4. await moveIssue()  │
                                  │    (IndexedDB write)  │
                                  │ 5. Remove optimistic  │
                                  │    override           │
                                  │ 6. useLiveQuery fires │
                                  │    → UI confirms      │
                                  ─────────────────────────
```

### Rank Calculation

Cards within a column are sorted by their `rank` field (a float).  When a card
is moved to position `i` in column `col`:

```typescript
let newRank: number;
if (destColumn.length === 0) {
  newRank = 1000;
} else if (destination.index === 0) {
  newRank = destColumn[0].rank - 100;         // before first
} else if (destination.index >= destColumn.length) {
  newRank = destColumn.at(-1)!.rank + 100;    // after last
} else {
  const before = destColumn[destination.index - 1].rank;
  const after  = destColumn[destination.index].rank;
  newRank = Math.floor((before + after) / 2); // between two cards
}
```

This is the same fractional indexing approach used by many collaborative tools.
Ranks never need global rebalancing unless they collide after ~50 moves to the
same gap (extremely rare in practice).

---

## 2. Issue Status State Machine

```
                ┌──────────┐
           ┌───►│  Backlog │◄────────────────────┐
           │    └────┬─────┘                     │
           │         │ move/drag                  │
           │         ▼                            │
           │    ┌──────────┐                      │
           ├───►│  To Do   │◄──────────────┐      │
           │    └────┬─────┘               │      │
           │         │                     │      │
           │         ▼                     │      │
           │    ┌─────────────┐            │      │
           ├───►│ In Progress │◄───────┐   │      │
           │    └────┬────────┘        │   │      │
           │         │                 │   │      │
           │         ▼                 │   │      │
           │    ┌──────────┐           │   │      │
           └───►│   Done   │───────────┘───┘──────┘
                └──────────┘
                (resolvedAt set)
```

All transitions are allowed in both directions — there is no enforced one-way
flow.  Users can drag Done cards back to In Progress if work resumes.

When status changes to `done`, `resolvedAt` is automatically set to `new Date()`.

---

## 3. Issue Hierarchy State Machine

```
EPIC (type: 'epic')
  ├── Stories can be created inside (parentId = epic.id)
  ├── Status of Epic is manually managed
  └── Epic's child progress bar = doneTasks / totalTasks

TASK (type: 'task', parentId = epic.id)
  ├── Subtasks: embedded Subtask[] array (checklist style)
  ├── Child Issues: full Issue rows (parentId = task.id, type='subtask')
  └── Task progress = completedSubtasks / totalSubtasks

SUBTASK (type: 'subtask', parentId = task.id)
  └── Leaf node — no children
```

Creating a child issue:
```typescript
await createIssue({
  spaceId: parent.spaceId,
  key: await getNextIssueKey(space.key),  // CERT-9
  parentId: parent.id,
  epicId: parent.type === 'epic' ? parent.id : parent.epicId,
  type: childType,  // epic→task, task→subtask
  status: 'todo',
  rank: Date.now(),
  // ... other fields
});
```

---

## 4. Subtask Completion & Progress

When a subtask checkbox is toggled in `IssueSubtasks`, the updated array is
immediately persisted and the progress bar re-computes:

```typescript
const completed  = subtasks.filter(s => s.completed).length;
const total      = subtasks.length;
const progress   = total > 0 ? (completed / total) * 100 : 0;
```

The progress bar colour transitions:
- **0–99%** → Brand blue `#0052CC`
- **100%** → Done Green `#36B37E`

---

## 5. Auto-Save Workflow

```
User types in description textarea
        │
        │ (every keystroke)
        ▼
   setDescVal(newValue)   ← local React state, instant UI update
        │
        │ (800ms of silence)
        ▼
   useDebounce fires
        │
        ▼
   updateIssue(id, { description: newValue })
        │
        ▼
   IndexedDB row updated
        │
        ▼
   "Auto-saving…" indicator disappears
```

The title uses a similar but event-driven approach (saves on `onBlur` or
`Enter` key press rather than debounce).

---

## 6. Audit Logging (Activity History)

Every significant action appends an `ActivityEntry` to the issue's `activity`
array:

```typescript
interface ActivityEntry {
  id: string;               // uuid
  type: 'created' | 'status_change' | 'field_change' | 'comment' | 'attachment';
  author: string;
  authorInitials: string;
  description: string;      // "changed status"
  oldValue?: string;        // "To Do"
  newValue?: string;        // "In Progress"
  createdAt: Date;
}
```

Activity entries are displayed in the `IssueActivityFeed` in reverse
chronological order.  Comments and history are stored in the same feed, filtered
by the active tab (All / Comments / History).

---

## 7. Space Context Menu Actions

| Action | Implementation |
|--------|---------------|
| Add to starred | Local `Set<number>` state in LeftSidebar — persisted to `localStorage` |
| Space settings | Opens `CreateSpaceModal` pre-filled with current space values |
| Set background | Future — would apply a CSS `background-image` to the board area |
| Add people | Future — would open a team management dialog |
| Archive space | Future — would add `archived: true` flag, hide from sidebar |
| Delete space | `deleteSpace(id)` → deletes space row + all child issues recursively |

---

## 8. Dynamic Work Item Type Conversion & Hierarchy Rules

Lira supports dynamic upgrading or downgrading of any ticket's type (`Epic`, `Task`, `Bug`, `Subtask`):

```
                     ┌───────────────┐
                     │   Epic       │
                     └───────┬───────┘
                             │ (contains)
               ┌─────────────┴─────────────┐
               ▼                           ▼
        ┌──────────────┐            ┌──────────────┐
        │  Task       │            │   Bug       │
        └──────┬───────┘            └──────────────┘
               │ (contains)
               ▼
        ┌──────────────┐
        │ Subtask (↳)  │
        └──────────────┘
```

### Transition State Machine:
* **Promoting Task/Bug to Epic**: Clears `parentId`, `epicLink`, and `epicId` since Epics are top-level roots.
* **Converting to Subtask**: Requires a parent Task/Bug. Detaches any nested subtask children to prevent circular hierarchy.
* **Audit Logging**: Every type conversion appends a `'field_change'` activity entry:
  `{ description: 'changed type', oldValue: 'task', newValue: 'epic' }`.

---

## 9. AI Copilot Autonomous Execution Workflow

```
User Prompt (e.g. "Move AP-10 to in progress")
         │
         ▼
`aiAgentService.processUserMessage()`
         │
         ├── 1. `db.issues.toArray()` (100% live scan across all spaces)
         ├── 2. `findTargetSpace()` (resolves Atmos / AP dynamically)
         ├── 3. Regex Intent Match: `\b([a-z]{2,10}-\d+)\b` → AP-10
         │                          `move.*to\s+(in progress|done|todo)`
         ▼
Execute Action Hook:
  await updateIssue(targetIssue.id, {
    status: 'inprogress',
    updatedAt: new Date()
  });
         │
         ▼
Persist: Trigger debounced `POST /api/save` → `data/lira-workspace.json`
         │
         ▼
Return ChatMessage with formatted Markdown confirmation and suggested next actions.
```

## Update (November 2026)

**A ticket reaches Done** (board, popup, bulk, Viva): the database hook sets `resolvedAt`, appends to `statusLog`, and fires a celebration (confetti). Reopening clears `resolvedAt`.

**Closing a sprint:** Close dialog, choose where unfinished tickets go (default: the next sprint), optionally write the retrospective (went well, didn't, actions), then `completeSprint` moves the unfinished tickets (recording `sprintHistory` and an activity entry on each), marks the sprint closed and celebrates. An ended sprint with unfinished tickets shows a "Carry them over?" prompt on its page and on the overview.

**Planning a sprint:** Planning view; dragging a ticket across calls `moveIssuesToSprint`. Points are summed against the capacity (typed in, or the average of the last closed sprints). Over capacity shows a warning. Only spaces that work in the sprint offer their tickets.

**Viva changes (preview, confirm, undo):**
1. `processUserMessage(..., { confirmWrites: true })` recognises a write and returns a preview (`buildPreview`) with `pending`.
2. **Confirm** runs `confirmAndRun`, which snapshots all tickets, runs the normal handler, and stores the differences as an undo record (the last 20, in memory).
3. **Undo** puts changed tickets back and removes created ones, without the Done and status-log bookkeeping (`restoringIssuesExactly`).

**Roadmap items** stay in step with their epic and checklist task (`services/roadmapEpics.ts`).
