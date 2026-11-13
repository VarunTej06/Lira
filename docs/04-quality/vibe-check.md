# Vibe check: how Lira measures "vibe-coded" and "AI slop"

Owner: product owner. Run it before every merge to `main` and after every refactor.

## 1. The quick scan (seconds)

```
cd lira-app
node scripts/vibe-check.mjs
```

It fails (exit 1) on any of these in `src/` or `server/` (test files excluded) and warns on the last two:

| Signal | Limit | Why it matters |
|---|---|---|
| `any` type | 0 | Type safety given up |
| `@ts-ignore` / `@ts-nocheck` | 0 | Errors hidden, not fixed |
| `console.log` | 0 | Debug leftovers; could leak ticket text |
| empty `catch` | 0 | Errors swallowed |
| `dangerouslySetInnerHTML`, `eval`, `new Function` | 0 | XSS / code injection |
| raw `localStorage` calls (outside the storage seams) | 0 | Settings must go through `utils/appStorage.ts` |
| `text-[Npx]` sizes | 0 | Use the type scale tokens |
| lint suppressions | 10 | Ratchet: may fall, never rise |
| TODO / FIXME / HACK | 0 | Unfinished work in shipped code |
| files over 400 lines (warn) | 0 | Too much in one place |
| utils/hooks with no test next to them (warn) | 0 | Logic without a safety net |

## 2. The full check (minutes)

| Check | Command | Target |
|---|---|---|
| Types | `npx tsc -b` | clean |
| Lint | `npm run lint` | 0 warnings |
| Tests | `npm test` | all pass |
| Complexity (cyclomatic 12, cognitive 15, function 80 lines, 5 params) | ESLint + sonarjs run, see `baseline-metrics.md` | no new offenders; the number falls |
| Dead code | `npx knip` | no new unused exports |
| Duplicates | `npx jscpd src` | below 1 % |
| Cycles | `npx madge --circular src` | none |
| Security patterns | `semgrep` with the project rules | 0 findings |
| Dependencies | `npm audit` | 0 |

## 3. The score (judgement, written down)

Seven areas, each 0 (clean) to 10 (worst): security, dead code and duplication, tests and hygiene, function complexity, type safety and suppressions, UI consistency, process. The score is the average times 10. Lower is better.
History: 36 baseline, 29, 27, 26 (22 for code only). The workings are in `baseline-metrics.md`.

## 4. What people spot by looking (UI "tells")

- Default AI palettes (purple or indigo gradients, glowing blue-violet, generic slate). Lira's palette lives in `theme/palette.ts`: three themes of three colours each, from the owner's reference screens in `docs/04-quality/ui-references/`.
- Same card, same shadow and same rounded corners everywhere; no empty, loading or error states.
- Stock icons and emoji as decoration, "Welcome back" copy, lorem-style placeholder text.
- Layout that looks the same on every screen and ignores the task.

Each new screen is checked against the references agreed with the owner (rule 3 in `CLAUDE.md`).

## 5. Criteria taken from outside reports

_Empty until the owner shares the online vibe-test reports after merging to `main`._

For each report, add one row: source, criterion, how it is measured (script, command or manual), our result, fix and date. Then add the measurable ones to `scripts/vibe-check.mjs`.

| Source | Criterion | How measured | Result | Fix / date |
|---|---|---|---|---|
| | | | | |
