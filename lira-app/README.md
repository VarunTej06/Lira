# 🚀 Lira Web Application (`lira-app`)

> Core web application frontend for **Lira** — built with React 18, TypeScript, Tailwind CSS, `@hello-pangea/dnd`, Dexie IndexedDB, and Vite local PC disk synchronization middleware.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | [React 18.3.1](https://react.dev/) | Component architecture & state management |
| **Language** | [TypeScript 5.x](https://www.typescriptlang.org/) | Strict static typing across domain models and components |
| **Bundler & Server** | [Vite 6.x](https://vitejs.dev/) | Instant HMR development server + native ESM build |
| **Styling** | [Tailwind CSS 3.4](https://tailwindcss.com/) | Jira design system tokens, typography, and responsive utilities |
| **Icons** | [Lucide React](https://lucide.dev/) | Enterprise iconography |
| **Local In-Memory DB** | [Dexie.js 4.x](https://dexie.org/) | Reactive IndexedDB wrapper with `useLiveQuery` |
| **Local PC Storage** | Space-Segregated JSON + Vite | Partitioned `data/spaces/<KEY>.json` + manifest + dual-sync |
| **Drag & Drop** | [@hello-pangea/dnd](https://github.com/hello-pangea/dnd) | Accessible multi-column Kanban board |
| **Date Utilities** | [date-fns 4.x](https://date-fns.org/) | Due dates, overdue calculations, relative timestamps |

---

## 📦 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
The server will start at `http://localhost:5173`.

### 3. Verify TypeScript Types
```bash
npx tsc -p tsconfig.app.json --noEmit
```

### 4. Build Production Bundle
```bash
npm run build
```

---

## 🔄 Local PC Disk Synchronization Engine

Lira persists all spaces, epics, tasks, subtasks, activities, and rankings directly to your local PC storage using a **sharded, space-segregated architecture**:

```
d:\MLOps_LLMOps\Lira\data\
├── spaces.json                  # Manifest registry of all active spaces
├── spaces/                      # Sharded individual space databases
│   ├── AI.json                  # AI Projects space data & issues
│   ├── AP.json                  # Awesome Portfolio space data & issues
│   ├── CERT.json                # Certifications space data & issues
│   ├── CH.json                  # Creator Hub space data & issues
│   ├── COUR.json                # Courses space data & issues
│   ├── GT.json                  # General Tasks space data & issues
│   ├── IG.json                  # Interview Guide space data & issues
│   ├── LIRA.json                # Lira Internal space data & issues
│   └── TS.json                  # Test Space data & issues
└── lira-workspace.json          # Dual-synced consolidated master backup snapshot
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
   - **Exporting to Local**: Clicking **Export JSON Backup** creates a **single unified timestamped file** (`lira-backup-YYYY-MM-DD.json`) containing all 9 spaces and 115+ issues for easy archiving and portability, while ensuring disk files are simultaneously synced.
   - **Importing from Local**: Restoring a backup takes that **single JSON file**, imports all spaces and tickets into browser IndexedDB, and automatically syncs them out to the individual space files on your PC disk.

4. **REST API Endpoints (Vite Middleware Plugin)**:
   - `GET /api/health`: Returns server health status and storage breakdown.
   - `GET /api/data`: Returns full workspace data aggregated across all space JSON files.
   - `GET /api/spaces`: Returns the manifest of spaces and metadata from `data/spaces.json`.
   - `POST /api/save`: Dual-writes payload to both partitioned space files and the master snapshot.

5. **UI Status Indicator**:
   The top navigation displays `🟢 PC Saved` or `💾 Saving to PC…` so you always know when your data has been committed to disk.

---

## 🤖 Lira AI Copilot & Autonomous Agent

Lira includes an integrated, omnipresent conversational assistant (`src/components/ai/LiraAICopilot.tsx`, `src/components/ai/LiraAIAvatar.tsx`, & `src/services/aiAgentService.ts`):
- **Animated Floating Avatar**: Docked in bottom-right corner (`bottom-5 right-5`) with subtle floating and glowing breath animations (`animate-float-subtle`, `animate-pulse-glow`) and live DB connection pulse.
- **Non-Blocking Curved Dialogue Box**: Detached floating card with curved edges on all 4 sides (`rounded-3xl`), keeping the Kanban board visible.
- **Dual View Modes**: One-click Maximize/Minimize toggle between compact card (`w-[440px]`) and spacious view (`w-[680px]`).
- **Cross-Space Omnipresence**: Live read/write visibility across all present and future spaces in the workspace (queries, status updates, creation).
- **Configurable System Instructions**: Governed by customizable directives in the Settings tab, with optional Google Gemini 1.5 Flash cloud API key support and zero-latency local fallback.
- **Autonomous Task Breakdown**: Generates domain-specific checklist subtasks (Docker, Kubernetes, CI/CD, Certifications) directly into tickets.
- **Zero Cloud Leakage**: Runs 100% locally in your browser/PC environment by default.

---

## 🧩 Key Component Modules

```
src/
├── components/
│   ├── ai/
│   │   ├── LiraAIAvatar.tsx          # Enhanced Lira AI SVG brand avatar component
│   │   ├── LiraAICopilot.tsx         # Floating dialogue card, animated trigger & settings
│   │   └── README.md                 # AI component module documentation
│   ├── board/
│   │   ├── KanbanBoard.tsx           # Board container with edge auto-scroll & pan handlers
│   │   ├── BoardColumn.tsx           # Full-height droppable column lane with Atlassian styling
│   │   └── IssueCard.tsx             # Draggable placard with floating portal dropdown for parent issues
│   ├── common/
│   │   └── ConfirmDeleteModal.tsx    # Jira-style delete confirmation modal with child issue cascade warning
│   ├── issue/
│   │   ├── IssueDetailModal.tsx      # Comprehensive issue editor with markdown, activity & subtasks
│   │   └── CreateIssueModal.tsx      # 3-tier issue creator modal (Epic/Task/Bug)
│   ├── layout/
│   │   ├── TopNavigation.tsx         # Navbar with brand logo, PC sync badge, search & AI button
│   │   ├── LeftSidebar.tsx           # Space switcher, starred spaces, and space creation
│   │   └── BoardActionBar.tsx        # Search input, assignee filter (VY), and views tabs
│   └── space/
│       ├── CreateSpaceModal.tsx      # Space wizard with color & emoji picker
│       └── SpaceSettingsModal.tsx    # Space metadata editing & deletion
├── db/
│   ├── db.ts                         # Dexie database declaration (spaces & issues tables)
│   ├── seedData.ts                   # Initial seed dataset with 6 spaces
│   └── storageService.ts             # Export/Import JSON backup routines with disk sync
├── hooks/
│   ├── useIssues.ts                  # Reactive useLiveQuery hooks for issues (CRUD + moveIssue)
│   └── useSpaces.ts                  # Reactive useLiveQuery hooks for spaces
└── services/
    ├── localDiskSync.ts              # Disk file sync subscriber and REST client
    └── aiAgentService.ts             # Natural language agent parser and intent executor
```
