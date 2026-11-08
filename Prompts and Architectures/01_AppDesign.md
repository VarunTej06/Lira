# 01 — App Design: System Prompts & Genesis Architecture

> **Updated November 2026.** This document was written earlier; the last section, "Update (November 2026)", lists what has changed since. The root [README](../README.md), [SETUP](../SETUP.md) and [ROADMAP](../ROADMAP.md) are always the most current.

> **Lira** is a 100% offline-first, browser-based personal project management tool
> in the style of an enterprise work-management product.  No cloud account, no API keys, no server.

---

## 1. Genesis Prompt (Master Specification)

Below is the full master prompt used to design and scaffold Lira.

```
# Enterprise Specification: Lira

You are an expert full-stack engineer and UI/UX designer.  Build Lira — a
production-ready, offline-first personal project management app tailored
for Day-to-Day (D2D) learning tracking, technical certification roadmaps, and
self-directed project management.

## Persistence
- Engine: Dexie.js (TypeScript wrapper for IndexedDB) with schema versioning.
- Durable storage: navigator.storage.persist() called on app init.
- Reactivity: useLiveQuery() for automatic UI re-renders on DB changes.
- Full JSON export/import backup engine.

## UI Tokens (Lira design tokens)
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
- Child work items table in the detail modal.
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
completely offline — on an aeroplane, in a lab without Wi-Fi, or when a
hosted service is down.

### 2.2 Design System
Lira has its own consistent visual language:
- **Spacing:** 4-point grid (Tailwind defaults).
- **Typography:** Inter (bundled with the app) in weights 300 to 900.
- **Colour tokens:** Tailwind extensions backed by CSS variables so they flip with
  the theme (see `tailwind.config.js` and `index.css`).
- **Component patterns:** Status badges, priority icons, avatar circles, and
  drag handles share one set of component patterns.

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
with live status changes, priority icons, and assignee avatars.

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

## Update (November 2026)

- **Still offline-first and single-user**, but no longer "browser only": the Vite dev server has a small API that saves everything as JSON files under `data/`. The browser (IndexedDB, localStorage) is a cache. Clearing it loses nothing.
- **Sprints are first-class.** Monthly sprints plus weekly, bi-weekly and N-day sprints, a choice of which spaces work in each sprint, planning, reports, retrospectives and a roadmap-style epic view.
- **Roadmaps** with one file each; every item is a real epic.
- **Viva AI** (renamed from Lira AI) previews, confirms and can undo its changes; it is sprint-aware and can use Gemini or any OpenAI-compatible model.
- **Reach:** `npm run dev:lan` opens Lira to your own Wi-Fi for a tablet or phone, behind a private link.
- **Multi-user** is deliberately not part of this branch. Single-user and multi-user will live on separate branches (ROADMAP Phase 7).
