# Lira — Enterprise Offline-First Kanban & Engineering Workspace

> **Lira** is an offline-first, enterprise-grade project tracking and engineering workspace built with React 18, TypeScript, Tailwind CSS, Dexie IndexedDB, and automatic local PC file synchronization.

[![React](https://img.shields.io/badge/React-18.3.1-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.x-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-purple.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Dexie.js](https://img.shields.io/badge/Dexie.js-IndexedDB-orange.svg)](https://dexie.org/)
[![Storage](https://img.shields.io/badge/Storage-JSON_files_in_data/-emerald.svg)](./data/)
[![Tests](https://img.shields.io/badge/tests-521_passing-brightgreen.svg)](#-tests)

**Documents:** [SETUP.md](SETUP.md) (install, run, data, URLs, tablet and phone) · [ROADMAP.md](ROADMAP.md) (what is done and what is next) · [SECURITY_REPORT.md](SECURITY_REPORT.md) (20-point security check) · [PUBLIC_EDITION_PLAN.md](PUBLIC_EDITION_PLAN.md) (plan for a hosted, multi-user edition on Azure) · [Prompts and Architectures/](Prompts%20and%20Architectures/) (design documents)

---

## What's new (November 2026)

| Area | What you get |
|---|---|
| **Sprints** | Every sprint can be **monthly, weekly, bi-weekly or a set number of days**. Choose which spaces work in each sprint. Sprint page has four views: **Sprint** (with a status and space filter), **Planning** (backlog on the left, sprint on the right, drag across, points against capacity with an over-commit warning), **Reports** (burnup, cumulative flow, scope changes, lead and cycle time, export to Markdown or PDF) and **Epics** (timeline across sprints). Closing a sprint carries unfinished tickets over and records a **retrospective**. |
| **Roadmaps** | One JSON file per roadmap, timeline / Now-Next-Later / table / planner views. Every roadmap item is a real epic with a checklist task. |
| **Viva AI** | **Confirm before changing anything, with Undo.** Sprint-aware prompts ("Plan next sprint from my backlog", "Summarise this sprint"), "Write my standup", a risk radar, suggestions while creating a ticket (duplicates, labels, priority, epic), and a choice of model: built-in engine, Gemini, or any OpenAI-compatible server such as Ollama. |
| **Standup and sprint calls** | Calendar, Teams and email invites with `.ics` download, per space, project or sprint. |
| **Pages have real URLs** | `/sprints/2026-11`, `/space/LIRA/board`, `/roadmaps/rm-lira`, `?issue=LIRA-12`. Refresh, Back and shared links work. Errors in one page no longer blank the app. |
| **Everything is in files** | Projects, sprints, teams, standups, roadmaps and settings are saved as JSON under `data/`, so clearing the browser loses nothing. |
| **Tablet and phone** | `npm run dev:lan` opens Lira to your own Wi-Fi behind a private link and QR code (**Settings, Other devices**). Phone and upright-tablet layouts use a menu drawer. |
| **Motion** | Framer Motion: dialogs and menus animate in and out, sliding tab underline and sidebar highlight, count-up numbers, bars that grow, burndown lines that draw themselves, confetti when a ticket reaches Done or a sprint closes. Reduced-motion settings are respected. |
| **Look** | Light and dark themes, 10+ accent colours, rounded panels, scroll bars kept inside their panels. |
| **Editing and saving** | The ticket popup is a draft: nothing is written until **Save changes**, which also closes it, and closing with unsaved changes asks first. Settings pages close on Save. Theme and accent colour apply only when saved. Every save shows a small animated "saved" card. Lira's own dialogs replace every browser confirm, prompt and alert. You can edit your own comments. |
| **Rich descriptions** | A full editor for ticket descriptions: headings, bold, italic, underline, strikethrough, bullet, numbered and checkbox lists, quotes, code, links, text colour, highlight, **@mentions**, and files (pictures show in the text, every file joins the ticket's attachments). Older Markdown descriptions open converted. |
| **Dashboards** | Sidebar, Dashboards. Start from one of 10 scenario templates (My work, Sprint health, Team workload, Blocked and risks, Delivery and flow, Project progress, Roadmap view, Quality and bugs, Executive summary, Custom), run the 4-step wizard (Goal, Scope, Focus, Widgets, with a live preview), or **describe** what you want in a sentence (or ask Viva) and Lira picks the widgets and filters. 51 ready-made widgets: numbers with the change since last week, bar and donut charts, created vs finished, throughput, aging, due-date strip, burndown, burnup, cumulative flow, lists (needs attention, overdue, stale, my tickets...), blocked tickets with their blockers, team workload with overload warnings, progress by epic, project or sprint, roadmap status, and a plain-words summary. **Customise** to drag, resize (S, M, L, full width), set up (including filters for one widget only), add or remove widgets. Click a number or a bar to open its tickets. **Alerts** warn when a number passes a limit. **Snapshot** saves the dashboard as a Markdown file every week. **Export** as a picture (PNG), print or PDF, Markdown or a dashboard file; **Share** copies a link. |
| **Blocked switch** | Every ticket (epic, task, bug, subtask) has a **Blocked** switch (a two-part pill under Status). Turning it on asks which tickets are blocking it (one or several) and links them ("blocked by" on this ticket, "blocks" on the others). One blocker shows as a card, several show as removable chips, and the blocking ticket lists what it is blocking. A small flame animation burns around the switch while it is on. The ticket keeps its status and its board column and shows a red "Blocked by KEY" badge. Blocked is counted on the Summary, Capacity, List, Calendar, Sprints, Projects, Roadmaps, Standup, For you and Reports screens, and is a choice in the Status filters. |
| **Comments** | Comments use the same editor as descriptions (short toolbar): text, lists, links, @mentions, and pictures or files placed exactly where you want them in the text. Paste a screenshot with Ctrl+V into any description or comment. Files added in comments are also listed in the ticket's Attachments section ("Added in comments"). The paperclip opens the attach window (computer, Drive, OneDrive, Dropbox or link). Every comment shows its day, date and time, and has **Copy** and (for your own) **Edit**. The description has **Copy description**. |
| **Open in new tab** | Right-click any ticket, sprint, project, roadmap, space or sidebar item for **Open in new tab** and **Copy link**. Middle-click or Ctrl + click opens it in a new tab at once. |
| **Space filters** | The board, list and capacity views have three small dropdowns, **Priority**, **Status** and **Labels**. Each lists its values with a checkbox, so one or several can be chosen. Labels has a text box to find a label. |
| **Attachments** | **Add attachment** opens a window to choose the source: this computer (drag and drop or browse), a Google Drive, OneDrive or Dropbox share link, or any web link. |
| **Dates** | A themed date picker everywhere a date is chosen. Click the month and year to jump to any month of any year. The month calendar has the same chooser and "+N more" days. |
| **Security** | The 20-point check is in [SECURITY_REPORT.md](SECURITY_REPORT.md): the local API only answers Lira itself, safe file names, safe links, security headers, audit log, 0 known vulnerable packages. |
| **Code health** | Large files split into small parts (no component over about 500 lines), 521 automated tests and a data health check. |

## Key Highlights

### 1. Two-Way Local PC Disk Persistence & Sharded Storage
* **Space-Segregated Storage Architecture**: Workspace data is partitioned cleanly into individual space files under [`data/spaces/<KEY>.json`](./data/spaces/) (e.g. `AI.json`, `CERT.json`, `COUR.json`, `CH.json`, `GT.json`, `LIRA.json`), paired with a manifest index in [`data/spaces.json`](./data/spaces.json). This prevents file bloat and ensures modular, scalable performance.
* **Consolidated Master Snapshot & Dual-Sync**: On every change, Lira automatically updates both the individual space file (`data/spaces/<KEY>.json`) and a unified master snapshot at [`data/lira-workspace.json`](./data/lira-workspace.json) for 100% backward compatibility.
* **No Cloud Required / 100% Offline**: All spaces, epics, tasks, subtasks, activities, and rankings are stored directly on your PC disk. No internet connection or external database is required.
* **Vite Middleware REST Endpoints**: Built-in Vite dev-server middleware exposes `/api/data` and `/api/save` (tickets), `/api/kv` (projects, sprints, roadmaps, teams, standups and settings), `/api/spaces`, `/api/health` and `/api/lan` (this computer only), with zero external backend dependencies. Only Lira itself may call them (host and origin checks, JSON only, size limit), and every save is noted in `data/private/audit.log`.
* **Everything is a file**: besides tickets, projects, sprints, roadmaps (one file each), teams, standups and settings live as JSON under `data/`, so clearing the browser loses nothing. See SETUP.md section 7.
* **Unified Single-File Backup & Restore**:
  * **Export**: Clicking **Export JSON Backup** downloads a single, comprehensive timestamped backup file (`lira-backup-YYYY-MM-DD.json`) containing all spaces and issues across your entire workspace, while simultaneously refreshing local disk files.
  * **Import**: Uploading a single backup `.json` file restores all spaces and issues into in-browser Dexie IndexedDB and immediately dual-syncs them to individual space JSON files on disk.
* **Persistent Status Bar**: Top navigation displays a real-time status indicator (` PC Saved` / ` Saving to PC…`) with manual immediate sync triggers.

### 2. Enterprise-Grade Kanban Board & Full-Height DnD
* **Continuous Multi-Drag**: Powered by `@hello-pangea/dnd` with reactive state synchronization, eliminating draggable sensor unmount bugs and enabling infinite drag-and-drop operations across all columns.
* **Full-Height Column Drop Targets**: Short columns dynamic stretch their droppable areas to match the tallest column on the board, allowing tasks to be promoted from the bottom of any column with full blue-zone detection.
* **Active Edge Auto-Scrolling**: A high-performance `requestAnimationFrame` velocity loop monitors cursor proximity to board edges (top, bottom, left, right) and smoothly scrolls the board during active dragging.
* **Fractional Ranking Engine**: Supports smooth, collision-free reordering between any two tasks (`newRank = (before + after) / 2`).
* **Multi-Axis Mouse Controls**: Floating directional controls (top, bottom, left, right), alt-wheel horizontal scroll, and custom scrollbars.
* **Delete Confirmation Modal**: Custom `ConfirmDeleteModal` with backdrop blur replaces browser `window.confirm()`, alerting users with explicit warnings when deleting parent tasks or epics with child issues.

### 3. Lira v2.0 Scope Refactor & Enterprise UX Engine
* **Strict Pruning & Zero Bloat**: Purged all dead menus (`Projects`, `Dashboards`, `Teams` in top nav, old `SPACES` header row and bottom utility list in left sidebar, `Timeline`/`Approvals` in board tabs).
* **Multi-Dimensional Filters Explorer**: Full-page interactive JQL query table filtering across Spaces, Status, Priority, Tags/Labels, Assignees, and Teams with instant CSV & JSON exports.
* **Action-Detail Notifications Center**: Bell popover displaying concrete audit action details (created, status transitioned, comments, edits) with clickable direct ticket hyperlinks.
* **Settings Popover Menu & 8 Dedicated Modals**: Searchable admin panel with working popups for General Settings, Notification Settings, System & Disk Backup, Apps, Manage Spaces, Work Items Hierarchy, Marketplace Apps, User Management, and Billing.
* **Interactive Account Options (`VY`) & Profile Editor**: Dedicated account popover with Profile editor modal, email & initials manager, and Light/Dark workspace theme switcher.
* **Space Overflow Actions (`...`)**: Fully operational Board Settings modal (card density & badge toggles), WIP Limits engine (with column caps and over-capacity warnings), and Bulk Actions modal (batch status, priority, assignee, and deletion).
* **Enhanced Capacity & Workload Allocation**: Complete 4-way grouping engine (`Status`, `Assignee`, `Priority`, `Epic`) with story point capacity load bars, throughput dials, and in-view quick filter chips (`All`, `Assigned to VY`, `In Flight`, `High Priority`, `Overdue`).
* **Interactive & Reactive "Customise Your Sidebar"**: Modal drawer allowing users to customize visible navigation items (For you, Recent, Filters, Dashboards, Teams, Apps, Starred, Spaces) with instant reactive rendering and `localStorage` persistence.
* **Space Visibility & Lifecycle Management (Hide & Archive)**: Dedicated **"Hidden Spaces"** and **"Archived Spaces"** sidebar sections with real-time counters, expand/collapse toggles, and contextual 3-dots options. Users can hide/unhide and archive/unarchive spaces either directly from sidebar space rows or from the Kanban board toolbar (`...` menu). Hidden and archived spaces remain fully accessible to view, edit, modify issues, and update space settings at any time.
* **Seamless Project-to-Space Navigation**: Smoothly transition between the Projects overview/workspace and any Space board with automatic state switching and sidebar restoration.
* **Aesthetic Geometric App Launcher**: Multi-tone gradient 9-module app switcher button with instant operational triggers for Lira Board, Lira AI, and local PC Backup & Restore.

### 4. Viva AI: Copilot & Autonomous Agent
* **Floating launcher** in the bottom-right corner opens a curved chat card that grows out of the button and shrinks back into it. Compact and expanded sizes.
* **Reads and writes across every space.** Search, status tables, create tickets, move them between statuses and sprints, add subtasks.
* **Confirm and Undo.** Before changing anything Viva shows what it will do and waits for **Confirm**. Afterwards an **Undo** button puts every changed ticket back. (Settings can turn confirmation off.)
* **Sprint-aware.** "Plan next sprint from my backlog" (highest priority first, within capacity, only spaces that work in that sprint), "Summarise this sprint", "Write my standup", "Show the risk radar".
* **Suggestions while you create a ticket.** Possible duplicates, labels, priority and the likely epic. Nothing is applied until you click.
* **Your choice of model.** The built-in engine (default, no network), Google Gemini, or any OpenAI-compatible server (Ollama, LM Studio...). Changes to tickets are always made by the built-in engine so they can be previewed and undone; a model only answers questions. Ticket text is treated as data, never as instructions.
* Code: `src/services/ai/` (intent, handlers, preview, undo, provider) and `src/components/ai/`.

### 5. 3-Tier Enterprise Work Item Hierarchy
* **Epics** → **Tasks** / **Bugs** → **Subtasks**
* **Story Removed**: Completely streamlined into Tasks and Epics across all spaces and code paths.
* **Dynamic Type Conversion**: Upgrade or downgrade any ticket dynamically with automatic parent-child relinking and audit activity logging.
* **Floating Portal Dropdowns**: Subtask placards display their parent task link; clicking opens an unclipped floating React Portal dropdown with viewport boundary collision detection.

---

## Quick Start

### Prerequisites
* **Node.js** 20.19+ or 22.12+ (Vite 8 needs it) and **npm** 10+

### Install and run

```bash
cd lira-app          # every command runs from lira-app/
npm install
npm run dev          # http://localhost:5173
```

Other commands:

| Command | What it does |
|---|---|
| `npm run dev:lan` | Same, and also opens Lira to your own Wi-Fi for a tablet or phone (private link and QR code in **Settings, Other devices**) |
| `npm test` | 521 automated tests (Vitest) |
| `npm run test:health` | Read-only check of your `data/` folder (15 checks) |
| `npm run test:all` | Type check, lint, all tests, data health |
| `npm run build` | Type-check, then production build |
| `npm run lint` | Oxlint |

Full instructions, where data is stored, URLs, and the tablet and phone steps are in [SETUP.md](SETUP.md).

---

## Tests

`npm test` covers sprint logic (monthly and custom lengths, rollover, reports), standup and invite builders, AI intent parsing and the confirm / undo flow, the disk-persistence layer (including wiping the browser and restoring from disk), the local API guard, routes, and the animation helpers, plus screens in a fake browser, dashboards, code rules and document checks. Full guide and the planned browser tests: [TESTING.md](TESTING.md).

---

## Repository Structure

```
Lira/
├── data/                               # Your workspace, as JSON files
│   ├── spaces.json, spaces/<KEY>.json  # Spaces and their tickets (one file per space)
│   ├── lira-workspace.json             # Consolidated snapshot
│   ├── projects.json                   # Projects
│   ├── sprints.json                    # Sprint goals, capacity, retrospectives, custom sprints, sprint spaces
│   ├── roadmaps/<id>.json, index.json  # One file per roadmap
│   ├── teams.json, standups.json       # Teams and standups
│   ├── dashboards.json                 # Your saved dashboards (widgets, filters, alerts, snapshot schedule)
│   ├── snapshots/*.md                  # Weekly dashboard snapshots (Markdown)
│   ├── board-config.json, settings.json# Board settings, theme, profile, Viva settings
│   └── private/                        # Git-ignored: API key, tablet link secret, audit log
├── Prompts and Architectures/          # Design, architecture and user guides (01 to 09)
├── lira-app/                           # The web app (run every command from here)
│   ├── server/                         # Disk store and the local API guard (host check, headers, audit log)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ai/                     # Viva AI chat card and avatar
│   │   │   ├── board/                  # Kanban board, summary, capacity, reports, forms
│   │   │   ├── common/                 # Modal, Button, motion (animations), Confetti, error boundaries
│   │   │   ├── filter/ foryou/ issue/  # Filters page, For you, ticket popup and create form
│   │   │   ├── layout/                 # Top bar, sidebar, settings (including Other devices)
│   │   │   ├── projects/ roadmap/      # Projects and roadmaps
│   │   │   ├── sprints/                # Sprint pages: overview, planning, reports, retro, epics
│   │   │   ├── standup/ space/         # Standup and sprint calls, space dialogs
│   │   ├── db/                         # Dexie database, seed data, backup
│   │   ├── hooks/                      # Data hooks, issue popup, media queries
│   │   ├── services/                   # Disk sync, JSON mirror, roadmap epics, ai/ (Viva)
│   │   ├── utils/                      # Sprint logic and reports, roadmap logic, accent, safe URLs, celebrate
│   │   ├── routes.ts                   # The list of pages and their URLs
│   │   └── App.tsx, main.tsx
│   ├── vite.config.ts                  # Dev server with the disk-saving API
│   └── package.json
├── README.md  SETUP.md  ROADMAP.md  SECURITY_REPORT.md
└── .gitignore                          # Includes data/private/ and App Screen Previews/
```

---

## Active Spaces Across the Workspace

Lira currently manages **9 active spaces** with **150+ tickets** across diverse technical domains:

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

## DevOps & Production Roadmap (LIRA Space)

The `LIRA` space within the application tracks the work below. The current plan (phases, what is done) is in [ROADMAP.md](ROADMAP.md) and, inside Lira, under **Roadmaps**. Older releases first:

| Key | Type | Title | Status |
|---|---|---|---|
| `LIRA-1` | Epic | Core Frontend & Board Architecture | **Done** |
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
| `LIRA-34` | Task | Settings Popover Menu with Admin Navigation | **Done** |
| `LIRA-35` | Task | Interactive Customise Sidebar Drawer with Preference Persistence | **Done** |
| `LIRA-36` | Task | Geometric Multi-Tone App Launcher & Backup/Restore Engine | **Done** |
| `LIRA-37` | Task | Summary & Capacity Analytics Dashboards with Progress Dials | **Done** |
| `LIRA-38` | Task | Interactive Account Profile (VY) Dropdown & Profile Editor Modal | **Done** |
| `LIRA-39` | Task | Settings Popover Complete Suite of 8 Admin Modals | **Done** |
| `LIRA-40` | Task | Space Three-Dots Menu: Board Settings, WIP Limits & Bulk Actions | **Done** |
| `LIRA-41` | Task | Capacity View Grouping Engine & Real-Time Filter Chips | **Done** |
| `LIRA-42` | Task | Dynamic Sidebar Customization & Reactive Section Rendering | **Done** |
| `LIRA-43` | Task | Preset Filter Navigation & Automatic JQL Preset Application | **Done** |
| `LIRA-44` | Task | Responsive Two-Row Tailwind Grid Redesign for FiltersPage | **Done** |
| `LIRA-45` | Task | Settings Gear Modal with Appearance Theme, Profile & Export Sections | **Done** |
| `LIRA-46` | Task | Enhanced Notifications Popover with Action Details & Ticket Hyperlinks | **Done** |
| `LIRA-47` | Task | LocalDiskSync Backup & Restore Engine with Live Toast Feedback | **Done** |
| `LIRA-48` | Task | Customizable & Reorderable Left Sidebar with LocalStorage Sync | **Done** |
| `LIRA-49` | Task | Modernized Quick-Links App Launcher Visuals & Tailwind States | **Done** |
| `LIRA-50` | Task | Lira v2.0 Release Notes & Master Documentation Updates | **Done** |
| `LIRA-51` | Task | Phase 2: Projects Architecture & Spaces Integration | **Done** |
| `LIRA-52` | Task | ProjectsOverview Directory & Card Interface | **Done** |
| `LIRA-53` | Task | CreateProjectModal with Dual Space Association | **Done** |
| `LIRA-54` | Task | ProjectDetailView Tabbed Workspace (Board, Technical Details, Settings) | **Done** |
| `LIRA-55` | Task | App.tsx & LeftSidebar Navigation Wiring | **Done** |
| `LIRA-56` | Task | Phase 4: Layout State, Routing & Theme Fixes | **Done** |
| `LIRA-57` | Task | Light/Dark Mode Fix on documentElement with LocalStorage & Tailwind Class Strategy | **Done** |
| `LIRA-58` | Task | Maximize & Sidebar Auto-Collapse with 56px Icon Rail & Smooth Transition | **Done** |
| `LIRA-59` | Task | Filters Page Sidebar Auto-Collapse & Cross-View Space Navigation | **Done** |

---

## v2.0 Release Notes (earlier history)

Lira v2.0 delivers an extensive suite of enterprise UX refinements, navigation upgrades, and responsive layouts:

1. **Preset Filter Navigation & Automatic JQL Application**:
   - Integrated preset filter triggers (`All Issues`, `Open Issues`, `Completed`, `Recently Updated`) directly within the Top Navigation `Filters` dropdown.
   - Clicking any preset automatically routes the user to the Filters page and applies the selected criteria instantaneously.
   - Interactive segmented preset control on the Filters page displays real-time ticket tallies and single-click switching.

2. **Responsive Two-Row FiltersPage Layout**:
   - Complete redesign of the Filters & Work Item Search controls into a structured two-row layout utilizing Tailwind CSS grid utilities.
   - **Row 1 (Primary & Presets)**: Full-width search bar with clear button, preset filter pill segmented tabs, and matching items counter.
   - **Row 2 (Multi-Dimensional Facets)**: Responsive 6-column grid for Spaces, Status, Priority, Type, Assignee, and Tags & Team filters with active badges.
   - Removable active filter chips bar allowing granular removal of applied criteria with one-click "Reset all" functionality.

3. **Unified Settings Gear Modal with Appearance, Export/Backup, & Profile**:
   - Replaced redundant dropdown actions by wiring the top-navigation Settings gear icon directly to a unified Settings modal.
   - **Appearance**: Live Theme Switcher supporting Dark Mode (default) and Light Mode with immediate document-level styling and `localStorage` persistence.
   - **Profile**: Personal profile management for display name, contact email, initials avatar, and professional role.
   - **Export & Backup**: Direct administrative dashboard displaying local storage engine diagnostics, file sync paths, and backup actions.

4. **Enhanced Action-Detail Notifications Center**:
   - Refactored the Notifications bell popover to categorize audit events into `+ Created`, ` Edited`, and ` Closed` transitions.
   - Formatted each notification with actor badges, action summaries, space chips, and explicit clickable ticket hyperlinks (`#KEY`).
   - Added category filter tabs (`All`, `Created`, `Edited`, `Closed`) and an "Only show unread" toggle switch with a "Mark all as read" control.

5. **LocalDiskSync Backup & Restore Engine with Live Toast Feedback**:
   - Direct integration between modal backup/restore triggers and the `localDiskSync` service (`saveToDiskNow`, `initLocalDiskSync`, `exportBackup`, `importBackup`).
   - Animated floating toast feedback banners with visual icons for successful saves, restoration completions, and error notifications.
   - Automatic dual-sync to local PC disk files (`data/spaces/*.json` and `data/lira-workspace.json`).

6. **Customizable & Reorderable Left Sidebar**:
   - Complete "Customise your sidebar" modal supporting both visibility toggles and custom ordering of navigation items and app shortcuts.
   - Drag-and-drop handles, single-click up/down reordering arrows, and contextual move menus ("Move to top", "Move to bottom", "Move up", "Move down").
   - Choices are persisted in `localStorage` (`lira_sidebar_customization`) and applied dynamically on sidebar render for both expanded and collapsed modes.

7. **Modernized Quick-Links App Launcher**:
   - Updated the top-left App Launcher button with a modern 9-dot switcher design.
   - Polished hover and active Tailwind styling with smooth transitions, border illumination, and active state ring effects while preserving the quick-links icon set (`Lira Board`, `Lira AI Assistant`, `Backup & Restore`, `GitHub Repo`).

8. **Phase 2: Projects Architecture & Spaces Integration**:
   - **Projects Overview Directory (`ProjectsOverview.tsx`)**: High-fidelity projects hub persisted in `localStorage` (`lira_projects`), rendering responsive project cards with technical owners/leads, associated Space tags, live progress meters (% completed), ticket tallies, real-time search, and space filtering.
   - **Dual-Association Creation Engine (`CreateProjectModal.tsx`)**: Modal dialog with automatic key prefix derivation, lead assignment, and a dual-mode radio selector allowing developers to either bind to existing spaces or provision new isolated workspace shards (`data/spaces/<KEY>.json`) directly on disk.
   - **Tabbed Project Workspace (`ProjectDetailView.tsx`)**:
     - **Board Tab**: Filtered Kanban board displaying exclusively the issues linked to the active project, with ticket search, quick assignee toggles, and column progress metrics.
     - **Technical Details Tab**: Comprehensive engineering metadata management for Git repository URLs (with direct external links), multi-environment tagging (Development, QA, Staging, Production), and architectural scope descriptions.
     - **Project Settings Tab**: RBAC permissions note with offline administrator guidelines, 4-stage workflow states lifecycle (`Backlog`, `To Do`, `In Progress`, `Done`), and customizable project fields schema stub.
   - **Navigation & Routing Wiring (`App.tsx` & `LeftSidebar.tsx`)**: Added dedicated "Projects" navigation item with Lucide `FolderKanban` icon in LeftSidebar (both expanded and collapsed modes), AppLauncher quick-links, and reactive `activeTab === 'Projects'` view rendering.

9. **Phase 4: Layout State, Routing & Theme Fixes**:
   - **Light/Dark Mode System Fix**: Configured Tailwind `darkMode: 'class'` strategy in `tailwind.config.js`. Synchronized theme changes directly to `document.documentElement.classList` (`dark` add/remove) across `SettingsModal.tsx`, `AccountDropdown.tsx`, and `TopNavigation.tsx` with persistence to `localStorage` key `lira_theme`. On app initialization in `App.tsx`, read and apply `lira_theme` immediately before and during initial render.
   - **Board Maximize & Sidebar Auto-Collapse**: Added `sidebarCollapsed` state in `App.tsx` and wired to the board header maximize button ( icon in `BoardActionBar`). When collapsed, `LeftSidebar` transitions smoothly (`transition-all duration-300`) to an icon-only 56px wide rail without text labels.
   - **Filters Page Sidebar Behavior**: Automatically collapses sidebar when navigating to the Filters page (`activeTab === 'Filters'`). Supports manual sidebar expansion, and automatically restores full sidebar and routes to the Board view (`setActiveTab('Board')` and `setSidebarCollapsed(false)`) when clicking any space link from the icon rail, expanded sidebar, or Filters page issue list.

---

## Security

See [SECURITY_REPORT.md](SECURITY_REPORT.md) for the 20-point security check: what passed, what was fixed and what still applies.

## License

Private workspace for MLOps & LLMOps engineering. All rights reserved.
