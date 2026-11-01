# 01 — App Design: System Prompts & Genesis Architecture

> **Lira (Learner's Jira)** is a 100% offline-first, browser-based personal project management tool
> modelled exactly on Atlassian Jira Work Management.  No cloud account, no API keys, no server.

---

## 1. Genesis Prompt (Master Specification)

Below is the full master prompt used to design and scaffold Lira.

```
# Enterprise Specification: Lira (Learner's Jira)

You are an expert full-stack engineer and UI/UX designer.  Build Lira — a
production-ready, pixel-accurate, offline-first personal Jira clone tailored
for Day-to-Day (D2D) learning tracking, technical certification roadmaps, and
self-directed project management.

## Persistence
- Engine: Dexie.js (TypeScript wrapper for IndexedDB) with schema versioning.
- Durable storage: navigator.storage.persist() called on app init.
- Reactivity: useLiveQuery() for automatic UI re-renders on DB changes.
- Full JSON export/import backup engine.

## UI Tokens (Atlassian Design System)
| Token              | Value     |
|--------------------|-----------|
| Page background    | #F4F5F7   |
| Card surface       | #FFFFFF   |
| Borders            | #DFE1E6   |
| High-contrast text | #172B4D   |
| Muted labels       | #6B778C   |
| Primary action     | #0052CC   |
| In Progress accent | #FFAB00   |
| Done accent        | #36B37E   |
| Top nav            | #1D2125   |
| Left sidebar       | #1A2332   |

## Issue Hierarchy
Epic → Task → Subtask
- All stored as Issue rows; linked via parentId field.
- Child work items table in detail modal (like Jira).
- Status, priority, assignee visible on each child row.

## Core Features
- Multiple spaces with custom key prefixes (CERT-, ATMOS-, CRS-).
- Kanban board with drag-and-drop (@hello-pangea/dnd).
- Issue detail modal: two-column layout, inline editing, auto-save.
- Space context menus: Star, Settings, Background, Archive, Delete.
- Card hover actions: Open, Set Status, Delete.
- Seed data: realistic MLOps/DevOps certification roadmap tickets.

## Tech Stack
React 18 + TypeScript + Vite + Tailwind CSS (v3) + Dexie.js +
@hello-pangea/dnd + lucide-react + date-fns + uuid
```

---

## 2. Core Design Principles

### 2.1 Zero-Cloud Dependency
Every byte of data lives in the browser's IndexedDB on the user's own machine.
There is no authentication server, no REST API, no WebSocket.  Lira works
completely offline — on an aeroplane, in a lab without Wi-Fi, or after Atlassian
goes down.

### 2.2 Atlassian Design System Alignment
Lira replicates the exact Jira Work Management visual language:
- **Spacing:** 4-point grid (Tailwind defaults).
- **Typography:** Inter (Google Fonts) — same weight distribution as Jira's
  "Atlassian Sans".
- **Colour tokens:** Hard-coded Tailwind extensions matching Jira's CSS custom
  properties (see `tailwind.config.js`).
- **Component patterns:** Status badges, priority icons, avatar circles, and
  drag handles are pixel-matched to Jira's component library.

### 2.3 High Resilience
| Risk | Mitigation |
|------|-----------|
| Browser closes mid-edit | Debounced auto-save (800 ms) commits every keystroke window |
| Cache eviction | `navigator.storage.persist()` marks the origin as durable |
| OS reinstall / laptop change | One-click JSON export → import on new device |
| Component crash | `ErrorBoundary` wraps every modal so the board never blanks |
| Schema migration | Dexie versioned upgrades — old data is automatically migrated |

---

## 3. High-Level System Topology

```
┌──────────────────────────────────────────────────────────┐
│                     BROWSER (Single Origin)              │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │          React 18 Component Tree                 │   │
│  │                                                  │   │
│  │  TopNavigation   LeftSidebar   KanbanBoard       │   │
│  │       │               │            │             │   │
│  │       └───────────────┴────────────┘             │   │
│  │                       │                          │   │
│  │              App (state orchestrator)            │   │
│  │                       │                          │   │
│  │        ┌──────────────┴──────────────┐           │   │
│  │        │      Dexie.js Hooks         │           │   │
│  │        │  useLiveQuery (reactive)    │           │   │
│  │        │  useIssuesBySpace           │           │   │
│  │        │  useChildIssues             │           │   │
│  │        │  useSpaces                  │           │   │
│  │        └──────────────┬──────────────┘           │   │
│  │                       │ async transactions        │   │
│  └───────────────────────┼──────────────────────────┘   │
│                          │                               │
│  ┌───────────────────────▼──────────────────────────┐   │
│  │           IndexedDB (LiraDB)                     │   │
│  │                                                  │   │
│  │  Table: spaces  ─────────────────────────────    │   │
│  │  Table: issues   (parentId, epicId indexes)      │   │
│  │  Table: columns                                  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  storageService.ts                               │   │
│  │  exportBackup() → JSON file download             │   │
│  │  importBackup() → bulk Dexie re-insert           │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Issue Hierarchy Model

```
Epic (type: 'epic')
 └── Task  (type: 'task',  parentId = epic.id)
      ├── Subtask A (type: 'subtask' OR embedded Subtask object)
      └── Subtask B
```

All levels are stored as rows in the **issues** table.  The `parentId`
field creates the tree structure.  The `epicId` field caches the root Epic ID
for fast "show all issues in this epic" queries.

Child work items appear as an interactive table inside each issue's detail modal
with live status changes, priority icons, and assignee avatars — matching the
Jira "Child work items" section exactly.

---

## 5. AI Copilot & Omnipresent Agent Model

```
Floating Trigger (bottom-5 right-5) 
  └── LiraAIAvatar SVG (Gentle float & glow pulse)
        └── Toggles Floating Dialogue Card (bottom-20 right-5, rounded-3xl)
              ├── Header: Avatar + Status + Maximize/Minimize + Settings + Close
              ├── Body: Cross-Space Intent Parser / Gemini 1.5 Flash Cloud LLM
              └── Action Runner: Autonomous creation, status transitions, domain subtasks
```

The AI subsystem operates as an omnipresent assistant across all spaces without obstructing the Kanban board. It supports compact (`w-[440px]`) and expanded (`w-[680px]`) modes, natural language ticket lookup, and domain-specific engineering task breakdowns. For full details, see [09_AI_Agent_and_Copilot_Architecture.md](./09_AI_Agent_and_Copilot_Architecture.md).

