# Liraspaces API

The hosted edition's server: sign-up, log-in, log-out and "who am I", on PostgreSQL. NestJS 11, Node 22. The decisions are in `docs/00-decisions/ADR-0009-accounts-sessions-and-sign-in.md`.

| Address | What it does |
|---|---|
| `POST /api/auth/signup` | Creates the account, an organisation of one (the person is its owner) and a session |
| `POST /api/auth/login` | Checks the password and starts a session (`remember` makes it last 30 days) |
| `POST /api/auth/logout` | Ends the session |
| `GET /api/me` | Who is signed in, and their organisations (401 when nobody is) |
| `GET /api/orgs/:orgId/spaces`, `POST` | List, create spaces of an organisation (owner and admin only for now; everyone else gets 403, a stranger 404) |
| `PATCH`, `DELETE /api/orgs/:orgId/spaces/:id` | Change or delete a space. The body carries the `version` the caller saw; an older one gets 409 |
| `GET`, `POST /api/orgs/:orgId/spaces/:spaceId/tickets` | List the tickets of a space, create one (the server gives the key, such as LIRA-12) |
| `GET`, `PATCH`, `DELETE /api/orgs/:orgId/tickets/:id` | One ticket. Changes and deletes carry the `version`; a parent or epic must be in the same space. These routes accept bodies up to 512 KB, all others 16 KB |
| `POST /api/orgs/:orgId/tickets/:id/attachments` | Asks to attach a file (name, size, type): gets a short-lived upload address for Blob Storage (10 minutes). The file goes straight from the browser to storage |
| `POST /api/orgs/:orgId/attachments/:attId/confirm` | After the upload: the server checks the file is in storage with the declared size, then lists it. A wrong size removes the file |
| `GET /api/orgs/:orgId/tickets/:id/attachments`, `GET /api/orgs/:orgId/attachments/:attId/download` | List the files of a ticket; get a 5-minute download link (always a download, never shown as a page) |
| `DELETE /api/orgs/:orgId/attachments/:attId` | Deletes the row and the stored file. Deleting a ticket or a space removes its files too |
| `GET`, `PUT /api/orgs/:orgId/kv` | The settings-style data (projects, roadmaps, sprint goals, teams, stand-ups, dashboards, preferences). `shared` is for the organisation (owner and admin only for now), `mine` is the caller's own preferences. A value is the text the app holds, null removes it. AI keys are refused. Bodies up to 512 KB |
| `GET /api/orgs/:orgId/access` | The caller's role and whether they may manage people and access |
| `GET/PATCH/DELETE /api/orgs/:orgId/members` | People of the organisation. Roles and an Admin's right to manage access are the owner's to change; the owner cannot be changed or removed |
| `GET/POST/PATCH/DELETE /api/orgs/:orgId/teams`, `PUT .../teams/:id/members` | Teams and who is in them |
| `GET/POST/DELETE /api/orgs/:orgId/grants` | View, Edit or Manage for a person or team on a space, project, roadmap or dashboard (ADR-0010) |
| `GET/PUT/DELETE /api/orgs/:orgId/objects/:kind/:id` | Projects, roadmaps and dashboards, one row each, with versions. The list holds only what the caller may view |
| `GET/POST/DELETE /api/orgs/:orgId/invitations`, `POST /api/invitations/accept` | Invitations by email: single use, 7 days, for the invited address only; only a hash of the link is stored |
| `GET /health`, `GET /ready` | The process is up; the database answers |
| `GET /metrics` | Counters as text. Not forwarded by the public web server |

Calls that change something must come from an allowed origin and carry `X-Requested-With: liraspaces`.

## Settings (environment variables)

| Name | Meaning | Default |
|---|---|---|
| `DATABASE_URL` | Connection as the `lira_app` role | required |
| `DATABASE_SSL` | `require` or `disable` (a local test database only) | `require` |
| `ALLOWED_ORIGINS` | Comma-separated, each exactly `https://host` | required |
| `COOKIE_SECURE` | `true` or `false` (`false` only on plain http for local work) | `true` |
| `TRUST_PROXY_HOPS` | Proxies in front of the API, for reading the client address | `1` |
| `SESSION_HOURS`, `REMEMBER_DAYS` | Session lengths | `12`, `30` |
| `PORT` | | `8080` |
| `STORAGE_ACCOUNT`, `STORAGE_KEY` | Blob Storage account and key for attachments, set together. Without them the attachment routes answer 503 | none |
| `STORAGE_CONTAINER` | Name of the private container | `attachments` |

## Database

Migrations are the numbered files in `migrations/`. As the server admin:

```
ADMIN_DATABASE_URL=postgres://admin:...@host:5432/postgres APP_DB_PASSWORD=... npm run migrate
```

It creates the `lira_app` role (which owns nothing) and applies what has not run. A file that was already applied must not change; add a new one.

## Tests

```
npm test                                   # 57 tests, no database needed
TEST_DATABASE_URL=postgres://admin:...@host:5432/postgres npm test   # all 130
```

The database tests create a schema of their own and drop it at the end. They use the application role's real permissions through `role=lira_app` and never change its password. Point them only at a rehearsal or test server.

On this machine a throwaway container works too (it is removed when stopped): `docker run -d --rm --name lira-test-pg -e POSTGRES_PASSWORD=testonly -p 127.0.0.1:55432:5432 postgres:16-alpine`, then `TEST_DATABASE_URL=postgres://postgres:testonly@127.0.0.1:55432/postgres TEST_DATABASE_SSL=disable npm test`. The test files run one at a time because they share the server.

## Build and run

```
npm run build
node dist/main.js
```

`Dockerfile` builds the image (Debian slim, runs as a normal user). In the hosted setup the web container's nginx forwards `/api/` to this service, so the browser sees one address.

## Not done yet

Email verification, password reset, Google sign-in, a schedule that deletes expired sessions, breach checking of passwords, sending email (an invitation shows its link to copy until a Gmail sender is connected), stand-ups, and rows of their own for sprint goals, stand-ups, the team directory and board settings (those stay in the shared settings, Owner and Admin only).
