# Database (hosted edition)

The hosted edition keeps everything in one PostgreSQL 16 database. The local edition has no database; it uses files under `data/`.

| What | Where |
|---|---|
| Every table, column, key and index, and a diagram of how tables relate | [SCHEMA.md](SCHEMA.md) (generated, never edited by hand) |
| The history of the schema: one numbered SQL file per change | [`api/migrations/`](../api/migrations) |
| The queries that read and write it (including every join) | `api/src/**/*.service.ts`, as parameterised queries |
| Why it is built this way, and what is proposed next | [ADR-0012](../docs/00-decisions/ADR-0012-database-structure.md) |

The migrations stay next to the API because the API owns the database and its migration command (`npm run migrate` in `api/`) reads them from there. This folder holds the description of the database, not a second copy of the SQL.

## Rules

- **Migrations are append-only.** A change is a new file, `V<next number>__<what>.sql`. An applied migration is never edited: the runner stores a checksum of each and refuses a file that changed.
- **One person, one role.** The server's admin applies migrations. The API connects as `lira_app`, which can only do what its `GRANT` lines in the migrations allow. It has no right to change tables, and on `audit_log` it can only read and add rows, so the audit trail cannot be edited or deleted by the application.
- **Every query is scoped by organisation.** Tables that belong to an organisation carry `org_id`, and each API query filters on it. There is an integration test per feature that a person of one organisation cannot read or write another's rows.
- **Parameters only.** No SQL is built from request text.
- **Keep the description true.** After adding a migration run `npm run build` and `npm run schema-doc` in `api/`. A test (`api/src/db/schemaDoc.units.test.ts`) fails when `SCHEMA.md` does not match the migrations.

## What is not here yet

There are no views, stored functions, triggers or row-level security, and one schema (`public`). Those are proposed, not decided, in [ADR-0012](../docs/00-decisions/ADR-0012-database-structure.md).

## Run it

```
cd api
npm run build
ADMIN_DATABASE_URL=... APP_DB_PASSWORD=... npm run migrate   # creates the lira_app role and applies the new migrations
npm run schema-doc                                           # rewrites database/SCHEMA.md
```

The tests that need a database run only when `TEST_DATABASE_URL` is set, against a throwaway schema, never a real database (see `api/README.md`).
