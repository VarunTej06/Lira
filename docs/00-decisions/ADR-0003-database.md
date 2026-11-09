# ADR-0003: Database

- **Status:** Proposed
- **Date proposed:** 2026-11-09
- **Decision owner:** (to be named)

## Context
Today data is JSON files under `data/` (one file per space, one per roadmap, plus `projects`, `sprints`, `teams`, `standups`, `dashboards`, `settings`), cached in IndexedDB (Dexie, 3 schema versions) and, for settings-style data, in `localStorage` keys prefixed `lira_` that a mirror writes to disk (`src/services/kvMirror.ts`). Tickets embed comments, activity, subtasks and attachments inside one record (`src/types/issue.ts`). Multi-user needs transactions, concurrent writes, querying and access control that files cannot give.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| **A. PostgreSQL** (Azure Database for PostgreSQL Flexible Server) | Mature, relational integrity, JSONB for flexible fields, **row-level security** as defence in depth, full-text search | Needs schema design and migrations |
| **B. Azure Cosmos DB** | Document model close to today's JSON, global scale | Cost and RU tuning; weaker relational queries (reports, dashboards) |
| **C. SQL Server / Azure SQL** | Strong Azure fit | Less flexible JSON; licence cost |
| **D. Keep files** | None for multi-user | No concurrency control; rejected |

## Recommendation
Option A. Model tickets, comments, activity and attachments' metadata as **relational tables** (so reports and dashboards are queries, not full scans); keep truly free-form parts (dashboard widget config, user preferences) as JSONB. Attachments' bytes go to object storage (Azure Blob), not the database. Use a migration tool (for example Drizzle or Prisma Migrate) with versioned, reviewed migrations.

## Consequences
- The embedded arrays in `Issue` become tables: `comments`, `activity`, `subtasks`, `attachments`, `issue_links`, `status_log`.
- Optimistic concurrency via a `version` column on mutable rows.
- Backups and restore drills become an operational duty (SOP 02).
- Today's Dexie schema stays for the local edition only.

## Security and operations impact
Encryption at rest and in transit; least-privilege database roles (the API cannot DROP); private networking; point-in-time restore; no production data in dev.

## Revisit when
Data volume or access patterns outgrow a single PostgreSQL instance.
