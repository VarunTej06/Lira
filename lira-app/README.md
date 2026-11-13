# Lira Web Application (`lira-app`)

> Core web application frontend for **Lira** — built with React 18, TypeScript, Tailwind CSS, `@hello-pangea/dnd`, Dexie IndexedDB, and Vite local PC disk synchronization middleware.

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | [React 18.3.1](https://react.dev/) | Component architecture & state management |
| **Language** | [TypeScript 7.x](https://www.typescriptlang.org/) | Strict static typing across domain models and components |
| **Bundler & Server** | [Vite 8.x](https://vitejs.dev/) | HMR development server (also hosts the disk-saving API) + ESM build |
| **Routing** | [React Router 7](https://reactrouter.com/) | A real URL for every page (`src/routes.ts`) |
| **Styling** | [Tailwind CSS 3.4](https://tailwindcss.com/) | Design tokens, dark mode (class strategy), responsive utilities |
| **Motion** | [Framer Motion](https://www.framer.com/motion/) | Dialog, menu, tab and number animations (`components/common/motion.tsx`, presets in `motionPresets.ts`) |
| **Icons / Fonts** | Lucide React, Inter (`@fontsource/inter`, served locally) | Iconography; no request to Google |
| **Local DB** | [Dexie.js 4.x](https://dexie.org/) | Reactive IndexedDB cache with `useLiveQuery` |
| **Local PC Storage** | JSON files under `../data/` | Source of truth for everything (tickets, projects, sprints, roadmaps, teams, standups, settings) |
| **Drag & Drop** | [@hello-pangea/dnd](https://github.com/hello-pangea/dnd) | Kanban board |
| **Dates / QR** | date-fns, qrcode | Due dates; the QR code for opening Lira on a phone |
| **Tests** | Vitest, jsdom, fake-indexeddb | 1602 tests in 139 files (`npm test`), plus a 15-check data health run (`npm run test:health`) |

---

## Getting Started

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload and the disk-saving API (this computer only) |
| `npm run dev:lan` | Same, and also opens Lira to your own Wi-Fi for a tablet or phone. The private link and QR code are in **Settings, Other devices** |
| `npm test` | Unit and integration tests |
| `npx tsc -b` | Type-check |
| `npm run build` | Type-check, then production build to `dist/` |
| `npm run lint` | Oxlint |

Run every command from `lira-app/`. See the root [SETUP.md](../SETUP.md) for the full guide, and [SECURITY_REPORT.md](../SECURITY_REPORT.md) for how the local API is protected.

---

## Local PC Disk Synchronization Engine

Everything you create is saved as JSON under `../data/` (the repo's `data/` folder), so clearing the browser loses nothing. The browser (IndexedDB and localStorage) is a fast cache.

```
data/
├── spaces.json, spaces/<KEY>.json   # Spaces and their tickets (one file per space)
├── lira-workspace.json              # Consolidated snapshot
├── projects.json                    # Projects
├── sprints.json                     # Sprint goals, capacity, retrospectives, custom sprints, sprint spaces
├── roadmaps/<id>.json, index.json   # One file per roadmap
├── teams.json, standups.json
├── board-config.json                # WIP limits, board settings, attachments, documents, forms
├── settings.json                    # Theme, profile, sidebar, Viva settings
└── private/                         # Git-ignored: secrets.json (API key), lan-token, audit.log
```

### How it Works:

1. **Startup Hydration** (`src/services/localDiskSync.ts`):
   When the app loads, `initLocalDiskSync()` sends a `GET /api/data` request to the Vite server plugin.
   The middleware loads tickets from each individual `data/spaces/<KEY>.json` file (falling back to `data/lira-workspace.json` if needed) and hydrates Dexie IndexedDB with zero cloud dependency.

2. **Debounced Auto-Save & Dual-Sync**:
   Any mutation (creating an issue, changing a status, dragging a card, adding a subtask, or creating a space) triggers `triggerDiskSync()`.
   This sends a debounced `POST /api/save` request to the Vite server plugin, which:
   - Partitions issues by `spaceId`
   - Atomically updates each individual space file (`data/spaces/<KEY>.json`)
   - Rebuilds and writes the spaces registry manifest (`data/spaces.json`)
   - Writes the full consolidated snapshot to `data/lira-workspace.json` for seamless backward compatibility.

3. **Backup & Restore (Export / Import)**:
   - **Exporting to Local**: Clicking **Export JSON Backup** creates a **single unified timestamped file** (`lira-backup-YYYY-MM-DD.json`) containing every space, ticket, project, sprint, roadmap, team and setting (not the API key) for easy archiving and portability, while ensuring disk files are simultaneously synced.
   - **Importing from Local**: Restoring a backup takes that **single JSON file**, imports all spaces and tickets into browser IndexedDB, and automatically syncs them out to the individual space files on your PC disk.

4. **REST API Endpoints (Vite Middleware Plugin, `vite.config.ts` + `server/`)**:
   - `GET /api/health`: Returns server health status and storage breakdown.
   - `GET /api/data`: Returns full workspace data aggregated across all space JSON files.
   - `GET /api/spaces`: Returns the manifest of spaces and metadata from `data/spaces.json`.
   - `POST /api/save`: Dual-writes tickets to the partitioned space files and the master snapshot.
   - `GET` / `POST /api/kv`: Reads and writes every other file (projects, sprints, roadmaps, teams, standups, settings). Only changed files are rewritten.
   - `GET /api/lan`: The tablet and phone link (only this computer may ask).
   - **Protection** (`server/guard.ts`): host and origin must be this computer (or, with `dev:lan`, your own network), writes must be JSON and under 50 MB, file names are sanitised, reserved keys are refused, security headers on every response, and each save is noted in `data/private/audit.log`.

5. **UI Status Indicator**:
   The top navigation displays ` PC Saved` or ` Saving to PC…` so you always know when your data has been committed to disk.

---

## Viva AI

The chat card in the bottom-right corner (`src/components/ai/VivaAIChatbot.tsx`, logic in `src/services/ai/`). See [`src/components/ai/README.md`](src/components/ai/README.md) for the details.

- Reads and writes across all spaces; **previews every change, waits for Confirm, and offers Undo**.
- Sprint-aware prompts (plan, summarise), a standup digest, a risk radar, and suggestions while creating a ticket.
- Model choice: built-in engine (default), Google Gemini, or any OpenAI-compatible server. Ticket text is treated as data, never as instructions.

---

## Source layout

```
server/
├── diskStore.ts / .test.ts        # Reads and writes the JSON files (only changed files, sorted keys)
├── guard.ts / .test.ts            # Who may call the API, security headers, audit log, tablet link secret
└── spaceStore.test.ts
src/
├── routes.ts                      # The one list of pages and their URLs
├── App.tsx, main.tsx
├── components/
│   ├── ai/                        # Viva AI chat card and avatar
│   ├── board/                     # Kanban board, summary, capacity, reports; actionbar/, modals/, forms/, capacity/ parts
│   ├── common/                    # Modal, Button, motion.tsx + motionPresets.ts (animations), dialogs (dialogStore.ts holds the calls), Confetti, PageBoundary / ErrorBoundary
│   ├── filter/ foryou/            # Filters page, For you
│   ├── issue/                     # Ticket popup (detail/), create form with suggestions
│   ├── layout/                    # TopNavigation (topnav/), LeftSidebar (sidebar/), settings/ (incl. Other devices)
│   ├── projects/ roadmap/         # Projects (detail/ tabs) and roadmaps
│   ├── sprints/                   # SprintsOverview, SprintsPage, SprintPlanning, SprintReports, CloseSprintModal, RetroCard, EpicTimeline, SprintFilter, CreateSprintModal
│   └── standup/ space/            # Standup and sprint calls, space dialogs
├── db/                            # Dexie database (stamps resolvedAt and a status log), seed data, backup
├── theme/palette.ts               # The fixed colours used as data (chart series, badges, avatars)
├── types/                         # Issue, Space, Project and the structured rows
├── hooks/                         # useIssues, useProjects, useRoadmaps, useIssuePopup, useSpacePrefs, useMediaQuery; useResetWhen and useLatest
├── services/
│   ├── ai/                        # Viva: intent, handlers, preview, undo, provider, suggest, sprintInsights
│   ├── kvMirror.ts                # Mirrors every lira_* browser setting to data/*.json
│   ├── localDiskSync.ts           # Tickets to and from disk
│   ├── structuredStore.ts         # Dexie copies of projects, sprints, teams, standups
│   └── roadmapEpics.ts            # Keeps roadmap items and their epics in step
└── utils/
    ├── sprintUtils.ts, sprintReports.ts   # Sprint dates (monthly and custom), stats, burndown, burnup, flow
    ├── roadmap/                           # Roadmap dates, timeline, progress, planner
    ├── theme.ts, safeUrl.ts, celebrate.ts
    ├── appStorage.ts, clock.ts, emptyLists.ts   # The one door to browser storage, the clock, a shared empty ticket list
    └── standupUtils.ts, dateUtils.ts, priorityUtils.ts
```
