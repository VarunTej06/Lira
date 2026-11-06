# Lira: Roadmap (Proposed)

Proposed build order for the next versions. It is a draft: pick a phase number to start and it will be broken into concrete tasks.

| # | Phase | Theme | Size |
|---|---|---|---|
| 1 | Persistence cleanup and core tests | Foundation | Medium |
| 2 | Routing and file splitting | Foundation | Medium |
| 3 | Teams feature, real standup and invites | Collaboration | Large |
| 4 | Sprint planning, rollover, retros, reports | Agile | Large |
| 5 | Command palette, bulk edit, saved filters | Productivity | Medium |
| 6 | Viva AI: confirm-and-undo, sprint-aware prompts | AI | Medium |
| 7 | Decide on multi-user | Architecture | Decision, then Very large |

Phases 1 and 2 make every later phase cheaper, so they should come first.

> The same plan now lives inside Lira as a real roadmap: open **Roadmaps** in the sidebar (timeline, Now/Next/Later, table). Every item is an epic in the LIRA space, and each roadmap is saved as its own file in `data/roadmaps/`. In the app it is the **November plan**: every item takes about two days and everything finishes in November (the phase descriptions below are unchanged). December gets its own roadmap. When you finish an item here, update it there too.

---

## Phase 1: Persistence cleanup and core tests (DONE)

> Completed. localStorage stays the runtime cache and every `lira_*` key is mirrored to JSON under `data/` (SETUP.md section 7). Dexie tables for projects, sprints, teams and standups are filled from it as a queryable read-only copy. Ticket saves only rewrite the space files that changed, and the load rule (disk wins unless the browser has unsaved changes) covers tickets too.

**Problem.** Tickets are saved to disk, but projects, sprint goals and closed state, planned sprints, team emails, standups and standup notes live only in browser localStorage. Clearing browser data loses them, and none of it reaches `data/` or git.

**Scope**
- Add Dexie tables: `projects`, `sprints` (goal, closed state, planned), `teams`, `standups`.
- Extend the disk-sync API and the `data/` layout to store them (for example `data/projects.json`, `data/sprints.json`, `data/teams.json`).
- One-time migration that reads the existing localStorage keys (`lira_sprint_meta`, `lira_planned_sprints`, `lira_scope_team:*`, project and standup keys) into the new tables, then marks them migrated.
- Make disk writes git-friendly: write only changed spaces, keep key order stable, and define a clear rule for which copy wins (disk or IndexedDB) on load.
- Include the new data in Export and Import backups.
- Add Vitest and unit tests for the pure logic: `sprintUtils` (month keys, rollover, stats, burndown), `standupUtils` (agenda rules, invite URLs, `.ics`), and AI intent parsing.

**Done when**
- Clearing browser storage loses nothing.
- A fresh clone shows projects, sprint goals and teams, not just tickets.
- `npm test` runs and passes in CI.

**Risks.** Migration bugs could lose data, so keep a backup export step and test with the current `data/` files.

---

## Phase 2: Routing and file splitting (DONE)

> Completed. React Router with the URL scheme in SETUP.md section 7b; one list of pages (`src/routes.ts`) instead of several copies; an error boundary around every page; the nested-button warning fixed. Every component is now at most about 500 lines (the sample-data file `src/db/seedData.ts` is the one exception). The large files were split into a small parent plus focused parts in a folder next to it, for example `components/projects/detail/`, `components/layout/sidebar/`, `services/ai/`, `utils/roadmap/`. Existing import paths still work.

**Problem.** Navigation is a set of `activeTab` strings in `App.tsx` with duplicated "global tabs" lists. There are no URLs, no back button and no deep links. Several files are very large (`ProjectDetailView`, `TopNavigation`, `aiAgentService`).

**Scope**
- Add a router with real paths, for example `/for-you`, `/sprints`, `/sprints/2026-11`, `/space/CERT/board`, `/projects/:id`, `/tickets`.
- Remove the duplicated tab lists; derive the sidebar highlight from the route.
- Split large components by tab or feature (one file per project tab, top bar menus as separate components, AI service into parser, executor and Gemini client).
- Fix the nested-`<button>` DOM warning.
- Add error boundaries per page.

**Done when**
- Refresh keeps you on the same page; back and forward work; links can be shared.
- No component file over about 500 lines.

---

## Phase 3: Teams feature, real standup and invites

**Scope**
- A real Team entity: name, members (name, email, role, capacity), assigned to spaces and projects.
- Replace the current "derived from assignees plus extras" list with the team assignment. Use it for standup invites, assignee pickers and the Capacity view.
- Standup history: store each session's notes and a "changed since yesterday" summary.
- Async standup: each member posts done, doing and blockers inside Lira.
- Real invites (needs a decision): connect Google Calendar and Microsoft Graph via OAuth so Lira creates the Meet or Teams event and sends it. This needs a small backend or hosted function, so it depends on the Phase 7 decision. Until then, keep the pre-filled invite links and `.ics` download.

**Done when**
- Creating a standup or sprint call invites exactly the assigned team's emails.
- Standup notes can be reviewed for past days.

---

## Phase 4: Sprint planning, rollover, retrospectives, reports (DONE)

> Completed. On the sprint page there are four views: Sprint, Planning, Reports and Epics.
> - **Sprint length.** Creating a sprint asks for the duration: Monthly, Weekly, Bi-weekly or a number of days (1 to 90). Weekly, bi-weekly and N-day sprints start on a date you pick and cannot overlap each other. Their key is the start date (`/sprints/2026-11-09`); their end date is kept in `lira_sprint_defs` in `data/sprints.json`. Monthly sprints work as before.
> - **Planning.** Backlog on the left, sprint on the right; drag across or use + and minus. Story points committed against a team capacity you type in (or the average of the last closed sprints), with an over-commit warning.
> - **Rollover.** A sprint that has ended with unfinished tickets shows "Carry them over?" on its page and on the sprints overview. Closing a sprint opens a dialog to pick the sprint to carry over to and to write the retrospective.
> - **Retrospective.** Went well, didn't, and actions (tick them off later). Saved with the sprint.
> - **Reports.** Burnup, cumulative flow, scope changes (added or removed after the first day), lead and cycle time. Export as Markdown, or PDF through the browser's print dialog.
> - **resolvedAt.** Set whenever a ticket moves to Done (from any screen) and cleared if it is reopened. Every status change is also logged on the ticket (`statusLog`), which is what the cumulative flow and cycle time use. Tickets changed before this release have no log, so their charts use the resolved date only.
> - **Epics.** A timeline of epics across the sprints with the ticket count in each.
>
> Not done: "Carry over" keeps all unfinished tickets together; choosing tickets one by one is done in Planning before closing.

**Scope**
- Planning view: backlog on the left, sprint on the right, drag and drop, running points total against team capacity, over-commit warning.
- Automatic month-end rollover prompt: "N unfinished tickets, carry them over?"
- Retrospective at sprint close (went well, didn't, actions), saved with the sprint.
- Reports: burnup, cumulative flow, scope-change log (added mid-sprint), cycle and lead time. Export as PDF or Markdown.
- Set `resolvedAt` whenever a ticket moves to Done, so burndown no longer falls back to "last updated".
- Epic roadmap: timeline of epics across the monthly sprints.

**Done when**
- A full cycle works end to end: plan, run, close, retro, report.

---

## Phase 5: Command palette, bulk edit, saved filters

**Scope**
- Ctrl+K palette: jump to any space, project, sprint or ticket; run actions such as "create bug in CERT".
- Keyboard shortcuts (`c` create, `/` search, `g b` board, `?` help).
- Bulk edit on board and list: status, assignee, sprint, labels.
- Saved filters, pinnable to the sidebar.
- Ticket templates and recurring tickets.

---

## Phase 6: Viva AI upgrades (DONE)

> Completed.
> - **Confirm and undo.** Viva explains a change first (move a ticket, add subtasks, create a ticket, plan a sprint) and waits for Confirm. After it runs, an Undo button puts every changed ticket back exactly as it was. Turn the confirmation off in Viva's settings if you prefer. Undo lasts until the page is reloaded.
> - **Sprint-aware prompts.** "Plan next sprint from my backlog" (highest priority first, within the sprint's capacity, only spaces that work in that sprint), "Summarise this sprint", "Summarise next sprint".
> - **Standup digest.** "Write my standup": done and started since the last working day, what is in progress, blockers.
> - **Risk radar.** "Show the risk radar" or "which tickets are idle": sprints behind their time, over-committed sprints, tickets idle for 5 days or more, overdue tickets.
> - **Suggestions while creating a ticket.** Possible duplicates, labels, a priority from urgency words, and the likely epic. Nothing is applied until you click a chip. Viva's create preview shows the same duplicate warning.
> - **Model choice.** Built-in engine (default), Google Gemini, or any OpenAI-compatible server such as Ollama or LM Studio (base URL, model, key). Changes to tickets are always made by the built-in engine so they can be previewed and undone; the model answers questions.
>
> Not done: undo does not survive a reload; the suggestions are word-overlap based, not a language model.

**Scope**
- Preview and confirm before writes, with Undo for each action. Especially for bulk changes.
- Sprint-aware prompts: "plan next sprint from my backlog", "summarise this sprint".
- Standup digest: "write my standup" from what changed.
- Suggestions at creation: labels, priority, likely epic, duplicate detection.
- Risk radar: sprints likely to miss their goal, tickets idle too long.
- Provider setting so a local or other model can be used.

---

## Phase 7: Decide on multi-user

Everything above works for a single user on one machine. A real team tool needs a backend: accounts, roles, live sync, notifications, and the OAuth work in Phase 3.

Decision to make:
- **Stay local and single-user**, sharing through git and exports. Cheapest, and no server to run.
- **Add a backend** (accounts, a real database, realtime). It is the biggest change and affects storage, auth and hosting.

Decide before starting Phase 3's real invites, since it changes how they are built.

---

## Cross-cutting, any phase

- Accessibility: focus rings, aria labels on icon buttons, dark-mode contrast, reduced-motion everywhere.
- Mobile and small-screen layout.
- Performance: virtualise long lists, avoid loading all issues for every view.
- Undo toasts for moves, deletes and bulk actions.
- Consistent empty states, modals, tooltips and button sizes.
- Light-mode and browser smoke tests (Playwright) for the pages not yet verified in a browser.

---

## Parking lot

Ideas not yet scheduled: GitHub integration (branch or PR linked to ticket, auto-move on merge), Slack and Teams notifications, Jira CSV import, time tracking and worklogs, notifications inbox with @mentions, dependency graph, automation rules, follow-system theme and accent colours, first-run onboarding tour.
