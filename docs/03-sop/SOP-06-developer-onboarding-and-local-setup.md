# SOP-06: Developer onboarding and local setup

**Purpose:** a new engineer (or AI assistant session) can run, test and change Lira safely on day one. **Scope:** local development. **Roles:** Tech lead (mentor), new developer. **Status:** Current for the local edition; hosted-edition steps are added when the API exists.

## Prerequisites
- Node.js 20.19+ or 22.12+, npm 10+, Git. Windows, macOS or Linux.
- Read: root `README.md`, `SETUP.md`, `CLAUDE.md`, `docs/01-architecture/current-state.md`, `docs/02-security/secure-coding-standard.md`.

## Steps
1. Clone the repository; `cd lira-app`.
2. `npm install`.
3. `npm run dev` and open the printed address (normally http://localhost:5173). The app opens on the last-used space.
4. **Protect the workspace data.** `data/` in the repo root is a real workspace. Do not edit it by hand, do not commit changes to it. Use a throw-away copy for experiments.
5. Run the checks: `npm run test:all`. Expect typecheck clean, lint with **0 warnings**, all tests passing, the data health run passing. Do not start work on a red baseline; report it.
6. Create a short-lived branch named `type/short-description` (for example `fix/board-drop-rank`).
7. Make the smallest change that meets the request; add or update tests first for behaviour changes.
8. Re-run `npm run test:all`. Review your own diff using `docs/04-quality/ai-code-review-checklist.md`.
9. Open a pull request: what changed and why, what could break, how it was tested, which security rules apply.

## Working with an AI assistant
- Point it at `CLAUDE.md` (Claude Code reads it automatically).
- Ask for a plan before changes that touch more than three files, data, or auth.
- Do not paste secrets or real customer data into prompts.
- You are accountable for every line it writes: read the diff.

## Troubleshooting
| Problem | Fix |
|---|---|
| Port busy | `npm run dev -- --port 5180` |
| Tests fail after pulling | `npm install`, then re-run |
| App shows no data | See `SETUP.md` (data folder) and `/api/health` |
| A lint warning appears | Fix the cause; do not add a suppression comment. The cap on suppressions is in `src/hygiene.test.ts` |

## Verification
`npm run test:all` is green and you can explain where tickets are stored and which route shows a board.
