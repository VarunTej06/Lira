# 🎯 Lira — Enterprise Offline-First Kanban & Engineering Workspace

> **Lira** is an offline-first, enterprise-grade project tracking and engineering workspace modeled after Atlassian Jira, built with React 18, TypeScript, Tailwind CSS, Dexie IndexedDB, and automatic local PC file synchronization.

[![React](https://img.shields.io/badge/React-18.3.1-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-purple.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Dexie.js](https://img.shields.io/badge/Dexie.js-IndexedDB-orange.svg)](https://dexie.org/)
[![Storage](https://img.shields.io/badge/Storage-Space--Segregated_JSON-emerald.svg)](./data/spaces/)

---

## 🌟 Key Highlights

### 💾 1. Two-Way Local PC Disk Persistence & Sharded Storage
* **Space-Segregated Storage Architecture**: Workspace data is partitioned cleanly into individual space files under [`data/spaces/<KEY>.json`](./data/spaces/) (e.g. `AI.json`, `CERT.json`, `COUR.json`, `CH.json`, `GT.json`, `LIRA.json`), paired with a manifest index in [`data/spaces.json`](./data/spaces.json). This prevents file bloat and ensures modular, scalable performance.
* **Consolidated Master Snapshot & Dual-Sync**: On every change, Lira automatically updates both the individual space file (`data/spaces/<KEY>.json`) and a unified master snapshot at [`data/lira-workspace.json`](./data/lira-workspace.json) for 100% backward compatibility.
* **No Cloud Required / 100% Offline**: All spaces, epics, tasks, subtasks, activities, and rankings are stored directly on your PC disk. No internet connection or external database is required.
* **Vite Middleware REST Endpoints**: Built-in Vite dev-server middleware exposes `/api/data`, `/api/save`, `/api/spaces`, and `/api/health` endpoints, serializing workspace state with zero external backend dependencies.
* **Unified Single-File Backup & Restore**:
  * **Export**: Clicking **Export JSON Backup** downloads a single, comprehensive timestamped backup file (`lira-backup-YYYY-MM-DD.json`) containing all spaces and issues across your entire workspace, while simultaneously refreshing local disk files.
  * **Import**: Uploading a single backup `.json` file restores all spaces and issues into in-browser Dexie IndexedDB and immediately dual-syncs them to individual space JSON files on disk.
* **Persistent Status Bar**: Top navigation displays a real-time status indicator (`🟢 PC Saved` / `💾 Saving to PC…`) with manual immediate sync triggers.

### 📋 2. Jira-Grade Kanban Board & Full-Height DnD
* **Continuous Multi-Drag**: Powered by `@hello-pangea/dnd` with reactive state synchronization, eliminating draggable sensor unmount bugs and enabling infinite drag-and-drop operations across all columns.
* **Full-Height Column Drop Targets**: Short columns dynamic stretch their droppable areas to match the tallest column on the board, allowing tasks to be promoted from the bottom of any column with full blue-zone detection.
* **Active Edge Auto-Scrolling**: A high-performance `requestAnimationFrame` velocity loop monitors cursor proximity to board edges (top, bottom, left, right) and smoothly scrolls the board during active dragging.
* **Fractional Ranking Engine**: Supports smooth, collision-free reordering between any two tasks (`newRank = (before + after) / 2`).
* **Multi-Axis Mouse Controls**: Floating directional controls (top, bottom, left, right), alt-wheel horizontal scroll, and custom scrollbars.
* **Jira-Style Delete Confirmation Modal**: Custom `ConfirmDeleteModal` with Atlassian styling and backdrop blur replaces browser `window.confirm()`, alerting users with explicit warnings when deleting parent tasks or epics with child issues.

### ⚡ 3. Lira v2.0 Scope Refactor & Enterprise UX Engine
* **Strict Pruning & Zero Bloat**: Purged all dead menus (`Projects`, `Dashboards`, `Teams` in top nav, old `SPACES` header row and bottom utility list in left sidebar, `Timeline`/`Approvals` in board tabs).
* **Multi-Dimensional Filters Explorer**: Full-page interactive JQL query table filtering across Spaces, Status, Priority, Tags/Labels, Assignees, and Teams with instant CSV & JSON exports.
* **Action-Detail Notifications Center**: Bell popover displaying concrete audit action details (created, status transitioned, comments, edits) with clickable direct ticket hyperlinks.
* **Jira-Grade Settings Popover Menu & 8 Dedicated Modals**: Searchable admin panel modeled directly from Jira Cloud with working popups for General Settings, Notification Settings, System & Disk Backup, Jira Apps, Manage Spaces, Work Items Hierarchy, Marketplace Apps, User Management, and Billing.
* **Interactive Account Options (`VY`) & Profile Editor**: Dedicated account popover matching Jira Cloud with Profile editor modal, email & initials manager, and Light/Dark workspace theme switcher.
* **Space Overflow Actions (`...`)**: Fully operational Board Settings modal (card density & badge toggles), WIP Limits engine (with column caps and over-capacity warnings), and Bulk Actions modal (batch status, priority, assignee, and deletion).
* **Enhanced Capacity & Workload Allocation**: Complete 4-way grouping engine (`Status`, `Assignee`, `Priority`, `Epic`) with story point capacity load bars, throughput dials, and in-view quick filter chips (`All`, `Assigned to VY`, `In Flight`, `High Priority`, `Overdue`).
* **Interactive & Reactive "Customise Your Sidebar"**: Modal drawer allowing users to customize visible navigation items (For you, Recent, Filters, Dashboards, Teams, Apps, Starred, Spaces) with instant reactive rendering and `localStorage` persistence.
* **Aesthetic Geometric App Launcher**: Multi-tone gradient 9-module app switcher button with instant operational triggers for Lira Board, Lira AI, and local PC Backup & Restore.

### 🤖 3. Omnipresent AI Copilot & Autonomous Agent
* **Animated Floating Avatar Trigger**: Docked in the bottom-right corner (`bottom-5 right-5`) featuring the enhanced Lira AI SVG avatar with gentle breathing and glowing animations (`animate-float-subtle`, `animate-pulse-glow`).
* **Non-Blocking Curved Dialogue Box**: Floating card with curved edges on all 4 sides (`rounded-3xl`), detached from window borders, keeping the entire Kanban board visible.
* **Compact & Expanded Modes**: One-click toggle between compact dialogue card (`w-[440px]`) and spacious view (`w-[680px]`) for wide cross-space comparison tables.
* **Cross-Space Omnipresence**: Live read/write visibility across all present and future spaces. Query tickets, inspect roadmaps, or create issues in any space from anywhere in the app.
* **Autonomous Task Breakdown**: Generates domain-specific engineering subtasks (Docker, Kubernetes, CI/CD, Certifications) directly into tickets.
* **Configurable System Instructions**: Edit the agent's governing directives and optional Google Gemini 1.5 Flash cloud API key via the in-drawer Settings tab.

### 🏷️ 4. 3-Tier Enterprise Work Item Hierarchy
* **Epics** ⚡ → **Tasks** ✅ / **Bugs** 🐛 → **Subtasks** ↳
* **Story Removed**: Completely streamlined into Tasks and Epics across all spaces and code paths.
* **Dynamic Type Conversion**: Upgrade or downgrade any ticket dynamically with automatic parent-child relinking and audit activity logging.
* **Floating Portal Dropdowns**: Subtask placards display their parent task link; clicking opens an unclipped floating React Portal dropdown with viewport boundary collision detection.

---

## 🚀 Quick Start

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher

### Installation & Launch

```bash
# 1. Clone or navigate to the repository
cd d:\MLOps_LLMOps\Lira\lira-app

# 2. Install dependencies
npm install

# 3. Start the local development server
npm run dev
```

Open your browser at **`http://localhost:5173`**.

---

## 📂 Repository Structure

```
Lira/
├── data/
│   ├── spaces.json                     # Manifest registry of all active spaces
│   ├── spaces/                         # Sharded space-segregated storage
│   │   ├── AI.json                     # AI Projects (Epics, Tasks, Subtasks)
│   │   ├── AP.json                     # Awesome Portfolio
│   │   ├── CERT.json                   # Certifications (Azure, Databricks, Kubestronaut)
│   │   ├── CH.json                     # Creator Hub (Prompts, Content)
│   │   ├── COUR.json                   # Courses (Azure, AI/MLOps, Platform)
│   │   ├── GT.json                     # General Tasks
│   │   ├── IG.json                     # Interview Guide
│   │   ├── LIRA.json                   # Lira Internal Engineering & DevOps
│   │   └── TS.json                     # Test Space
│   └── lira-workspace.json             # Consolidated dual-sync master snapshot
├── Prompts and Architectures/          # System design, architecture, and user guides
│   ├── 01_AppDesign.md
│   ├── 02_Frontend_Architecture.md
│   ├── 03_Database_and_Storage.md
│   ├── 04_Backend_and_Offline_Workflows.md
│   ├── 05_Technical_Workflows_and_State_Machine.md
│   ├── 06_Feature_Catalog.md
│   ├── 07_User_Guide_and_How_To.md
│   ├── 08_Troubleshooting_and_Disaster_Recovery.md
│   └── 09_AI_Agent_and_Copilot_Architecture.md
├── lira-app/                           # React frontend application
│   ├── public/                         # Public brand assets (lira-logo.png, etc.)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ai/                     # Lira AI Copilot floating card & LiraAIAvatar
│   │   │   ├── board/                  # KanbanBoard, BoardColumn, IssueCard, SummaryView, CapacityView
│   │   │   ├── common/                 # ConfirmDeleteModal, Avatar, Badge, Button, Modal
│   │   │   ├── filter/                 # FiltersPage (Multi-dimensional cross-space filter engine)
│   │   │   ├── issue/                  # IssueDetailModal, CreateIssueModal
│   │   │   ├── layout/                 # TopNavigation, LeftSidebar, BoardActionBar, CustomiseSidebarModal
│   │   │   └── space/                  # Space settings and create modals
│   │   ├── db/                         # Dexie DB instance, seed data, storage service
│   │   ├── hooks/                      # useIssues, useSpaces reactive hooks
│   │   ├── services/                   # localDiskSync, aiAgentService
│   │   ├── types/                      # TypeScript domain models (issue, space)
│   │   ├── utils/                      # dateUtils, priorityUtils, rankUtils
│   │   ├── App.tsx                     # Main layout & routing
│   │   └── main.tsx                    # React DOM entry point
│   ├── vite.config.ts                  # Vite config with sharded localFileDbPlugin middleware
│   ├── package.json
│   └── tsconfig.json
└── README.md                           # Master repository documentation
```

---

## 🗂️ Active Spaces Across the Workspace

Lira currently manages **9 active spaces** with **124+ issues** across diverse technical domains:

| Key | Space Name | Description / Focus | Epics & Scope |
|---|---|---|---|
| `AI` | **AI Projects** | Next-Gen AI Platforms & Claude Skills | Next-Gen Platforms (`AI-6`), Claude Skills (`AI-11`), Claude MCP Workspace (`AI-15`) |
| `CERT` | **Certifications** | Multi-Cloud & DevOps Certifications | Azure (`CERT-14`), Databricks (`CERT-15`), Kubestronaut (`CERT-16`) |
| `COUR` | **Courses** | Engineering & Learning Tracks | Azure Track (`COUR-16`), AI & MLOps (`COUR-17`), Platform & Creator (`COUR-18`) |
| `CH` | **Creator Hub** | Creative Content & Production Workflows | Prompts Epic (`CH-4`) with audio, video, script, & character generation tasks |
| `GT` | **General Tasks** | Day-to-Day Operations & Profile Branding | Company research, LinkedIn, Naukri, Resume, and Account setup tasks |
| `AP` | **Awesome Portfolio** | Full-Stack & Systems Portfolio Showcases | Portfolio architecture, micro-frontends, and interactive demos |
| `LIRA` | **Lira Project** | Lira App Development & Cloud-Native Delivery | Core Frontend (`LIRA-1`), DevOps Delivery (`LIRA-6`), AI Copilot (`LIRA-13`), v2.0 Scope Refactor (`LIRA-30`) |
| `IG` | **Interview Guide** | Technical Interview Preparation | Distributed systems, Kubernetes deep dives, and system design |
| `TS` | **Test Space** | Playground & Sandbox Environment | Testing workflows and temporary experiment tracking |

---

## 🛠️ DevOps & Production Roadmap (LIRA Space)

The `LIRA` space within the application tracks the active roadmap for cloud-native delivery:

| Key | Type | Title | Status |
|---|---|---|---|
| `LIRA-1` | Epic | Core Jira Frontend & Board Architecture | **Done** |
| `LIRA-6` | Epic | DevOps & Cloud-Native Delivery | **In Progress** |
| `LIRA-7` | Task | Multi-Stage Dockerfile (Node.js 20 build + Nginx Alpine) | **In Progress** |
| `LIRA-9` | Task | Azure Kubernetes Service (AKS) Manifests & Helm Charts | **To Do** |
| `LIRA-10` | Task | CI/CD Pipeline (GitHub Actions & Azure Pipelines) | **Backlog** |
| `LIRA-11` | Task | Automated Code Quality & SonarQube / ESLint Pipeline | **Backlog** |
| `LIRA-12` | Task | Comprehensive Unit & Integration Tests with Vitest | **To Do** |
| `LIRA-13` | Epic | AI Copilot & Autonomous Agentic Assistant | **Done** |
| `LIRA-30` | Epic | Lira v2.0 Scope Refactor & Enterprise UX Implementation | **Done** |
| `LIRA-31` | Task | Strict UI Pruning (Projects, Dashboards, Teams, SPACES Header, Timeline, Approvals) | **Done** |
| `LIRA-32` | Task | Advanced Multi-Dimensional Filters Explorer Page | **Done** |
| `LIRA-33` | Task | Notification Center with Action Details & Ticket Hyperlinks | **Done** |
| `LIRA-34` | Task | Jira-Grade Settings Popover Menu with Admin Navigation | **Done** |
| `LIRA-35` | Task | Interactive Customise Sidebar Drawer with Preference Persistence | **Done** |
| `LIRA-36` | Task | Geometric Multi-Tone App Launcher & Backup/Restore Engine | **Done** |
| `LIRA-37` | Task | Summary & Capacity Analytics Dashboards with Progress Dials | **Done** |

---

## 🛡️ License

Private workspace for MLOps & LLMOps engineering. All rights reserved.
