# Definition of done

A change is done only when **all** applicable items are true.

## Always
- [ ] Solves the stated problem and nothing else (no unrelated refactors or "improvements").
- [ ] `npm run test:all` passes from `lira-app/` (typecheck, lint, tests, data health). No test was deleted or loosened to get there.
- [ ] New behaviour has tests; a bug fix has a test that failed before the fix.
- [ ] `npm run lint` reports **0 warnings**; no `any`, no new `eslint-disable`/`@ts-ignore`, no `console.log`, no commented-out code.
- [ ] Uses the shared seams: `appStorage`, `utils/clock`, `useResetWhen`, `useLatest`, `theme/palette`, the type-scale classes (see `CLAUDE.md`).
- [ ] New or changed functions meet the limits in `CLAUDE.md` (cyclomatic ≤ 12, cognitive ≤ 15, ≤ 80 lines, ≤ 5 parameters); existing offenders were not made worse.
- [ ] Reviewed by someone other than the author; the diff was read line by line, including AI-generated parts.
- [ ] Documents made untrue by the change were updated in the same change (`doc-freshness.md`).

## UI changes
- [ ] Uses design tokens (colours, spacing, type sizes, radius); no new hard-coded hex, arbitrary pixel text sizes or static inline styles.
- [ ] Works in light and dark themes, keyboard-only, and at phone and desktop widths.
- [ ] Interactive elements have accessible names; images have `alt`; focus is visible.
- [ ] Loading, empty and error states exist.

## Data, API, auth, security-relevant changes
- [ ] Input validated by a strict schema; output safe (see `secure-coding-standard.md`).
- [ ] Authorisation checked server-side per object; negative tests for another user, another tenant, and missing session.
- [ ] Audit record written for create/update/delete and permission changes.
- [ ] Migration is backward compatible and has a rollback note (SOP-01).
- [ ] Second reviewer who is a code owner.
- [ ] No secrets or real data in code, fixtures, logs, or the PR.

## Release readiness
- [ ] Release notes written; config changes listed; rollback known.
