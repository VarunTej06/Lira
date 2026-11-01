# 02 — Frontend Architecture

## 1. Tech Stack Overview

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | React | 18.3 | Component tree, hooks, concurrent rendering |
| Language | TypeScript | 5.x | Static types, IDE intelligence |
| Build tool | Vite | 8.x | Sub-second HMR, ESM-native dev server |
| Styling | Tailwind CSS | 3.x | Utility-first CSS with custom Atlassian tokens |
| Icons | lucide-react | latest | 1000+ consistent SVG icons |
| Drag & Drop | @hello-pangea/dnd | 18.x | Beautiful, accessible Kanban DnD |
| Database | Dexie.js | 4.x | Type-safe IndexedDB wrapper |
| Dates | date-fns | 3.x | Immutable date formatters |
| IDs | uuid | 9.x | RFC 4122 v4 unique identifiers |

---

## 2. Component Hierarchy

```
App.tsx  (root state orchestrator)
├── ErrorBoundary              (crash isolation)
├── TopNavigation              (dark #1D2125 nav bar)
│   ├── AppSwitcher icon
│   ├── GlobalSearch input
│   ├── + Create button
│   ├── BackupRestoreModal     (JSON export/import)
│   └── UserAvatar (VY)
│
├── LeftSidebar               (dark #1A2332 sidebar)
│   ├── SpaceRow × N          (with MoreHorizontal context menu)
│   │   └── SpaceContextMenu  (Star, Settings, Archive, Delete …)
│   └── UtilityNav            (Filters, Dashboards, Teams, Goals)
│
├── BoardActionBar            (white header below sidebar)
│   ├── SpaceHeader           (icon + name + description)
│   ├── SubViewTabs           (Board, List, Calendar …)
│   └── FilterBar             (search input + assignee toggle + Filter/Group)
│
├── KanbanBoard               (DragDropContext)
│   └── BoardColumn × 4       (Droppable: backlog/todo/inprogress/done)
│       ├── IssueCard × N     (Draggable + hover actions menu)
│       └── AddIssueButton
│
├── LiraAICopilot             (floating dialogue card + animated avatar trigger)
│   ├── LiraAIAvatar          (enhanced SVG avatar with Lira bold "L" & AI constellation)
│   ├── FloatingTriggerButton (bottom-5 right-5, float & pulse keyframe animations)
│   └── FloatingDialogueBox   (rounded-3xl, compact/expand mode, settings view, markdown tables)
│
└── IssueDetailModal          (fixed overlay, two-column)
    ├── StatusBanner          (1.5px colour strip at top)
    ├── BreadcrumbHeader      (parent key → current key + type badge)
    ├── QuickActionBar        (+ Child issue, Link issue, Attach)
    ├── Title                 (inline editable h1)
    │
    ├── LEFT PANEL (scrollable)
    │   ├── Description       (textarea, 800ms debounce auto-save)
    │   ├── IssueAttachments  (drag-drop file upload + preview grid)
    │   ├── ChildIssues       (Epic→Tasks table)
    │   ├── IssueSubtasks     (checklist with progress bar)
    │   └── IssueActivityFeed (comments + history + quick chips)
    │
    └── RIGHT PANEL (w-72 sidebar)
        ├── StatusDropdown    (coloured pill button)
        ├── AutomationsButton
        └── DetailRows
            ├── Assignee
            ├── Due date      (native date input)
            ├── Priority      (SelectDropdown)
            ├── Labels        (multi-tag + inline adder)
            ├── Time tracking (progress bar)
            ├── Start date
            ├── Category
            ├── Reporter
            └── MetadataCard  (Created, Updated, Resolved timestamps)
```

---

## 3. Design Token Mapping

All tokens are defined in `tailwind.config.js` under `theme.extend.colors`:

```js
'jira-bg':          '#F4F5F7',  // Page background
'jira-surface':     '#FFFFFF',  // Card & modal surfaces
'jira-border':      '#DFE1E6',  // Subtle borders
'jira-text':        '#172B4D',  // High-contrast body text
'jira-muted':       '#6B778C',  // Labels, captions, placeholders
'jira-blue':        '#0052CC',  // Primary action / links
'jira-blue-light':  '#DEEBFF',  // In-Progress status bg
'jira-blue-hover':  '#0065FF',  // Button hover
'jira-amber':       '#FFAB00',  // In Progress accent strip
'jira-amber-light': '#FFF7D6',  // In Progress status bg (light)
'jira-green':       '#36B37E',  // Done accent strip
'jira-green-light': '#E3FCEF',  // Done status bg
'jira-red':         '#DE350B',  // Bug / danger
'jira-purple':      '#6554C0',  // Epic type colour
'nav-bg':           '#1D2125',  // Top navigation bar
'nav-sidebar':      '#1A2332',  // Left sidebar
'nav-sidebar-active':'#0052CC', // Active space indicator
```

### Status Colour Matrix

| Status | Badge text | Badge bg | Accent strip |
|--------|-----------|---------|-------------|
| Backlog | `#6B778C` | `#F4F5F7` | none |
| To Do | `#172B4D` | `#DFE1E6` | none |
| In Progress | `#0052CC` | `#DEEBFF` | `#FFAB00` |
| Done | `#006644` | `#E3FCEF` | `#36B37E` |

### Issue Type Colour Matrix

| Type | Symbol | Colour | Background |
|------|--------|--------|-----------|
| Epic | ⚡ | `#6554C0` | `#EAE6FF` |
| Task | ✅ | `#0052CC` | `#DEEBFF` |
| Bug | 🐛 | `#DE350B` | `#FFEBE6` |
| Subtask | ↳ | `#6B778C` | `#F4F5F7` |

---

## 4. Form & Input Optimisations

### Auto-Save (Debounced)
The description textarea in `IssueDetailModal` uses `useDebounce(value, 800)`:

```typescript
// hooks/useDebounce.ts
export function useDebounce<T>(value: T, delay = 500): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
```

```typescript
// In IssueDetailModal
const debouncedDesc = useDebounce(descVal, 800);

useEffect(() => {
  if (!local?.id || debouncedDesc === local.description) return;
  updateIssue(local.id, { description: debouncedDesc }); // writes to IndexedDB
  setLocal(prev => prev ? { ...prev, description: debouncedDesc } : prev);
}, [debouncedDesc]);
```

### Optimistic UI for Drag-and-Drop
When a card is dragged to a new column, `KanbanBoard` immediately applies an
in-memory override (`optimisticUpdates` map) so the card visually moves before
the IndexedDB write completes.  If the write fails, the override is removed and
the card snaps back.

```typescript
const handleDragEnd = async (result: DropResult) => {
  setOptimisticUpdates(prev => ({ ...prev, [issueId]: newStatus })); // instant UI
  try {
    await moveIssue(issueId, newStatus, newRank);              // DB write
  } finally {
    setOptimisticUpdates(prev => { delete prev[issueId]; return {...prev}; });
  }
};
```

---

## 5. Navigation Stack (Epic → Task drill-down)

Instead of a single `selectedIssue` state, `App.tsx` maintains an **array
stack**.  Clicking a child issue pushes onto the stack; the breadcrumb shows the
parent key and is clickable to pop back.

```typescript
const [issueNavStack, setIssueNavStack] = useState<Issue[]>([]);

const navigateToIssue = (issue: Issue) =>
  setIssueNavStack(prev => [...prev, issue]);

const closeModal = () => setIssueNavStack([]);

// Modal receives:
<IssueDetailModal
  issue={issueNavStack.at(-1)}
  parentIssue={issueNavStack.at(-2)}
  onNavigateToIssue={navigateToIssue}
  onClose={closeModal}
/>
```
