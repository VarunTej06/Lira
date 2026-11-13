# Keeping documents true

Stale documents are worse than none. Each fact has **one** owning document; others link to it instead of repeating numbers.

| Fact | Owning document | Update when |
|---|---|---|
| Test count, commands, timings | `TESTING.md` | Tests are added/removed, scripts change |
| Install, run, data folders, URLs, ports | `SETUP.md` | Scripts, folders or ports change |
| Feature list and what's new | root `README.md` | A user-visible feature ships |
| Roadmap, phase status | `ROADMAP.md` | A phase starts or finishes |
| Today's security check | `SECURITY_REPORT.md` | A control changes or a review is repeated |
| How it works today | `docs/01-architecture/current-state.md` | Architecture or data flow changes |
| Target design | `docs/01-architecture/HLD.md`, `LLD.md` | A decision record is accepted or a design changes |
| Decisions and their status | `docs/00-decisions/` | A decision is made or reversed |
| Rules for contributors and AI assistants | `CLAUDE.md`, `docs/02-security/secure-coding-standard.md` | A rule changes |
| Measured quality | `docs/04-quality/baseline-metrics.md` | Re-measured (at each milestone) |

## Checks anyone can run (a few minutes)
- Numbers: `npm test` count vs `TESTING.md`/`README.md`; `npm run lint` warnings vs baseline.
- Paths: every file or folder named in backticks in the docs exists (a small script can check this; it found no missing paths on 9 Nov 2026).
- Commands: every command in `SETUP.md` runs from a clean clone.
- Claims: "no server", "no accounts", "single user" are only true for the local edition and must say so.

## History
- 9 Nov 2026: test counts in `lira-app/README.md` and `SECURITY_REPORT.md` corrected (294 → 655); `Prompts and Architectures/04_Backend_and_Offline_Workflows.md` section 1 rewritten (it said "Lira has no server"); the multi-user decision recorded in `ROADMAP.md`, `PUBLIC_EDITION_PLAN.md` and `01_AppDesign.md`; a stale "purged Projects/Dashboards" line in `README.md` corrected.
- 9 Nov 2026 (second pass, after the code-quality refactor): test counts 655 to 738 and files 63 to 71 in `README.md`, `TESTING.md`, `SETUP.md`, `SECURITY_REPORT.md`, `lira-app/README.md` and the docs; new building blocks documented in `SETUP.md` section 11b; file locations updated where code moved (`dialogStore.ts`, `motionPresets.ts`); `baseline-metrics.md` gained an "after" table; `CLAUDE.md` gained the owner's rules. `src/hygiene.test.ts` now fails when the documents disagree on the test count.
- 9 Nov 2026 (third pass, complexity refactor): test counts 738 to 791 and files 71 to 74 everywhere; new test files listed in `TESTING.md`; `baseline-metrics.md` complexity rows and the remaining-work list refreshed.
- 9 Nov 2026 (fourth pass, component splits): test counts 791 to 859 and files 74 to 79; four component test files and two logic test files listed in `TESTING.md`; complexity rows refreshed.
- 9 Nov 2026 (fifth pass, all screens): test counts 859 to 1064 and files 79 to 90; test rows for the ticket popup, create ticket, editor, roadmap item dialog, planner and sprints page added to `TESTING.md`; `manual-test-checklist.md` added; complexity rows, score and the remaining-work list refreshed; hooks-rule suppression cap lowered from 10 to 9.
- 10 Nov 2026 (sixth pass): test counts 1064 to 1585 and files 90 to 138; manual checklist grew to A1–A20 and an Excel version (`Lira-manual-test-cases.xlsx`) was added; `vibe-check.md` and `scripts/vibe-check.mjs` added; `CLAUDE.md` gained the "Avoiding vibe-coded code" rules; complexity offenders 59 to 22, cognitive 8 to 5, long functions 92 to 80 (almost every component and hook above 13 was split, with tests written first; `SprintsPage`, `DatePicker`, `App` and `CreateIssueModal` are still over).
- 13 Nov 2026 (themes): the accent colour picker was removed and three themes added (Dark, and the light palettes Sorrel and Fawn). Test counts 1585 to 1602 and files 138 to 139; `TESTING.md`, `README.md`, `SETUP.md`, `lira-app/README.md`, the frontend and feature notes, `LLD.md`, `current-state.md`, `vibe-check.md`, `baseline-metrics.md` and the manual checklist (new section A21) updated; the owner's reference screens saved in `docs/04-quality/ui-references/`.
- 13 Nov 2026 (space icons, app switcher): spaces use line icons instead of emoji (saved as a name; older emoji still shown), the app switcher was redrawn and shows v3.4 from one constant (`utils/appVersion.ts`), the sidebar slides in 150 ms. Test counts 1602 to 1622 and files 139 to 144; `TESTING.md`, `README.md`, `CLAUDE.md` (shared seams), `current-state.md` and the manual checklist (section A22) updated. The no-emoji rule in `src/hygiene.test.ts` no longer has exceptions. Later the same day: new logo (`components/common/LiraLogo.tsx`, `public/favicon.svg`, `public/lira-icon.png`), avatars in the button colour of the theme, the app switcher closes on a click.
- Known remaining gap: the nine design notes in `Prompts and Architectures/` keep their original body with an "Update" section appended. Where the body and the update disagree, the update and the code win. Consolidating them is a candidate task.
