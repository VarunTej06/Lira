# ADR-0012: How the hosted database is structured

- **Status:** Proposed (27 Nov 2026). Not decided. Nothing in the database changes until the owner accepts a part of it.
- **Date proposed:** 2026-11-27
- **Decision owner:** product owner

## Context
The hosted database is 20 numbered migrations in `api/migrations/` (V1 to V20): 27 tables, 23 indexes, one schema (`public`) and one restricted application role (`lira_app`, V2). It has no views, functions, triggers or row-level security. Joins are written as parameterised queries in the API. Tenant isolation is a `WHERE org_id = $1` in every query, with an integration test per feature, and the audit log is append-only because the application role has only SELECT and INSERT on it.

This works and is tested, but it keeps every rule in application code. An enterprise reviewer will ask where the schemas, the database-side safeguards and the database documentation are.

## Options
1. **Keep as is, and add documentation.** A `database/` folder with a diagram, a description of every table and the rules, and the migrations stay where they are or move there. No behaviour changes.
2. **Add database-side safeguards.** On top of 1:
   - **Schemas** to group tables: `identity` (users, sessions, memberships, invitations, two-step), `work` (spaces, tickets, objects, story boxes), `calls` (stand-ups, reminders, calendar), `audit`. The application role gets USAGE only where it needs it.
   - **Row-level security** on every table that has `org_id`, with the API setting the organisation for the connection, so a missed `WHERE org_id` returns nothing instead of leaking.
   - **Views** for the reads that join several tables (a person's access across teams and grants; a space's tickets with assignees), used by the API.
   - **Functions** for rules that must never be skipped, for example one function that appends an audit row and one that checks a person's access to an object.
3. **Move the rules wholesale into stored procedures.** Rejected for now: it makes behaviour harder to test and review, and Azure Database for PostgreSQL gives no benefit for it.

## Recommendation
Do 1 now, then 2 in this order, one migration each, each with its tests: schemas, then row-level security, then views, then functions. Reject 3.

## What could break
- Moving tables between schemas changes every query that names a table, so every API test must pass again. It is done by a `search_path` for the application role first, then by renames.
- Row-level security needs the API to set the organisation on each connection; with a pooled connection a missed reset would show the wrong data, so each request runs in a transaction that sets it locally and the tenant-isolation tests are repeated against the policies.
- The Azure rehearsal database is rebuilt every session, so existing data is not at risk. A real database needs a backup first (SOP-02).

## Consequences if accepted
- A `database/` folder, `README.md` with a diagram, and one page per schema.
- New migrations V21 onwards. Old migrations are never edited.
- `docs/02-security/secure-coding-standard.md` and `docs/01-architecture/LLD.md` are updated with the new layout.

## Decision
Open. Please choose: 1 only, 1 then 2 in full, or 1 then only some parts of 2.
