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

The checked-out branch matters. The latest work is on `v3.1` (earlier work is on `v3`, and `main` is the release branch):

```bash
git checkout v3.1
```

---

## 3. Repository layout

```
Lira/                      <- repo root
├── data/                  <- your workspace data (JSON files, committed to git)
│   ├── spaces.json        <- manifest of all spaces
│   ├── spaces/<KEY>.json  <- one file per space, holding its tickets
│   ├── lira-workspace.json<- consolidated snapshot
│   ├── projects.json, sprints.json, teams.json, standups.json, dashboards.json, settings.json, board-config.json
│   ├── roadmaps/          <- one file per roadmap
│   └── private/           <- git-ignored: API key, tablet link secret, audit log
├── lira-app/              <- the web app (run every command from HERE)
│   ├── server/            <- disk store and the API guard (who may call the local API)
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

To use Lira from a tablet or phone on the same Wi-Fi, start it with `npm run dev:lan` instead (see section 13).

> **Important: always start the server from `lira-app/`.**
> `vite.config.ts` finds the data folder using `process.cwd()/../data`. Starting Vite from anywhere else makes Lira read and write the wrong folder.

On first load, Lira reads `data/` from disk into the browser's IndexedDB. After that, every change is written back to `data/spaces/<KEY>.json`. The top bar shows `PC Saved` when the write finishes.

---

## 6. Commands reference

All commands run from `lira-app/`.

| Command | What it does |
|---|---|
| `npm run dev` | Starts the dev server with hot reload and the disk-sync API. **Restart it after switching branches or pulling changes** that touch `tailwind.config.js` (Tailwind reads its config once at start) |
| `npm run dev:lan` | Same as `dev`, and also opens Lira to your own Wi-Fi for a tablet or phone, behind a private link (see section 13) |
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
| Dashboards (widgets, filters, alerts, snapshot schedule) | `data/dashboards.json` |
| Weekly dashboard snapshots | `data/snapshots/<name>-<date>.md` |
| WIP limits, board settings, attachments, documents, forms | `data/board-config.json` |
| Theme, profile, sidebar, notification and Viva AI settings | `data/settings.json` |
| Which spaces work in each sprint, sprint capacity and retrospectives | `data/sprints.json` (with the other sprint data above) |
| Gemini and other model API keys | `data/private/secrets.json` (**git-ignored**, never committed) |
| The private link secret for tablets and phones, and a record of what was saved and when | `data/private/lan-token`, `data/private/audit.log` (**git-ignored**) |

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
| `/dashboards`, `/dashboards/new`, `/dashboards/<id>` | Dashboards, the new-dashboard wizard (`?scenario=sprint-health` starts from a template), one dashboard |
| `/filters` | Filters |
| `?issue=LIRA-12` | Added to any page: opens that ticket's popup, for example `/roadmaps/rm-lira?issue=LIRA-61` |

The route table is in `lira-app/src/routes.ts`. Unknown spaces or projects show a "not found" page instead of a blank screen.

If you add a page, add it to `routes.ts` and to the `<Routes>` in `App.tsx`.

---

## 8. Viva AI

Viva AI (the chat button at the bottom right) works out of the box with the built-in engine, which can read and write tickets. Before it changes anything it shows what it will do and waits for **Confirm**; afterwards there is an **Undo** button (until the page is reloaded). You can turn the confirmation off in Viva's settings (gear icon).

Try: "Plan next sprint from my backlog", "Summarise this sprint", "Write my standup", "Show the risk radar", "Move LIRA-12 to in progress".

To use a model for free-form answers, open Viva's settings and choose **Model**:
- **Google Gemini**: paste a key from Google AI Studio.
- **OpenAI-compatible server**: for example Ollama (`http://localhost:11434/v1`, model `llama3.1`), LM Studio or a hosted service. Enter the base URL, model name and (if needed) a key.

Changes to tickets are always made by the built-in engine so they can be previewed and undone; the model only answers questions. Keys are stored in `data/private/secrets.json` (git-ignored), never in a file that is committed.

---

## 9. Verify your setup

After `npm run dev`:
- [ ] The app loads and shows the For you page and the spaces in the sidebar.
- [ ] Open a space board and drag a ticket between columns.
- [ ] The top bar shows `PC Saved`, and the matching `data/spaces/<KEY>.json` has a new modified time.
- [ ] Toggle dark mode from the account menu (top right).
- [ ] Open **Sprints**, then **New sprint**, and check that Monthly, Weekly, Bi-weekly and Number of days are offered.
- [ ] Ask Viva "move LIRA-2 to backlog": it should show a preview with Confirm, and Undo afterwards.
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
| `npm run dev` fails after pulling | New packages were added. Run `npm install`. |
| A tablet or phone shows "Lira needs its private link" | Open the link from **Settings, Other devices** (or the terminal) once on that device. |
| A tablet or phone cannot reach the computer | You started with `npm run dev`, not `npm run dev:lan`; or Windows Firewall blocks it (set the network to Private); or the computer's address changed (section 13). |
| "Request refused" in the browser console | Lira is being opened by a name it does not allow. Use `localhost`, or `dev:lan` and the computer's network address. |

---

## 11. Before you open a pull request

```bash
cd lira-app
npx tsc -b        # must pass with no errors
npm test          # must pass
npm run build     # must succeed
npm run lint
```

Tests (294) cover the sprint logic and reports, standup and invite builders, AI intent parsing and the confirm and undo flow, the disk-persistence layer (including a test that wipes the browser and restores from disk), the local API guard, routes, and the animation helpers.

---

## 11b. Editing, saving and dialogs

- **The ticket popup is a draft.** Edit anything, then press **Save changes**: the ticket is saved and the popup closes. Closing (X, outside click, Escape) with unsaved changes asks "Discard changes?". Comments and new child tickets have their own buttons and are saved at once.
- **Settings pages** (Appearance, Profile, General, Notifications) save with their **Save** button and close. The theme and the accent colour only change when you press Save, in all three places they can be set.
- **Dialogs:** confirm, prompt and alert boxes are Lira's own (`components/common/dialogs.tsx`: `confirmDialog`, `promptDialog`, `alertDialog`). Do not use `window.confirm`, `window.prompt` or `alert`.
- **Dates:** use `components/common/DatePicker.tsx`, not `<input type="date">`.
- **Descriptions** use the rich text editor (`components/common/richtext/`). They are stored as HTML written by the editor; Markdown from older tickets is converted when opened. Code that needs the text (search, Viva, suggestions) uses `descriptionToText` from `utils/richText.ts`.
- **Icons, not emojis:** ticket types and priorities use `TypeIcon` and `PriorityIcon` (`components/common/Icons.tsx`). The only emojis in Lira are the icons chosen for spaces.

---

## 11c. Dashboards (for developers)

- `src/utils/dashboards/`: `types.ts` (what is saved), `metrics.ts` (all the numbers: pure functions), `catalog.ts` (widget gallery and scenarios), `data.ts` (widget -> data), `promptBuilder.ts` (build from a sentence, also used by Viva), `snapshot.ts` (weekly Markdown), `store.ts` (saved in `localStorage` key `lira_dashboards`, mirrored to `data/dashboards.json`).
- `src/components/dashboards/`: the pages (`DashboardsHome`, `DashboardWizard`, `DashboardView`), the grid, the widgets and charts (plain SVG, no chart library), the modals, and `DashboardScheduler` (takes the weekly snapshots while Lira is open).
- To add a widget: add a type to `WidgetType`, a case in `widgetData` (data.ts) and in `WidgetBody` (Widgets.tsx), and an entry in `CATALOG`. `dashboards.test.ts` checks that every catalog entry computes with and without tickets.
- Snapshots are written by `server/snapshots.ts` (`POST /api/snapshot`); file names are reduced to letters, digits and dashes, and only `.md` files in `data/snapshots` can be read.
- The picture export uses the `html-to-image` package (MIT), loaded only when you press Export.

---

## 12. Animations

Numbers, percentages and bars that show a value use the shared pieces in `src/components/common/motion.tsx`, so every screen behaves the same: `CountUp` (a number rises from 0), `AnimatedValue` (the same for values like `44%` or `5d`), `GrowBar` (a bar fills from the left; give it `delay` so a second bar starts when the first has finished, as on For you), `GrowColumn` (a column grows from its base). `utils/keepPlace.ts` keeps the page where it is when a section is opened or closed. Use these instead of plain numbers and `style={{ width }}` when you add a figure to a page.

Motion uses `framer-motion`, set up in one file: `src/components/common/motion.tsx` (springs, dialog / menu / toast animations, count-up numbers, growing bars). Confetti is in `components/common/Confetti.tsx`; call `celebrate()` from `utils/celebrate.ts` to trigger it (it fires when a ticket reaches Done and when a sprint is closed). Use those pieces for anything new so it feels the same everywhere. People who ask their system for reduced motion get no movement, no count-up and no confetti.

---

## 13. Use Lira on a tablet or phone (same Wi-Fi)

Lira runs on your computer and normally only that computer can open it. To let your own tablet or phone in:

1. Start it with `npm run dev:lan` (in `lira-app`) instead of `npm run dev`.
2. On the computer, open **Settings, Other devices**. It shows the private link and a QR code (the same link is printed in the terminal). Scan the code with the tablet or phone camera, or open the link once. After that the device is remembered; you can bookmark the plain address without the `?key=...` part. Opening the plain address on a device that has never used the link shows a page that says what to do.
3. If the page does not load, Windows Firewall is probably blocking it. Set the Wi-Fi network to **Private** (Settings, Network and internet, Wi-Fi, your network, Private network), or allow Node.js through the firewall when Windows asks.

Good to know:
- The link is a password. Anyone with it, on your Wi-Fi, can read and change your tickets. Do not use this on public Wi-Fi. To cancel every device, delete `data/private/lan-token` and restart.
- The computer must be on and running Lira. Your router may give the computer a different address after a restart; reserve its address in the router, or use the name `YOURPC.local`.
- Every device keeps its own copy in its browser and saves to the computer's `data/` folder. It is not live: if two devices change tickets at once, the one that saves last wins. Refresh a device to see what another one saved.
- Your API key is never sent to other devices, and they cannot change it.
- On a phone or a tablet held upright the left panel becomes a menu: tap the round button at the bottom left. On a phone, search is the magnifier button in the top bar. Anything that only showed on hover (such as the "..." menus) is always visible on touch screens.

---

## 14. Security

The local API only answers Lira itself, links are checked, and the packages are audited. The full 20-point check, what was fixed and what still applies is in [SECURITY_REPORT.md](SECURITY_REPORT.md). Run `npm audit` before releases and after adding any package.
