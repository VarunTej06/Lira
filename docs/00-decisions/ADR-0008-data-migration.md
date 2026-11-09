# ADR-0008: Migration of existing JSON data

- **Status:** Proposed
- **Date proposed:** 2026-11-09
- **Decision owner:** (to be named)

## Context
Existing workspaces live in `data/`: `spaces.json`, `spaces/<KEY>.json`, `roadmaps/*.json`, `projects.json`, `sprints.json`, `teams.json`, `standups.json`, `dashboards.json`, `board-config.json`, `settings.json`, and a legacy monolith `lira-workspace.json`. Dates are stored as strings and tickets embed arrays. Settings keys originate from `localStorage` (`lira_*`). There is a single implicit owner ("VY"). The files may be hand-edited, so shapes can be irregular (the health check, `tests/health/dataHealth.test.ts`, exists for this reason).

## Options considered
| Option | Pros | Cons |
|---|---|---|
| **A. One-time import tool** (CLI) that validates and loads into the database | Clear, testable, repeatable in a dry run | Must handle irregular data |
| **B. Live dual-write period** | Gradual | Complexity; two sources of truth |
| **C. Start empty, re-enter** | Trivial | Loses history; unacceptable |

## Recommendation
Option A. The importer: (1) runs the existing health checks, (2) validates every record against the new schemas and **reports** rejects instead of silently fixing, (3) maps people (`VY`, assignee/reporter initials, mentions) to real user accounts via an explicit mapping file, (4) assigns the whole workspace to a chosen organisation, (5) supports `--dry-run` and prints counts that must match the source, (6) is idempotent (re-run does not duplicate), (7) never modifies `data/`. Keep the source files as the rollback.

## Consequences
- Needs a user-mapping step before the first import.
- Attachments stored as base64 inside tickets are moved to object storage; sizes are verified.
- The importer has its own tests using fixture copies, never the real `data/`.

## Security and operations impact
Importer runs with a dedicated, time-limited database role. Imported data is audit-logged as an import event.

## Revisit when
Another tracker's export format (CSV, Jira) is added as a source.
