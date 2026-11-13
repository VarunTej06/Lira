# Quality metrics: baseline and after the code-quality pass

Measured **9 November 2026** on branch `v3.4.1`, commit `4eb938e`, working tree unchanged by the measurement. Purpose: a fixed starting point so progress is visible and nothing gets worse. Re-run the same commands to compare.

## After the code-quality pass (9 Nov 2026, later the same day)

Same tools, same commands (see "How to re-measure"). The pass changed no behaviour: after every batch the typecheck, the lint and the whole test suite were run.

| Area | Before | After |
|---|---|---|
| Typecheck (`tsc -b`) | Clean | Clean |
| Tests | 655 (63 files) + 15 health | **1622 (144 files)** + 15 health |
| Lint (oxlint) warnings | 128 | **0** |
| `npm audit` | 0 | 0 |
| Semgrep (110 rules) | 0 findings, 302 files | 0 findings, 321 files |
| Import cycles (madge) | 3 | **0** |
| Dead code (knip) | 4 unused exported types | 4 (unchanged; the 4 are old) |
| Duplication (jscpd) | 0.45% (11 clones) | 0.48% (12 clones) |
| `any` types (non-test) | 10 | **0** |
| Suppression comments | 14 | **10** (9 hooks-rule, 1 regex) |
| `setState` called inside an effect | 40 | **0** |
| Impure calls while rendering (`Date`) | 14 | **0** |
| Hex colours in `.tsx` | 238 | **40** (88 before the 13 Nov 2026 theme change; the most used 23 colours live in `theme/palette.ts`) |
| One-off pixel text sizes | 371 | **0** (named classes `text-4xs`, `text-3xs`, `text-2xs`, `text-ui`) |
| Direct `localStorage` reads and writes in app code | 147 | **0** outside the mirror and `appStorage` |
| `useEffect` calls | 110 | **78** |
| Functions over cyclomatic complexity 12 | 81 | **22** |
| Functions over cognitive complexity 15 | 23 | **5** |
| Functions over 80 lines | 101 | 80 |
| Inline `style={{` in `.tsx` | 150 | 146 |
| Purple, indigo and violet class references | 152 | **86** (what is left marks epics, ticket types and categories; the decorative ones became theme tokens on 13 Nov 2026) |
| Fixed blue class references | 237 | **39** (To Do, In Progress and Task badges only) |
| Gradients | 12 | **1** (a hairline under the Viva header) |
| **Slop score (rubric below)** | **36 / 100** | **26 / 100** (22 for the code alone) |

Slop score after: (1 security + 1 dead code and duplication + 1 tests and hygiene + 4 function size and complexity + 2 type safety and suppressions + 4 UI consistency + 5 process) / 7 = 2.6, so 26. Without the process row: 2.2, so 22.

### What is left, in order of effect on the score
1. **Function size and complexity (22 / 5 / 80 offenders).** Still the biggest single contributor. The worst offender is now 18 (it was 36). All are React components or hooks where the branching is in the JSX or the state wiring: `SprintsPage` (18), `DatePicker` (17), `App` (15), then 14 (`CreateIssueModal`, `roadmapFilter`, `standupUtils`) and a tail of 13s. Nothing above 18 is left. Screens already split and covered by tests: ticket popup, create ticket, rich text editor, roadmap item dialog and planner, sprints page, create sprint, Viva chat bubble, filter dropdowns, filters results table. Done: `findTargetSpace` (36), the dashboard numbers (`scopeIssues`, `metricValue`, `groupIssues`, `metricIssues`, `widgetData`, `planFromPrompt`, the Markdown snapshot, `WidgetBody`), `buildPreview`, `generateDomainSubtasks`, `markdownToHtml`, `sprintRisk`, `handleCreateIssue`, `handleTicketDetail`, `processUserMessage`, `fileForKey`, `checkApiRequest`, the disk store load, save and roadmap functions. Next step: split the components above into smaller components and hooks, one at a time, checking each in a real browser.
2. **9 suppressions of the hooks rule.** Each hides real findings: the roadmap Timeline, Planner and Table drag and scroll code, `useEnsureEpics`, `useProjects`, and the draft reset in `useIssueDetail`. They were left because they need a real browser to verify. The cap in `src/hygiene.test.ts` stops the number from growing.
3. **UI tokens.** The palette was decided on 13 Nov 2026 (three themes, reference screens in `ui-references/`) and the brand colours moved to tokens. 40 hex colours and 146 inline styles remain in `.tsx`; the remaining blue, purple, indigo and violet classes carry meaning (status, ticket type, category) and were kept on purpose. The slop score was not re-worked for this change.
4. **Process.** CI, pre-commit hooks and the multi-user work are not started (the DevOps step comes after multi-user and SSO).
5. **Data boundary.** Server records are typed but not schema-validated (needed for multi-user); the Gemini model name is hard-coded.

## Baseline summary (before the pass)

| Area | Result |
|---|---|
| Typecheck (`tsc -b`) | Clean |
| Tests | 655 passed (63 files) + 15 data-health checks passed |
| `npm audit` | 0 vulnerabilities |
| Semgrep (TypeScript, React, secrets; 110 rules, 302 files) | 0 findings |
| Secret scan (tracked files + git history) | None found |
| Lint (oxlint) | 0 errors, **128 warnings** |
| Duplication (jscpd, min 8 lines / 60 tokens) | 0.45% (11 clones, 154 of ~34k lines) |
| Dead code (knip) | 4 unused exported types; no unused files or dependencies |
| Circular imports (madge) | 3 |
| Non-test source size | 33,228 lines; largest component 349 lines (`SettingsModals.tsx`); largest source file 851 (`db/seedData.ts`) |

## Oxlint warnings by rule (128)
`react(set-state-in-effect)` 40 · `react(only-export-components)` 31 · `react-hooks(exhaustive-deps)` 17 · `react(purity)` 14 · `react(refs)` 7 · `react(immutability)` 6 · `eslint(no-unused-vars)` 4 · `react(jsx-key)` 3 · `react(use-memo)` 2 · `react(preserve-manual-memoization)` 2 · `no-unused-expressions` 1 · `react(globals)` 1.

## Complexity (ESLint + sonarjs, thresholds in `CLAUDE.md`; non-test code)
| Measure | Offenders |
|---|---|
| Cyclomatic complexity > 12 | 81 functions |
| Cognitive complexity > 15 | 24 functions |
| Function longer than 80 lines | 101 functions |
| More than 5 parameters | 4 |
| Nesting deeper than 4 | 1 |
| Repeated string literals (sonarjs) | 47 |
Worst: `dashboards/Widgets.tsx` (28), `common/richtext/RichTextEditor.tsx` (26), `ai/ChatBubble.tsx` (24), `common/FilterMultiSelect.tsx` (24), `filter/page/ResultsTable.tsx` (23), `server/diskStore.ts loadAllDataFromDisk` (21).

## Type and suppression discipline
- `any`: 10 occurrences (8 in `server/diskStore.ts`, 2 in `Object.values(...)` callbacks).
- Suppression comments: 14 (13 `react-hooks/exhaustive-deps`, 1 `no-control-regex`).
- `console.log`: 0 · empty `catch`: 0 · TODO/FIXME/HACK: 0 · comment density: 3.9%.

## UI consistency signals (`src/**/*.tsx`)
| Signal | Count |
|---|---|
| Hard-coded hex colours | 238 |
| Inline `style={{` | 150 |
| Arbitrary text sizes (`text-[Npx]`) | 371 |
| Purple / indigo / violet class references | 152 |
| Gradient classes | 20 |
| Emoji characters in components | 54 |
| `rounded-xl` and larger | 240 |
| `shadow-xl` / `shadow-2xl` | 35 |
| Aria/role attributes | 243 |
| Direct `localStorage.` calls (non-test) | 147 |
| `useEffect(` calls | 110 |

## "Vibe score" (heuristic, not an industry standard)
There is no standard tool that scores "AI slop". This score is a transparent rubric: each area gets 0 (clean) to 10 (sloppy) and the average is scaled to 100. **Result: 36 / 100 including process, 32 / 100 for the code alone (low to moderate: AI-assisted, mostly disciplined; complexity and UI tokens are the weak spots).** Scores: (1+1+2+6+4+5+6)/7 ≈ 3.6 → 36; without the process row (1+1+2+6+4+5)/6 ≈ 3.2 → 32.

| Area | Score | Reason |
|---|---|---|
| Security and dependencies | 1 | Guard, tests, 0 findings |
| Dead code and duplication | 1 | Almost none |
| Tests and hygiene | 2 | 655 tests; no debug leftovers |
| Function size and complexity | 6 | 81/24/101 offenders |
| Type safety and suppressions | 4 | 10 `any`, 14 suppressions, 128 warnings |
| UI consistency | 5 | 238 hex, 371 arbitrary sizes, 150 inline styles |
| Process (CI, hooks, `CLAUDE.md`) | 6 | `CLAUDE.md`, docs and SOPs now exist; CI and pre-commit hooks are deferred to the DevOps step |

Use it for direction, not as a pass/fail grade.

## Targets (ratchet)
Never increase any count in the "after" table. Reached: lint warnings 0, `any` 0, import cycles 0, one-off text sizes 0. Next targets: functions over complexity 12 from 59 to 40 and none above 25; hooks-rule suppressions from 10 to 0; no new hex colour or inline style for static values; `any`-free schemas on the server once multi-user validation exists. `src/hygiene.test.ts` already fails on any of: `any`, direct `localStorage`, one-off text sizes, palette colours repeated as hex, more than 10 hooks-rule suppressions.

## How to re-measure
From `lira-app/` (tools are not project dependencies; install them in a scratch folder):
`npx tsc -b` · `npm run lint` · `npm test` · `npm audit` · `npx knip` · `npx jscpd src server --ignore "**/*.test.*" --min-lines 8 --min-tokens 60` · `npx madge --circular --extensions ts,tsx --ts-config tsconfig.app.json src` · `semgrep scan --config p/typescript --config p/react --config p/secrets --exclude data --exclude "*.test.*" .` · ESLint with `complexity`, `max-lines-per-function`, `sonarjs/cognitive-complexity`.
