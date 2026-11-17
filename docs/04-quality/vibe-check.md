# Vibe check: how Lira measures "vibe-coded" and "AI slop"

Owner: product owner. Run it before every merge to `main` and after every refactor.

## 1. The quick scan (seconds)

```
cd lira-app
node scripts/vibe-check.mjs
```

It fails (exit 1) on any of these in `src/` or `server/` (test files excluded) and warns on the last two. It also counts the design tells of section 4:

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

## 4. The 30 "looks vibe-coded" tells (owner's list, 17 Nov 2026)

Every new screen, landing page and form is checked against all 30 before it is merged. **A tell that appears in new work is a defect.** A tell that is already in the app is counted by `node scripts/vibe-check.mjs`; the limit is today's count, so it may fall and never rise. "Scan" means the script counts it; "manual" means a person checks it against the rendered page.

| # | Tell | Checked by | In Lira today | Rule from now on |
|---|---|---|---|---|
| 1 | Harsh gradients | scan | 1 (a hairline under the Viva header) | None in new work. Flat colours from the palette. |
| 2 | Lucide icons | scan | 138 files import it | No new file imports `lucide-react`. New screens use the project's own icon set once one is drawn. |
| 3 | Pure white background | scan (hex) + manual | 4 `#FFF` literals; the Mossgrove palette has white cards (the owner's reference) | Pages sit on a palette background, never `#FFFFFF`. Tailwind's `white` is already mapped to the theme surface. |
| 4 | Rainbow colouring | scan | 457 stock colour-family classes | A screen uses the palette plus at most one status colour set. New colours go in `theme/palette.ts` first. |
| 5 | Drop shadows | scan | 183 | Separate with borders and surface steps. New shadows need a reason written next to them. |
| 6 | Three feature cards in a row | manual | none on landing pages yet; many 3-column grids in the app (fine in an app) | Landing pages never use an equal three-card row. |
| 7 | Emojis | test (`src/hygiene.test.ts`) | 0 | None anywhere, spaces included. Enforced by a test. |
| 8 | Liquid glass | scan | 10 uses of `backdrop-blur` | None in new work. |
| 9 | Em dashes | scan | 57 lines | Not in new text. Use a full stop, a comma or a colon. |
| 10 | Inter, Geist, Space Grotesk | scan | Inter is the app font (8 lines) | New landing pages choose a typeface on purpose. The app's own font is decided with the rename. |
| 11 | Coloured left stripe | scan | 3 | None on cards or alerts. A quotation rule is fine. |
| 12 | Fake testimonials | scan + manual | 0 | Only real, named, permitted quotes. |
| 13 | Bento grids | scan + manual | 0 | None. |
| 14 | Terminal window | scan | 0 | None as decoration. |
| 15 | "It's not X, it's Y" | scan + manual | 0 | Plain statements. |
| 16 | Checkmark bullets | manual | 38 uses of a check icon, nearly all as a "selected" mark, not as list bullets | Lists use plain bullets or numbers. A tick means "chosen", nothing else. |
| 17 | Three pricing tiers | manual | no pricing page yet (built later behind a feature flag) | Pricing is designed for the real plans, not the stock three-column template. |
| 18 | No real product demos | manual | none yet (landing pages not built) | Landing pages show the real product: live screens or recorded use, not mock illustrations. |
| 19 | Soft corner radius | scan | 231 uses of `rounded-xl` and above | New components use the small radius steps; large radii only on purpose. |
| 20 | Purple and black | scan | 50 purple, indigo or violet classes (epics, categories, Viva) | None in new work. Viva uses the theme's accent. |
| 21 | No skeleton loaders | manual | none exist; loading shows a message or nothing | Every screen that waits for data has a skeleton shaped like its content. |
| 22 | Radial orbs | scan | 0 | None. |
| 23 | Dot grids | scan | 0 | None. |
| 24 | Sparkle icons | scan | 14 lines (Viva) | None in new work. |
| 25 | Animated arrows | scan | 3 | None in new work. |
| 26 | No Terms of Service | manual | none yet | Terms are shown and accepted at sign-up (confirmed requirement). |
| 27 | No Privacy Policy | manual | none yet | Privacy Policy is shown and accepted at sign-up (confirmed requirement). |
| 28 | Hover animations | scan | 22 | Hover changes colour only. No scaling or sliding. |
| 29 | Neon colours | scan | 5 (Viva glow) | None. |
| 30 | Basic pastel colours | scan | 176 `-50` and `-100` tints | New tints are derived from the palette's own tokens. |

Other things people spot by looking:

- The same card, shadow and corner radius on every block, and no empty, loading or error states.
- "Welcome back" copy and lorem-style placeholder text.
- A layout that looks the same on every screen and ignores the task.

Lira's palette lives in `theme/palette.ts`: six palettes of three colours each, from the owner's reference screens in `docs/04-quality/ui-references/`. Each new screen is also checked against the references agreed with the owner (rule 3 in `CLAUDE.md`).

When fixing existing screens, lower the limit in `scripts/vibe-check.mjs` in the same change.

The first full design audit against these 30 (17 Nov 2026, with the Impeccable skill) is in [`design-audit-2026-11-17.md`](design-audit-2026-11-17.md): health score, findings by severity and the recommended order of fixes.

## 5. Criteria taken from outside reports

The owner's list of 30 tells is the first. The online vibe-test reports from after the merge to `main` are added below it.

For each report, add one row: source, criterion, how it is measured (script, command or manual), our result, fix and date. Then add the measurable ones to `scripts/vibe-check.mjs`.

| Source | Criterion | How measured | Result | Fix / date |
|---|---|---|---|---|
| Owner's list of 30 tells (video, 17 Nov 2026) | All 30 listed in section 4 | `scripts/vibe-check.mjs` for 22 of them, `src/hygiene.test.ts` for emoji, the rest by a person | Every scannable tell is at or under its limit; the limits are today's counts | Limits written 17 Nov 2026; fixes follow screen by screen |
| | | | | |
