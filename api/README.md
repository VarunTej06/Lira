# Liraspaces API

The hosted edition's server: sign-up, log-in, log-out and "who am I", on PostgreSQL. NestJS 11, Node 22. The decisions are in `docs/00-decisions/ADR-0009-accounts-sessions-and-sign-in.md`.

| Address | What it does |
|---|---|
| `POST /api/auth/signup` | Creates the account, an organisation of one (the person is its owner) and a session |
| `POST /api/auth/login` | Checks the password and starts a session (`remember` makes it last 30 days) |
| `POST /api/auth/logout` | Ends the session |
| `GET /api/me` | Who is signed in, and their organisations (401 when nobody is) |
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

## Database

Migrations are the numbered files in `migrations/`. As the server admin:

```
ADMIN_DATABASE_URL=postgres://admin:...@host:5432/postgres APP_DB_PASSWORD=... npm run migrate
```

It creates the `lira_app` role (which owns nothing) and applies what has not run. A file that was already applied must not change; add a new one.

## Tests

```
npm test                                   # 25 tests, no database needed
TEST_DATABASE_URL=postgres://admin:...@host:5432/postgres npm test   # all 41
```

The database tests create a schema of their own and drop it at the end. They use the application role's real permissions through `role=lira_app` and never change its password. Point them only at a rehearsal or test server.

## Build and run

```
npm run build
node dist/main.js
```

`Dockerfile` builds the image (Debian slim, runs as a normal user). In the hosted setup the web container's nginx forwards `/api/` to this service, so the browser sees one address.

## Not done yet

Email verification, password reset, Google sign-in, a schedule that deletes expired sessions, breach checking of passwords, and the organisation, role and ticket endpoints.
