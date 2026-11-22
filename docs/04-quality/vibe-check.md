# Vibe check: how Lira measures "vibe-coded" and "AI slop"

Owner: product owner. Run it before every merge to `main` and after every refactor.

## 1. The quick scan (seconds)

```
cd lira-app
node scripts/vibe-check.mjs
```

It fails (exit 1) on any of these in `src/` or `server/` (test files excluded) and warns on the last two. It also checks the design tells of section 4 (22 of the 30):

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

Every new screen, landing page and form is checked against all 30 before it is merged. **A tell that appears in new work is a defect.** On 18 Nov 2026 the app was brought to zero on every tell a scan can see, except the two below that need a decision; `node scripts/vibe-check.mjs` now fails if any comes back. "Scan" means the script counts it; "config check" means the script reads the Tailwind config; "manual" means a person checks it against the rendered page.

| # | Tell | Checked by | In Lira now (18 Nov 2026) | Rule from now on |
|---|---|---|---|---|
| 1 | Harsh gradients | scan | 0 | None. Flat colours from the palette. |
| 2 | Lucide icons | scan | **Still there:** 138 files import it | No new file imports `lucide-react`. The app moves to its own icon set once one is drawn (decision open). |
| 3 | Pure white background | scan (hex) + manual | 4 literals: the print sheet, the Mossgrove swatch, one fallback, the Tailwind name `white` (mapped to the theme surface) | Pages sit on a palette background. Mossgrove's white cards come from the owner's reference. |
| 4 | Rainbow colouring | config check | Fixed: Tailwind's palette is replaced by four status scales (danger, success, warning, info) in `src/theme/colorScales.json`; the accent comes from the palette in use | No new colour scale. A new colour goes in `theme/palette.ts` or the scales first. |
| 5 | Drop shadows | scan | 0 | None. Separate with borders and surface steps. |
| 6 | Three feature cards in a row | manual | none on landing pages yet; app grids are fine | Landing pages never use an equal three-card row. |
| 7 | Emojis | test (`src/hygiene.test.ts`) | 0 | None anywhere, spaces included. |
| 8 | Liquid glass | scan | 0 | None. |
| 9 | Em dashes | scan | 0 | Not in text. Use a full stop, a comma or a colon. |
| 10 | Inter, Geist, Space Grotesk | scan | Fixed 18 Nov 2026: the app uses the device's own interface font (San Francisco, Segoe UI, Roboto), as Instagram, WhatsApp and LinkedIn do; nothing is downloaded | No Inter, Geist or Space Grotesk. A brand typeface is a separate choice, made with the rename. |
| 11 | Coloured left stripe | scan | 0 (a quotation rule is allowed) | None on cards or alerts. |
| 12 | Fake testimonials | scan + manual | 0 | Only real, named, permitted quotes. |
| 13 | Bento grids | scan + manual | 0 | None. |
| 14 | Terminal window | scan | 0 | None as decoration. |
| 15 | "It's not X, it's Y" | scan + manual | 0 | Plain statements. |
| 16 | Checkmark bullets | manual | 38 uses of a check icon, nearly all as a "selected" mark, not as list bullets | Lists use plain bullets or numbers. A tick means "chosen". |
| 17 | Three pricing tiers | manual | no pricing page yet (built later behind a feature flag) | Pricing is designed for the real plans, not the stock three-column template. |
| 18 | No real product demos | manual | none yet (landing pages not built) | Landing pages show the real product. |
| 19 | Soft corner radius | config check + scan | Fixed: no step of the radius scale is above 12px (it was 24px) | Keep every step at 12px or less. |
| 20 | Purple and black | scan | 0 (epics are ochre; purple, indigo and violet classes became the palette accent) | None. |
| 21 | No skeleton loaders | test | Fixed: the start-up screen and every page that loads on demand show skeletons (`components/common/Skeleton.tsx`) | Every screen that waits for data has a skeleton shaped like its content. |
| 22 | Radial orbs | scan | 0 | None. |
| 23 | Dot grids | scan | 0 | None. |
| 24 | Sparkle icons | scan | 0 | None. |
| 25 | Animated arrows | scan | 0 | None. |
| 26 | No Terms of Service | manual | **Draft written** (`docs/06-legal/terms-of-service-DRAFT.md`); not yet shown in the product, which has no sign-up | Terms are shown and accepted at sign-up (confirmed requirement). |
| 27 | No Privacy Policy | manual | **Draft written** (`docs/06-legal/privacy-policy-DRAFT.md`); not yet shown in the product | Privacy Policy is shown and accepted at sign-up (confirmed requirement). |
| 28 | Hover animations | scan | 0 (hover changes colour only) | Hover changes colour only. |
| 29 | Neon colours | scan | 0 | None. |
| 30 | Basic pastel colours | config check | Fixed: tints come from the four muted status scales, not Tailwind's pastels | New tints are derived from those scales or the palette's tokens. |

Other things people spot by looking:

- The same card, shadow and corner radius on every block, and no empty, loading or error states.
- "Welcome back" copy and lorem-style placeholder text.
- A layout that looks the same on every screen and ignores the task.

Lira's palette lives in `theme/palette.ts`: six palettes of three colours each, from the owner's reference screens in `docs/04-quality/ui-references/`. Each new screen is also checked against the references agreed with the owner (rule 3 in `CLAUDE.md`).

When fixing existing screens, lower the limit in `scripts/vibe-check.mjs` in the same change.

The first full design audit against these 30 (17 Nov 2026, with the Impeccable skill) is in [`design-audit-2026-11-17.md`](design-audit-2026-11-17.md): health score, findings by severity and the recommended order of fixes.

### Exceptions approved by the owner (19 Nov 2026)

The owner asked for these on the public landing page of the hosted edition, from the reference pictures they shared. They apply only to the files named here. Nowhere else may they appear, and no limit in `scripts/vibe-check.mjs` was raised: the scan does not see them, because they are drawn with a canvas, CSS and text rather than with the words the scan looks for.

| Tell | Where | What is allowed | Safeguards |
|---|---|---|---|
| 14 Terminal window | `src/components/public/AiBand.tsx` | The headline of the black AI band is set in a monospace box with a `>` prompt, a line that types itself once, and a blinking caret. No window bar, no traffic lights. | The headline is plain text for screen readers, the caret is hidden from them, and with reduced motion the line simply appears. |
| 23 Dot grid | `src/components/public/PointerDots.tsx`, `DotIcon.tsx` | Faint dots behind the black band that light up under the mouse, and three small icons drawn from dots. | The canvas is hidden from screen readers. With reduced motion, or on a touch screen, the dots stay still and faint. |
| 6 Three in a row | `src/components/public/AiBand.tsx`, `DiscoverCards.tsx` | Three short columns in the black band, and a sideways row of cards. | The "More than project management" section uses alternating rows instead of three across. |
| 28 Hover motion | `src/components/public/PointerDots.tsx` | The dots react to the mouse. Nothing scales or slides on hover. | As above. |
| Scroll motion | `src/components/public/DiscoverCards.tsx` | The card row slides in from the right once, the first time it scrolls into view. | Shown at once with reduced motion or where scrolling cannot be watched. |

## 5. Criteria taken from outside reports

The owner's list of 30 tells is the first. The online vibe-test reports from after the merge to `main` are added below it.

For each report, add one row: source, criterion, how it is measured (script, command or manual), our result, fix and date. Then add the measurable ones to `scripts/vibe-check.mjs`.

| Source | Criterion | How measured | Result | Fix / date |
|---|---|---|---|---|
| Owner's list of 30 tells (video, 17 Nov 2026) | All 30 listed in section 4 | `scripts/vibe-check.mjs` for 22 of them, `src/hygiene.test.ts` for emoji, the rest by a person | 18 of the 30 failed on 17 Nov; 16 now pass or are fixed, 1 remains as a future task (the icon set, after the rename), 2 wait for sign-up (Terms, Privacy shown in the product), the rest are manual and open until the landing pages exist | Fixed 18 Nov 2026 (see `design-audit-2026-11-17.md`) |
| | | | | |
