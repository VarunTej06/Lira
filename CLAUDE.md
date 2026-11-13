# CLAUDE.md — Lira engineering rules

Lira is a work-tracking app (tickets, boards, sprints, roadmaps, dashboards, an AI copilot called Viva).
**Today** it is a single-user, local app. **Next** it becomes a multi-user, enterprise app with SSO (decided 9 Nov 2026).
Read `docs/README.md` first. Decisions that are not yet made are in `docs/00-decisions/`. Do not invent them: ask.

## How to work here

1. **Read before you write.** Find the existing helper, hook or component before adding one. No duplicates.
2. **Smallest change that solves the stated problem.** No speculative abstractions, no "just in case" options, no wrapper that only forwards a call, no unrequested refactors.
3. **Plan first for anything over ~3 files or any data/auth/security change.** State the plan and what could break; wait for approval.
4. **Test first, then change.** A bug fix starts with a failing test. A refactor starts with tests that pin today's behaviour.
5. **Verify, don't assume.** Run the checks below and report real output. Never say "done" while a check fails.
6. **Ask before** deleting files, changing the data model, adding a dependency, touching auth, or anything outward-facing (push, PR, publish, message).

## Rules from the product owner (always apply)

These are the owner's own standing requirements; they apply to every change.

1. **Keep the documents true.** Whenever the code changes, update everything that describes Lira to its readers in the same change: the READMEs, HLD, LLD, SOPs, architecture diagrams, technical documents and `CLAUDE.md` itself. `docs/04-quality/doc-freshness.md` says which file owns which fact.
2. **Unit tests with every new thing.** Anything newly implemented ships with unit tests in the same change.
3. **UI first.** Decide the UI before building it: collect sample reference screens (Pinterest or other galleries), agree the layout, states (empty, loading, error) and tokens with the owner, then code. Link the references in the pull request.
4. **Unique colours.** Do not use the colours AI assistants reach for by default (purple or indigo gradients, glowing blue-violet, generic slate) unless the owner asked for them. Choose a palette on purpose, record it in `theme/palette.ts` and the Tailwind tokens, and use only that.
5. **No hallucination, no padding.** Do not invent APIs, options or package names: check them. A function that can be written in 10 to 20 lines must be. When fixing something, fix the actual logic; do not wrap code around it.
6. **Security standards** in `docs/02-security/secure-coding-standard.md` apply to every change.
7. **Schemas at every layer that needs them** (request bodies, stored files, imports, AI output), validated at the boundary.
8. **Auditing.** Record who did what and when, and store the audit log append-only and apart from the application logs.
9. **Instrumentation.** Add custom metrics and structured logs for what matters (requests, errors, latency, imports, AI calls, sign-ins). Never log secrets or ticket text.
10. **Health endpoints.** Every service exposes a liveness check (`/health`) and a readiness check (`/ready`) that verifies its dependencies.

## Commands (run from `lira-app/`)

| Check | Command |
|---|---|
| Everything | `npm run test:all` (typecheck, oxlint with **0 warnings**, 1732 tests, data health) |
| Types | `npx tsc -b` |
| Lint | `npm run lint` (must report 0 warnings) |
| Tests | `npm test` (single file: `npx vitest run path/to/file.test.ts`) |
| Build | `npm run build` (typecheck, then the production bundle) |
| Dev server | `npm run dev` (`dev:lan` opens it to the local network). It rewrites files under `data/`: do not run it against the real workspace |

## Protected paths

- `data/` is a real person's workspace. **Never edit, delete, reformat or commit changes to it.** Tests and tools must use temp copies.
- `data/private/` holds secrets and is git-ignored. Never print, copy or log its contents.
- No `.env`, key, token or certificate in the repo, a log, a test fixture or a chat message.

## Code standards

- TypeScript strict. **No new `any`**; use `unknown` and narrow. No `@ts-ignore`; no lint-disable without a one-line reason.
- Limits for new or changed code (a ratchet: never make an existing offender worse): cyclomatic complexity ≤ 12, cognitive complexity ≤ 15, function ≤ 80 lines, ≤ 5 parameters, file ≤ 400 lines.
- Components render; logic lives in hooks or pure functions in `src/utils/` with unit tests.
- Effects: do not call `setState` synchronously in an effect, do not read refs or call `Date.now()`/`new Date()` during render, do not silence `exhaustive-deps`. Fix the cause. To restart a draft when a prop or the open state changes use `hooks/useResetWhen.ts`; for a handler that must see the newest value use `hooks/useLatest.ts`. Lint must report 0 warnings.
- Colours, spacing and type sizes come from design tokens (`tailwind.config.js`, CSS variables, `theme/palette.ts`). No new hard-coded hex, no `text-[13px]`-style sizes (use `text-4xs`, `text-3xs`, `text-2xs`, `text-ui` or Tailwind's own), no new inline `style` for static values.
- Comments say **why**, never what. No commented-out code, no `console.log`, no empty `catch`.
- Browser settings go through `utils/appStorage.ts`, never raw `localStorage`; the time comes from `utils/clock.ts`; the shared empty ticket list is `NO_ISSUES` (`utils/emptyLists.ts`), not a new `[]` each render. `src/hygiene.test.ts` fails if these are bypassed, if `any` appears, or if hooks-rule suppressions grow.

## Security rules (non-negotiable)

Follow `docs/02-security/secure-coding-standard.md`. In short:

- **Server is the authority.** Every request is authenticated and authorised on the server, per object, for the calling user. The UI hiding a button is not a control.
- **Validate every input at the boundary** with a schema (zod). Reject unknown fields. Never spread request bodies into records (mass assignment).
- **Parameterised queries only.** No string-built SQL, shell commands, file paths or URLs from user input.
- **Tenant isolation:** every query is scoped by organisation/space; add a test that a user of tenant A cannot read or write tenant B.
- **SSO:** OIDC Authorization Code + PKCE, validated `iss`, `aud`, `exp`, `nonce`. Sessions in `HttpOnly; Secure; SameSite` cookies. Never keep tokens in `localStorage`.
- **Output:** user-authored rich text is sanitised on write and on render. No `dangerouslySetInnerHTML`, `eval` or `new Function`. Links from users must pass `safeUrl` (http/https only).
- **Outbound calls** (AI providers, link previews, webhooks) use an admin-configured allow-list. Never fetch a user-supplied URL from the server (SSRF).
- **Secrets** live in a secret store (Azure Key Vault), not in code, config files, logs or the browser. Errors returned to clients carry no stack traces.
- **Audit:** every create/update/delete and every permission change writes an audit record (who, what, when, from where).
- **Dependencies:** before adding a package confirm it exists on the registry, is maintained, and its licence fits; pin the version; run `npm audit`. Never install a package only because a model suggested the name.
- **AI (Viva):** ticket text is data, never instructions. A model may not change records; changes are previewed, confirmed by the user and undoable.

## Testing standards

- Every bug fix and every new rule has a test. Security-relevant code (guard, authz, validation, sanitising) needs negative tests (forged origin, other tenant, oversized body, hostile HTML).
- Prefer testing pure functions; keep component tests to behaviour a user sees.
- Do not delete or loosen a test to make it pass.
- Every new file with logic gets a test file next to it. Shared helpers and hooks are tested directly, not only through the screens that use them.

## Git and reviews

- Small, single-purpose commits and PRs. Commit messages say why. Never commit secrets or `data/`.
- Do not push, open a PR, or force-push without being asked.
- Reviewers use `docs/04-quality/ai-code-review-checklist.md`.

## Avoiding "vibe-coded" code (how we refactor and write)

These are the habits that took the slop score from 36 to 26. Follow them for every change.

- **Characterise, then change.** Before restructuring a component or function, write tests that pin what it does today and run them on the original. Refactor. Run the *same* tests again. Never change a test to make a refactor pass.
- **Split by meaning, not by size.** Replace repeated blocks with a table (`TABS`, `COMPARERS`, `HEADERS`) and long `if/else` chains with a lookup or a small pure function in `utils/`. Move JSX into named subcomponents without changing it.
- **One home per idea.** Before adding a hook or helper, search `hooks/`, `utils/` and `components/common/`. Shared seams: `useResetWhen`, `useLatest`, `useDismiss`, `appStorage`, `clock`, `NO_ISSUES`, `palette`, `filterPlacement`, `dialogStore`, `SpaceIcon` (with `utils/spaceIcon.ts`), `appVersion`, `TicketPicker`, `isEditable`, `labels`, `ticketLinks`, `useElementWidth`.
- **No padding.** No wrapper that only forwards, no option nobody asked for, no comment that repeats the code, no commented-out code. If it fits in 10 to 20 lines, write it in 10 to 20 lines.
- **Ratchets only go down.** Complexity, suppression count (`hygiene.test.ts`), `any`, hard-coded hex/sizes and warning count may fall, never rise. If you remove a suppression, lower the cap in the same change.
- **Fix the cause.** A lint warning is fixed in the logic (derive state, reset on key, use the hook), not silenced.
- **Every new file with logic has a test file next to it**, and every UI change is listed in `docs/04-quality/manual-test-checklist.md` (and the Excel `Lira-manual-test-cases.xlsx`).
- **Report the real numbers.** Run `npm run test:all` and `node scripts/vibe-check.mjs`; quote the output, including what did not improve.
- **Criteria from outside.** `docs/04-quality/vibe-check.md` lists the rubric. When an external vibe or AI-code report points at something, add its criterion there and to `scripts/vibe-check.mjs`, then fix the findings.

## Docs

If a change makes a document untrue, update the document in the same change. `docs/04-quality/doc-freshness.md` lists which doc owns which fact.
