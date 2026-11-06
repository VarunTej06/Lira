# Lira: Developer Setup Guide

Step-by-step instructions for getting Lira running on a new machine after cloning the repo.

---

## 1. Prerequisites

Install these before you start.

| Tool | Version | Why | Check with |
|---|---|---|---|
| **Node.js** | **20.19+ or 22.12+** (LTS recommended) | Vite 8 will not start on older versions | `node -v` |
| **npm** | 10+ (ships with Node) | Installs dependencies | `npm -v` |
| **Git** | any recent version | Clone the repo | `git --version` |
| **A modern browser** | Chrome, Edge or Firefox | Lira stores data in IndexedDB | n/a |

Optional:
- **VS Code** with the ESLint/Oxlint and Tailwind CSS IntelliSense extensions.
- A **Google Gemini API key** if you want Viva AI to use a cloud model. Viva AI works without it, using the built-in local agent.

Nothing else is needed: no database server, no Docker, no backend, no `.env` file.

Supported OS: Windows, macOS, Linux.

---

## 2. Clone the repository

```bash
git clone https://github.com/VarunTej06/Lira.git
cd Lira
```

The checked-out branch matters. Active development is on `v3`:

```bash
git checkout v3
```

---

## 3. Repository layout

```
Lira/                      <- repo root
├── data/                  <- your workspace data (JSON files, committed to git)
│   ├── spaces.json        <- manifest of all spaces
│   ├── spaces/<KEY>.json  <- one file per space, holding its tickets
│   └── lira-workspace.json<- consolidated snapshot
├── lira-app/              <- the web app (run every command from HERE)
│   ├── src/
│   ├── package.json
│   └── vite.config.ts     <- also contains the disk-sync API
├── Prompts and Architectures/
├── (App Screen Previews/ is git-ignored: third-party screenshots, kept locally only)
├── README.md              <- product overview and features
├── SECURITY_REPORT.md     <- the 20-point security check and what was fixed
├── SETUP.md               <- this file
└── ROADMAP.md             <- planned work
```

---

## 4. Install dependencies

**Run from the `lira-app` folder**, not the repo root. The root has no `package.json`.

```bash
cd lira-app
npm install
```

This creates `lira-app/node_modules/` (git-ignored). It takes about a minute.

---

## 5. Start the dev server

Still inside `lira-app`:

```bash
npm run dev
```

Open the URL Vite prints, normally **http://localhost:5173**.

> **Important: always start the server from `lira-app/`.**
> `vite.config.ts` finds the data folder using `process.cwd()/../data`. Starting Vite from anywhere else makes Lira read and write the wrong folder.

On first load, Lira reads `data/` from disk into the browser's IndexedDB. After that, every change is written back to `data/spaces/<KEY>.json`. The top bar shows `PC Saved` when the write finishes.

---

## 6. Commands reference

All commands run from `lira-app/`.

| Command | What it does |
|---|---|
| `npm run dev` | Starts the dev server with hot reload and the disk-sync API. **Restart it after switching branches or pulling changes** that touch `tailwind.config.js` (Tailwind reads its config once at start) |
| `npm run build` | Type-checks (`tsc -b`) then builds to `lira-app/dist/` |
| `npm run preview` | Serves the built `dist/` for a quick check |
| `npm run lint` | Runs Oxlint |
| `npx tsc -b` | Type-check only (fast, good before a commit) |
| `npm test` | Runs the unit and integration tests (Vitest) |
| `npm run test:watch` | Tests in watch mode |

> **Disk sync only works with `npm run dev`.** The `/api/data` and `/api/save` endpoints are a Vite dev-server plugin. `npm run preview` and a deployed `dist/` serve the app but cannot write to `data/`. They use browser storage only.

---

## 7. How data is stored

Everything you create or change is saved to JSON files in `data/`, so clearing browser data loses nothing. The browser (IndexedDB and localStorage) is only a fast cache.

| What | File on disk |
|---|---|
| Spaces and tickets | `data/spaces.json`, `data/spaces/<KEY>.json`, `data/lira-workspace.json` |
| Projects and project settings | `data/projects.json` |
| Roadmaps | one file each: `data/roadmaps/<id>.json`, plus `data/roadmaps/index.json` |
| Sprint goals, capacity, retrospectives, closed sprints, planned sprints, weekly / bi-weekly / N-day sprint definitions | `data/sprints.json` |
| Teams and added team members | `data/teams.json` |
| Standups and standup notes | `data/standups.json` |
| WIP limits, board settings, attachments, documents, forms | `data/board-config.json` |
| Theme, profile, sidebar, notification and Viva AI settings | `data/settings.json` |
| Gemini API key | `data/private/secrets.json` (**git-ignored**, never committed) |

How it works:
- Writes happen about half a second after each change, through the dev server (`/api/save` for tickets, `/api/kv` for everything else).
- A file is only rewritten when its content really changed, and keys are sorted, so git diffs stay small.
- On startup, files are loaded back into the browser before the app renders. If a key exists only in the browser (for example data from before this feature), it is kept and written to disk. If both have it and differ, **disk wins**, unless the browser has unsaved changes.
- Backups (**Export JSON Backup**) include all of the above except the API key. Import restores them and reloads the page.
- The same data is also projected into Dexie tables (`projects`, `sprints`, `teams`, `standups`) after every change, so screens can query it with `useLiveQuery`. These tables are a read-only copy; the JSON files stay the source of truth.
- Tickets follow the same rule: disk wins on load, unless the browser has ticket changes that were not saved yet (for example the tab closed within the save delay). Then the browser copy is pushed to disk instead.
- To keep the data somewhere other than `../data` (for example for a throwaway test), start the server with the `LIRA_DATA_DIR` environment variable set to that folder.
- Disk saving needs `npm run dev`. Without it the app still works using browser storage only.

Committing: ticket and settings files are normal repo files. Commit them when you want to share workspace state, or run `git checkout -- data/` before a code-only commit. Do not commit `data/private/`.

---

## 7b. Pages and URLs

Every page has its own address, so refresh, Back/Forward and shared links work.

| URL | Page |
|---|---|
| `/for-you` | For you |
| `/space/<KEY>/<tab>` | A space: `summary`, `board`, `list`, `calendar`, `sprints`, `capacity`, `forms`, `documents`, `attachments`, `reports` |
| `/projects`, `/projects/<id>` | Projects, one project |
| `/sprints`, `/sprints/2026-11`, `/sprints/2026-11-09` | Sprints overview, one monthly sprint, one weekly / bi-weekly / N-day sprint (named by its start date) |
| `/tickets` | All tickets |
| `/roadmaps`, `/roadmaps/<id>` | Roadmaps, one roadmap |
| `/filters` | Filters |
| `?issue=LIRA-12` | Added to any page: opens that ticket's popup, for example `/roadmaps/rm-lira?issue=LIRA-61` |

The route table is in `lira-app/src/routes.ts`. Unknown spaces or projects show a "not found" page instead of a blank screen.

If you add a page, add it to `routes.ts` and to the `<Routes>` in `App.tsx`.

---

## 8. Optional: Viva AI with Gemini

Viva AI (the chatbot at the bottom right) works out of the box with the built-in local agent, which can read and write tickets.

To use Gemini for free-form answers:
1. Get a key from Google AI Studio.
2. Open Viva AI, then the settings (gear) icon.
3. Paste the key and save.

The key is kept in your browser's localStorage.

---

## 9. Verify your setup

After `npm run dev`:
- [ ] The app loads and shows the For you page and the spaces in the sidebar.
- [ ] Open a space board and drag a ticket between columns.
- [ ] The top bar shows `PC Saved`, and the matching `data/spaces/<KEY>.json` has a new modified time.
- [ ] Toggle dark mode from the account menu (top right).
- [ ] `http://localhost:5173/api/health` returns JSON with `"status":"ok"` and non-zero counts.

---

## 10. Troubleshooting

| Problem | Cause and fix |
|---|---|
| `npm install` fails with engine/Node errors | Node is too old. Upgrade to 20.19+ or 22.12+. |
| `npm : ENOENT package.json` | You are in the repo root. `cd lira-app`. |
| App loads but is empty, `/api/health` shows 0 spaces | Server started from the wrong folder. Stop it and run `npm run dev` from `lira-app/`. |
| Port 5173 is busy | Vite picks the next free port and prints it. Or run `npm run dev -- --port 5180`. |
| Dark mode or styles look wrong after pulling changes | Tailwind config changed. Stop the server, run `npm run dev` again (hot reload does not reload `tailwind.config.js`). |
| Stale or odd data | Clear the site's data (DevTools, Application, Storage, Clear site data) and reload. Tickets reload from `data/`. Browser-only data (projects, sprint goals, teams) is lost, so export a backup first. |
| Changes saved in the UI but not on disk | You are on `npm run preview` or a built copy. Use `npm run dev`. |
| Windows line-ending warnings from git | Normal (CRLF/LF). Ignore, or set `git config core.autocrlf true`. |

---

## 11. Before you open a pull request

```bash
cd lira-app
npx tsc -b        # must pass with no errors
npm test          # must pass
npm run build     # must succeed
npm run lint
```

Tests cover the sprint logic, standup and invite builders, AI intent parsing, and the disk-persistence layer (including a test that wipes the browser and restores from disk).

## Animations

Motion uses `framer-motion`, set up in one file: `src/components/common/motion.tsx` (springs, dialog / menu / toast animations, count-up numbers, growing bars). Confetti is in `components/common/Confetti.tsx`; call `celebrate()` from `utils/celebrate.ts` to trigger it (it fires when a ticket reaches Done and when a sprint is closed). Use those pieces for anything new so it feels the same everywhere. People who ask their system for reduced motion get no movement, no count-up and no confetti.
