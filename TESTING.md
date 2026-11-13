# Testing Lira

How Lira is tested automatically, what each test protects, how to run them and how to add more.

**Right now:** 1732 automated tests in 154 files, plus a 15-check data health run. All pass. They need **no extra tools or services**: everything runs on what `npm install` already installs (Vitest, a fake browser called jsdom, and a fake database).

**Done by hand:** [`docs/04-quality/manual-test-checklist.md`](docs/04-quality/manual-test-checklist.md) lists every screen to click through after the refactor.

**Not yet automated:** clicking through the real app in a real browser (end-to-end tests). That is planned for the DevOps phase, with a full checklist in [section 7](#7-end-to-end-browser-tests-planned-for-the-devops-phase).

---

## 1. Run the tests

Run every command from the `lira-app` folder.

| Command | What it does | Time |
|---|---|---|
| `npm test` | All 1732 automated tests (code, screens in a fake browser, server, rules about the source, documents) | about 40 s |
| `npm run test:watch` | Re-runs the tests that matter each time you save a file | |
| `npm run test:health` | **Data health check**: reads your real `data/` folder and checks it holds together. Changes nothing | about 3 s |
| `npm run test:all` | Everything in one go: type check, lint, `npm test`, then the data health check | about 1 min |
| `npm run lint` | Style and mistake checker (oxlint). It must report **0 warnings** | |
| `npm run build` | Type check and the production build | |
| `npm audit` | Looks for known security problems in packages | |

Run one file: `npx vitest run src/utils/helpers.test.ts`. Run tests whose name contains a word: `npx vitest run -t "Blocked"`.

**Before you open a pull request:** `npm run test:all`, `npm run build` and `npm audit`.

---

## 2. The kinds of test

| Kind | Where | What it proves | Tools |
|---|---|---|---|
| **Logic tests** | `src/utils/`, `src/services/`, `src/hooks/` | The rules and numbers are right: sprints, reports, roadmaps, dashboards, statuses, dates, the AI agent, saving | Vitest |
| **Screen tests** | `src/components/**/*.test.tsx` | A piece of the interface behaves as a person expects when clicked and typed into | Vitest + jsdom + `src/test/render.tsx` |
| **Server tests** | `server/*.test.ts` | The local API is safe and writes the right files | Vitest (Node) |
| **Rules about the source** | `src/hygiene.test.ts` | Promises about the code stay true (see 4) | Vitest reading the files |
| **Document checks** | `src/hygiene.test.ts` | Documents match the code: commands exist, links work | Vitest reading the files |
| **Data health** | `tests/health/` | Your real workspace files are consistent (see 5) | Vitest (Node), run by hand |

---

## 3. What is covered, by feature

| Feature | Tests (file and what it checks) |
|---|---|
| **Ticket statuses and Blocked** | `src/utils/status.test.ts` four statuses, Blocked is a switch not a status, sprint counts by the switch. `src/components/issue/detail/BlockedToggle.test.tsx` the pill, the picker (open tickets only, never itself), several blockers, chips with a cross, no second popup when already blocked, "This ticket is blocking" list. `src/utils/standupBlocked.test.ts` blocked tickets in the standup |
| **Comments** | `src/utils/helpers.test.ts` a comment needs text or a file, only the author can edit it. `src/components/common/savedAndMonths.test.tsx` comment ownership. `src/utils/status.test.ts` day, date and time of a comment. `src/components/common/CopyButton.test.tsx` the Copy button |
| **Descriptions, pictures, mentions** | `src/utils/richText.test.ts` older Markdown opens formatted, pictures stored once, plain text for search and AI, mentions |
| **Attachments** | `src/components/issue/AttachPicker.test.tsx` the attach window: five sources, share links, bad addresses refused, files staged and removed, contents read. `src/utils/helpers.test.ts` file sizes, small files kept inside the ticket, big ones by name only |
| **Filters (space, sprint, dashboards)** | `src/components/common/FilterMultiSelect.test.tsx` checkboxes, search, clear, closes on Escape and page scroll, stays open when its own list scrolls, single choice. `src/components/sprints/SprintFilter.test.tsx` Status and Space side by side, Blocked option, clear. `src/utils/helpers.test.ts` the status rule incl. Blocked |
| **Date picker and calendar chooser** | `src/components/common/DatePicker.test.tsx` Monday start, pick a day, min and max, clear, month and year chooser, Escape. `src/components/common/dialogs.test.tsx` date helpers |
| **Open in new tab** | `src/components/common/LinkMenu.test.tsx` right-click menu, Open in new tab, Copy link, middle-click, Ctrl+click, text fields keep the browser menu. `src/utils/helpers.test.ts` the address of every kind of item |
| **Keeping the page in place** | `src/utils/keepPlace.test.ts` the pressed element stays put, blank space added only when needed and removed later |
| **Saved card and dialogs** | `src/components/common/savedAndMonths.test.tsx`, `src/components/common/dialogs.test.tsx` the animated "saved" card, Lira's own confirm, prompt and alert |
| **Animations** | `src/components/common/motion.test.tsx` counting up, bars, confetti, when to celebrate |
| **Dashboards** | `src/utils/dashboards/dashboards.test.ts` all numbers, filters, charts data, lists, alerts, build from a sentence, weekly schedule, saving. `src/components/dashboards/dashboards.ui.test.tsx` **every one of the 51 widgets draws** (with and without tickets), the grid (move, resize, remove, settings, own filters, drill-down), the dashboards page, the wizard end to end. `server/dashboardsStore.test.ts` `data/dashboards.json`. `server/snapshots.test.ts` weekly snapshot files |
| **Space summary, list sorting, board columns** | `src/utils/summaryStats.test.ts` the numbers on a space's Summary page (status counts, overdue, epic progress, top labels). `src/utils/issueSort.test.ts` list sorting (keys in number order, priority, dates). `src/components/board/boardColumns.test.ts` columns for each grouping, filters, ranking a dropped card, WIP limits. `src/utils/calendarGrid.test.ts` the calendar's weeks (Monday first, padding, year changes). `src/utils/projectKey.test.ts` project keys. `src/utils/projectFilter.test.ts` the Projects list search, filter and sort. `src/utils/roadmapFilter.test.ts` the roadmap's search, lane, owner, status and period filters. `src/utils/issueSearch.test.ts` the Filters page (every filter together, Blocked, recent only, sorting, CSV). `src/utils/newIssue.test.ts` the ticket the Create form saves. `src/utils/hierarchy.test.ts` which ticket may sit under which. `src/utils/notifications.test.ts` what the bell lists. `src/utils/userPrefs.test.ts` profile, language and notification settings. `src/utils/currentUser.test.ts` who "me" is and which tickets are mine. `src/db/seed.test.ts` the sample workspace. `src/services/ai/intentGolden.test.ts` how Viva understands sixty typical requests (recorded from the original parser) |
| **Sprints** | `src/utils/sprintUtils.test.ts`, `src/utils/sprintDurations.test.ts`, `src/utils/sprintDelete.test.ts`, `src/utils/sprintReports.test.ts` keys, lengths, overlap, deleting, burndown, burnup, cumulative flow, lead and cycle time, exports |
| **Roadmaps** | `src/utils/roadmapUtils.test.ts`, `src/utils/roadmapSchedule.test.ts`, `src/utils/roadmapChecklist.test.ts`, `src/services/roadmapEpics.test.ts`, `src/services/roadmapChecklist.test.ts`, `src/hooks/useRoadmaps.test.ts` timeline, progress, dependencies, planner drag and drop, checklists, upgrades |
| **Standups** | `src/utils/standupUtils.test.ts` agenda, teams, invites |
| **Viva AI** | `src/services/aiAgent.test.ts`, `src/services/aiIntent.test.ts`, `src/services/aiPhase6.test.ts`, `src/services/aiSecurity.test.ts` reading, writing, preview and undo, sprint prompts, model choice, prompt-injection |
| **Navigation and URLs** | `src/routes.test.ts`, `src/routesDashboards.test.ts` every page address, the ticket popup parameter. `src/components/layout/sidebarConfig.test.ts` sidebar settings. `src/components/common/PageBoundary.test.tsx` one page crashing does not take down the rest |
| **Saving your data** | `src/services/kvMirror.test.ts`, `src/services/kvMirror.integration.test.ts`, `src/services/localDiskSync.test.ts`, `src/services/structuredStore.test.ts`, `server/diskStore.test.ts`, `server/spaceStore.test.ts` which copy wins on startup, only changed files rewritten, one file per roadmap and space |
| **Security of the local API** | `server/guard.test.ts` who may call it, one rule at a time (Host first, Origin must match Host, every changing method needs JSON), headers, file names, request size, the tablet and phone link rules. `server/spaceStore.test.ts` orphan tickets, the manifest, bare-list and unreadable space files, migration of the old single file |
| **Reset-on-change and latest-value hooks** | `src/hooks/useResetWhen.test.tsx` runs on the first render, keeps what was typed while its inputs stay the same, starts again when one changes, counts as a dependency list. `src/hooks/useLatest.test.tsx` always the newest value, one stable ref |
| **Active space, hidden and archived spaces** | `src/hooks/useSpacePrefs.test.tsx` follows the address, remembers the space, falls back to CERT or the first space, hide / archive / un-hide, unreadable saved lists |
| **Browser storage and the clock** | `src/utils/appStorage.test.ts` passes reads, writes and errors through. `src/utils/clock.test.ts` follows a faked clock |
| **Date keys** | `src/components/common/dateKeys.test.ts` write and read `YYYY-MM-DD`, bad input, pretty format, the Monday-first month grid |
| **Which space Viva means** | `src/services/ai/spaceMatch.test.ts` key, full name, name words, aliases, in that order; spaces added later |
| **Dashboard numbers behind the cards** | `src/utils/dashboards/metricsTables.test.ts` every stat card's number equals the tickets behind it, hand-checked counts, grouping order and folding, each filter on its own |
| **Ticket popup (the draft)** | `src/components/issue/detail/useIssueDetail.test.tsx` draft vs saved ticket, what counts as unsaved, save, empty title, close and Escape with and without changes, type change (epic, subtask with children), parent, blocked, comments saved at once, child tickets, delete. `src/components/issue/detail/ticketDraft.test.ts` the same rules as plain functions |
| **Create ticket dialog** | `src/components/issue/CreateIssueModal.test.tsx` space picker, type rules, parent lists, required fields, save, failure, reset. `src/components/issue/createIssueForm.test.ts` parent candidates, sprint choices, what is missing |
| **Rich text editor** | `src/components/common/richtext/RichTextEditor.test.tsx` full and compact toolbar, read-only, content and Markdown, menus, Ctrl+Enter. `src/components/common/richtext/editorAttachments.test.ts` links, pictures, too-big files, screenshot names |
| **Roadmap item dialog** | `src/components/roadmap/ItemModal.test.tsx` epic banner, validity rules, what is saved, checklist, dependencies, remove. `src/components/roadmap/itemDraft.test.ts` the same rules as plain functions |
| **Roadmap planner** | `src/components/roadmap/PlannerView.test.tsx` bars and chips, dashed unscheduled tickets, click versus drag, edge drags, tip. `src/components/roadmap/plannerDrag.test.ts` what a drag and a drop mean |
| **Sprints page** | `src/components/sprints/SprintsPage.test.tsx` the four views, rollover and stranded prompts, space shortcuts, locked to one space |
| **Viva chat messages** | `src/components/ai/ChatBubble.test.tsx` text, refined goal (assistant only), Confirm and Cancel and what was decided, Undo (singular and plural) and "Undone", dashboard link, ticket link, follow-up suggestions |
| **Filters page results table** | `src/components/filter/page/ResultsTable.test.tsx` count, empty state and reset, row contents, label chips (three and "+N"), status colours, Blocked badge, assignee fallbacks, space button does not open the ticket, which headings sort |
| **Create sprint dialog** | `src/components/sprints/CreateSprintModal.test.tsx` monthly, weekly and number-of-days forms, preview text, overlap warning, "Open sprint" for a planned month, goal saved, starts again each time it opens. `src/components/sprints/sprintDraft.test.ts` the validity and overlap rules and what is saved |
| **Filter dropdown placement** | `src/components/common/filterPlacement.test.ts` opens below or above, stays inside the window, never shorter than 120 or taller than the room |
| **Subtask suggestions** | `src/services/ai/subtasks.test.ts` each keyword group, the default breakdown, first match wins, always four open subtasks |
| **Older Markdown descriptions** | `src/utils/markdownBlocks.test.ts` paragraphs, headings, both list kinds, checklists, quotes, code blocks (also an unclosed one), where a block ends |
| **Which data file a setting lives in** | `src/services/kvMirrorFiles.test.ts` every rule of the table, exact keys against prefixes, API keys always in secrets |
| **Space icons** | `src/utils/spaceIcon.test.ts` every icon name, the emoji older spaces saved, unknown text falls back to the folder. `src/components/common/SpaceIcon.test.tsx` a line icon is drawn (never the saved text), the picker offers every icon and reports the one clicked |
| **Child issues and links** | `src/utils/ticketLinks.test.ts` the four relations and their other ends. `src/components/issue/detail/blockLinks.test.ts` the other ticket gets the reverse link, "blocks" switches it to Blocked, removing undoes only its own end. `src/components/common/TicketPicker.test.tsx` search, type filter, several choices, a relation per ticket, create from a name. `src/components/issue/ticketLists.test.tsx` the child list, the linked list, the label box. `src/utils/hierarchy.test.ts` the type one level down |
| **Labels** | `src/utils/labels.test.ts` adding by comma or Enter without repeats, what a ticket inherits from its parent, removal follows the parent. `src/services/labelPropagation.test.ts` epic to tasks to subtasks and bugs, only changed tickets are written, a parent loop stops |
| **Comment not lost on Save changes** | `src/components/issue/detail/useIssueDetail.test.tsx` save it, discard it or keep editing. `src/components/issue/commentUtils.test.ts` what counts as a comment, no length limit. `src/components/common/dialogs.test.tsx` the three-way dialog |
| **New tickets start in Backlog or To Do** | `src/utils/newIssue.test.ts`, `src/components/issue/CreateIssueModal.test.tsx`, `src/services/aiAgent.test.ts` (Viva too) |
| **Typing is never a shortcut** | `src/utils/isEditable.test.ts` text boxes, dropdowns and the rich text editors |
| **Roadmap calendar fits its panel** | `src/utils/roadmapUtils.test.ts` the range is trimmed to the work with four days of room, days widen to fill the panel and never go below the scale, header cells follow. `src/utils/roadmap/milestoneLabels.test.ts` milestone labels stack in as many rows as needed. `src/hooks/useElementWidth.test.tsx` the measured width |
| **Logo** | `src/components/common/LiraLogo.test.tsx` drawn in the page (no image file), the arrow grows from the corner on load and on hover, loops while starting, takes its size and colour from the caller |
| **App switcher and version** | `src/components/layout/topnav/AppLauncher.test.tsx` opens, shows the version and five destinations, runs the chosen one, closes on Escape. `src/utils/appVersion.test.ts` the version is written in one place |
| **Theme and colours** | `src/utils/theme.test.ts` the dark theme and the two light palettes (Sorrel, Fawn): saved and applied only on Save, the stylesheet uses exactly the colours in `theme/palette.ts`, and text, links and button labels stay readable in all three. `src/components/layout/settings/AppearanceSection.test.tsx` and `src/components/layout/topnav/SystemSettingsModal.test.tsx` choosing Light asks which palette, nothing changes until Save |

---

## 4. Rules about the source (`src/hygiene.test.ts`)

These read the code files and fail if someone breaks a promise. Each is cheap and catches mistakes no other test would.

- No other product's name anywhere in the code, styles, page, or documents.
- No browser pop-ups (`confirm`, `prompt`, `alert`): Lira has its own dialogs.
- No native `<input type="date">`: Lira has its own date picker.
- No emojis in the interface. Only the icons chosen for spaces may use them.
- Nothing puts text on the page as raw HTML, and nothing runs code from a string (`dangerouslySetInnerHTML`, `eval`, `new Function`). The two places allowed to write HTML directly are named in the test.
- No leftover `console.log`.
- Every `window.open` uses `noopener` or a checked address.
- Every page in the route table is handled in `App.tsx`; every data file is known to the disk store and the settings mirror.
- No secrets (keys, tokens, private keys) written in the code.
- The production build does not publish source maps.
- **Quality ratchets** (things that were cleaned up must stay clean): saved settings go through `appStorage`; no one-off pixel text sizes; no `any`; palette colours are not written out as hex again; the palette holds valid, unique colours; suppressions of the hooks rule do not grow (the cap is in the test; lower it when one is fixed); the documents agree on the test count.
- **Documents:** every `npm run ...` command they mention exists, every link to another file works, and every test file this document names exists.

If one of these fails, the message names the file. Fix the file, or, if the new code is a deliberate exception, add it to the allowed list in the test and say why in a comment.

---

## 5. Data health check (`npm run test:health`)

Reads your real workspace (the `data/` folder, or the folder in `LIRA_DATA_DIR`) and reports problems. It **never changes anything**. It is separate from `npm test` because it tests your data, not the code, and your data changes every day.

**Unit tests never read your data.** Every test in `npm test` builds its own small tickets and spaces in memory (with a fake database), so the result is the same on every machine whatever data is in the app. The health check is the only thing that reads a real workspace, so treat it as an optional "is my workspace OK" tool. A person with different data can get different health results; that is expected. When the CI pipeline is built, it will run the health check on a small fixed sample workspace so the result is always the same.

It checks:

- Every JSON file can be read, and every space has a unique key and its own ticket file.
- Ticket ids and keys are unique, and each key starts with its space's key.
- Every ticket has a known status, priority and type, and a title.
- Parents, epics and blockers point at tickets that exist, never at themselves, with no parent loops.
- A ticket switched to Blocked says what blocks it, and two tickets never block each other.
- Dates are real dates; sprint keys and story points are valid.
- Comments and attachments are well formed.
- Saved dashboards use widgets and filters Lira knows; roadmap items name epics that exist.
- No secrets in the shared data files.

A few things are printed as "worth a look" instead of failing (for example a ticket entered with a finish date before its creation date).

Use it after hand-editing the JSON files, after a merge, or before sharing the `data/` folder.

---

## 6. Writing a new test

1. Put it next to the thing it tests: `thing.test.ts` or `thing.test.tsx`.
2. Name each test as a sentence about what a person sees: "pressing Blocked again when it is already on does not ask again", not "test1".
3. **A logic test** needs only `describe`, `it`, `expect`. Build tickets with `makeIssue()` and spaces with `makeSpace()` from `src/test/factories.ts`.
4. **A screen test** uses the helpers in `src/test/render.tsx` (no testing library needed):

```tsx
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, click, mount, q, settle } from '../../test/render';

afterEach(cleanup);

it('calls back with the value that was ticked', async () => {
  const onToggle = vi.fn();
  mount(<FilterMultiSelect label="Priority" options={[{ value: 'high', label: 'High' }]} selected={[]} onToggle={onToggle} />);
  await click(q('[data-testid=filter-priority]'));
  await settle();
  await click(q('input[type=checkbox]'));
  expect(onToggle).toHaveBeenCalledWith('high');
});
```

   - `mount`, `click`, `typeInto`, `press`, `settle`, `q`, `qa`, `byText`, `cleanup`.
   - Wrap screens that use links in `<MemoryRouter>`.
   - Tests that read the ticket database start with `import 'fake-indexeddb/auto'`.
   - Give interface parts a `data-testid` when there is no better way to find them.
5. Run `npx vitest run path/to/file.test.tsx`, then `npm run test:all`.
6. Add a row to the table in section 3 (the document check makes sure the file you name exists).

**What a fake browser cannot do:** jsdom has no layout (no real sizes, positions or scrolling) and does not run the rich text editor reliably. Anything that depends on those belongs in the browser tests of section 7. `src/utils/keepPlace.test.ts` shows how to fake sizes for one piece of logic.

---

## 7. End-to-end browser tests (planned for the DevOps phase)

These click through the real app in a real browser and are the missing layer. Until they exist, each change is checked by hand against this list. The list is written so it can become the test suite as it stands.

**Plan**

| Step | What |
|---|---|
| Tool | Playwright (Chromium, plus Firefox and WebKit for the final run) |
| Data | Each run copies `data/` to a temp folder and starts the app with `LIRA_DATA_DIR` pointing at it, so real data is never touched |
| Where | A `tests/e2e/` folder next to `tests/health/`, to be run by a `test:e2e` script added at that time |
| CI | GitHub Actions: install, `tsc -b`, lint, `npm test`, `npm run test:health` (on the sample data), `npm run build`, `npm audit`, then E2E against the built app. Screenshots and traces are kept for failed runs |
| Gates | A pull request cannot merge unless all of these pass |
| Later | Test coverage report (`vitest --coverage`), visual comparison of key pages, accessibility scan (axe), performance budget for the production bundle |

**Checklist to automate**

1. **Ticket popup:** edit a field and the title; nothing is saved until Save changes; closing with changes asks first; Save closes it; Save with no change shows no "saved" card; the saved card has a ring around the cross that empties in 3.8 seconds and closes on click.
2. **Blocked:** turning it on opens the picker; several tickets; chips with a cross; pressing Blocked again does nothing; the board card shows "Blocked by KEY +N"; the blocker lists what it blocks; flames burn while on.
3. **Comments and descriptions:** paste a screenshot (Ctrl+V) into each; the picture stays where it was pasted; files show under "Added in comments"; edit your own comment (and cannot edit another's); Copy buttons; the paperclip opens the attach window, never the system dialog.
4. **Attach window:** drag files; share link for Drive, OneDrive, Dropbox; bad addresses refused.
5. **Settings and theme:** theme and light palette apply only on Save, everywhere they can be set; profile removed from the account menu; each Save closes its window.
6. **Spaces:** tab bar in one rounded background with a sliding pill; filters (Priority, Status, Labels) with checkboxes, search, multi-select; dropdowns close on page scroll and stay inside the screen near the bottom.
7. **Sprint page:** six stat boxes in one row; one ticket box with select-all (tick, untick, dash when partial), title that follows the Status filter, Status and Space filters in its heading; the page does not jump to the top when ticking, opening a ticket, filtering to nothing, collapsing, or switching sections; velocity bars grow again when switching sprints.
8. **Animations:** numbers count up from 0 and bars fill on For you, Projects, a project's Overview, Sprints overview and table, a sprint's Reports, Roadmaps, a roadmap, a space Summary (including the completion ring and epic bars); the For you sprint bar fills green into blue as one movement; figures lower on a page start only when scrolled into view.
9. **Open in new tab:** right-click any ticket, sprint, project, roadmap, space or sidebar item; middle-click and Ctrl+click; data saved before the new tab opens.
10. **Calendar and dates:** month and year chooser on the calendar page and in every date field.
11. **Dashboards:** template to wizard to dashboard; describe-it builder; Viva builds one; customise (drag, resize, settings, own filters, add, remove); drill-down; alerts; weekly snapshot file written to `data/snapshots`; export picture, print, Markdown, JSON; import; reload keeps everything.
12. **Delete flows:** every delete asks in Lira's own dialog; Cancel and Escape keep the item.
13. **Phone and tablet widths:** no sideways scrolling; the sidebar drawer opens and closes.
14. **Light and dark theme:** key pages readable in both.
15. **Security smoke test:** the local API refuses a request from another site (cross-origin) and a wrong host; the tablet link needs its secret.
16. **Data survives:** edit tickets, reload, restart the dev server, and everything is still there; the `data/` files changed only where expected.

---

## 8. Known gaps

- No end-to-end tests yet (section 7).
- The rich text editor (TipTap) and anything that needs real layout are checked only in a real browser by hand.
- No coverage percentage is reported yet; it is planned with the DevOps phase.
- The data health check reads your files but cannot tell whether the content is *right*, only that it is consistent.

## 9. If a test fails

- Run just that file: `npx vitest run path/to/file.test.tsx`.
- A failure in `src/hygiene.test.ts` names the file that broke a rule.
- A failure in `npm run test:health` names the ticket and what is wrong with it; fix it in the ticket, or edit the JSON file carefully and run it again.
- A screen test that fails only sometimes usually needs `await settle()` after an action that animates.
