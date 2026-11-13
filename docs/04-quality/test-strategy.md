# Test strategy

**Today:** 1602 automated tests in 139 files (Vitest, jsdom, fake-indexeddb) plus a 15-check read-only data health run (`npm run test:health`). Layers: pure logic (`src/utils`, `src/services`), server and guard (`server/*.test.ts`), screens in a fake browser (`src/components/**`), source-hygiene and quality-ratchet rules (`src/hygiene.test.ts`: no `eval`, no `dangerouslySetInnerHTML`, no secrets in source, no `any`, storage through `appStorage`, no one-off text sizes, palette colours not repeated, a cap on lint suppressions, the documents agree on the test count), and documents. Details: [`../../TESTING.md`](../../TESTING.md).

## Target pyramid for the hosted edition

| Layer | What | Tooling | Run |
|---|---|---|---|
| Unit | `core` logic (sprints, roadmaps, reports, Viva intent), validation schemas, **authorisation function (one test per cell of the access-control matrix)** | Vitest | Every change |
| Repository / integration | SQL, constraints, row-level security, migrations against a real PostgreSQL container | Vitest + Testcontainers | Every change |
| API contract | Every route matches OpenAPI; error shapes; no stack traces | Vitest + supertest | Every change |
| **Tenant isolation** | For every route that takes an id or lists data: user A of org 1 cannot read, write or discover org 2's data; a Viewer cannot write; a disabled user is refused; no session is refused | Generated from the route table | Every change |
| Security negative tests | Forged Origin, missing CSRF token, oversized body, hostile HTML in comments, SSRF addresses for AI base URL, mass-assignment fields | Vitest | Every change |
| UI component | Behaviour a user sees (forms, board, modals) | Testing Library | Every change |
| End-to-end | Sign in, create/move/edit ticket, conflict (two users), upload attachment, Viva preview → confirm → undo | Playwright | Pre-release |
| Migration | Importer on synthetic fixtures; counts reconcile; idempotent re-run | Vitest | Every change to importer |
| Performance | Board with 2,000 tickets; list/search; concurrent writers | k6 or similar | Pre-release |
| Accessibility | Core screens | axe + manual | Pre-release |
| Security scans | SAST (Semgrep), dependency audit, secret scan, DAST on staging | See SOP-04; automated in the DevOps step | Pre-release |

## Rules
- Test data is synthetic. Never read or write the real `data/` folder in tests.
- A bug fix starts with a failing test.
- Do not mock the thing under test; prefer real database containers for data access.
- Security tests assert the **absence** of access, not just the presence of success.
- Flaky tests are fixed or removed within a week; never retried silently.

## Coverage
Track line and branch coverage for `core`, `authz`, `validation` and repositories (target to be agreed, suggest ≥ 85% there); do not chase a global number.
