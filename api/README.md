# Liraspaces API

The hosted edition's server: sign-up, log-in, log-out and "who am I", on PostgreSQL. NestJS 11, Node 22. The decisions are in `docs/00-decisions/ADR-0009-accounts-sessions-and-sign-in.md`.

| Address | What it does |
|---|---|
| `POST /api/auth/signup` | Creates the account, an organisation of one (the person is its owner) and a session |
| `POST /api/auth/login` | Checks the password and starts a session (`remember` makes it last 30 days) |
| `POST /api/auth/logout` | Ends the session |
| `GET/PUT /api/me/reminders` | The signed-in person's own switches for reminder emails (`calls`, `due`; `available` says whether the server can send email). A clock inside the API (every minute, only when `MAIL_CONNECTION_STRING` is set and `REMINDERS` is not `false`) emails the people invited to a call 15 minutes before it starts, and the assignee of a ticket the day before it is due (from 07:00 UTC). A reminder is claimed in `reminders_sent` before it is sent, so two copies of the API never send it twice. A ticket's assignee is a name, so the email goes only when exactly one member of the organisation has that name and may see the space |
| `GET /api/orgs/:orgId/google` | Whether Google is set up and connected, and `calendar`: whether the connection has the Calendar permission. A call then becomes an event in the connected account's calendar (`sendUpdates=all`, so Google emails the invitations and any change or cancellation; a repeating call is one repeating event ending with its last start) and `standup_calls.calendar_event_id` remembers it; an event the owner deleted in Google is made again on the next change. Without the permission the invitations go by Gmail as before. An owner who connected before is asked to approve once more ("Allow calendar invitations") |
| `GET /api/orgs/:orgId/events` | A stream of server-sent events: `{ kind: 'ticket' | 'space', spaceId }` each time a ticket or space of the organisation is made, changed or deleted, or access to a space changes. A note names no title or text; the page asks the API again, which checks access as always. Each note is passed on only to people who may see that space, the session is checked again for each note and the stream ends when it is gone or after 55 minutes (the page reconnects), a comment every 25 seconds keeps proxies from closing it, and one person may hold 6 open. It works with several copies of the API: a write publishes through PostgreSQL `NOTIFY` and every copy `LISTEN`s. Projects, roadmaps, dashboards and settings do not push yet |
| `POST /api/auth/verify-email` | Confirms the address a link was sent to (`{ token }`); the link works once, for 24 hours |
| `POST /api/auth/resend-verification` | The signed-in person asks for a new confirmation link (three an hour at most) |
| `POST /api/auth/forgot-password` | `{ email }`: always answers 204 whether or not the address has an account, and emails a reset link when it does; for an account that signs in with Google (which never has a password) it emails an explanation and no link (503 when email is not set up) |
| `POST /api/auth/reset-password` | `{ token, password }`: sets the new password with a link that works once, for one hour, ends every session of the account and confirms the address |
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
| `GET/POST/DELETE /api/orgs/:orgId/invitations`, `POST /api/invitations/accept` | Invitations by email: single use, 7 days, for the invited address only; only a hash of the link is stored. An invitation may name one space and an access level (`spaceId`, `level`: view, edit or manage; not for an Admin): accepting it joins the organisation and grants only that space. It can also carry `shares` (`projects`, `roadmaps`, `dashboards`, `sprints`, each on unless set false): what else of the space the person sees. `organisations` lists the person's own workspace first, then the ones shared with them; each carries `hideSprints` |
| `GET /api/orgs/:orgId/spaces/:spaceId/shares`, `PUT .../shares/:userId` | Who was invited to a space and their switches; the PUT changes some of them (needs the right to manage access; only a person who was invited to the space can be changed) |
| `GET/POST/PATCH/DELETE /api/orgs/:orgId/standups`, `GET .../standups/audience` | Calls, once or repeating (every day, weekday or week until a last day, at most a year, in a time zone), each for the whole organisation (a stand-up), a space, a project or a sprint (`scopeType`, `scopeId`, `scopeName`; fixed once made). The link is pasted (Google Meet or Microsoft Teams, https only, those hosts only) or, when none is given and Google is connected, made as a Meet link. Owner and Admin schedule, change and delete and see who is invited; everyone else sees only the calls they are invited to, directly or through a team. Each invited person is emailed once when the call is made |
| `GET /api/orgs/:orgId/google`, `POST .../google/connect`, `DELETE .../google`, `GET /api/google/callback` | The organisation's connected Google account (the Owner connects it; Admins may see its status). Keeps only an encrypted refresh token. Makes Meet links and sends invitation emails. See `docs/03-sop/google-setup.md` |
| `GET /api/auth/providers`, `GET /api/auth/google/start`, `GET /api/auth/google/callback` | Signing up and in with Google (OpenID Connect, code flow with PKCE, state and nonce in a short signed cookie; the ID token is checked for signature, issuer, audience, expiry, nonce and a verified email). Needs the `GOOGLE_*` settings. With `?intent=signup` (the landing page button) it also asks for the Meet and Gmail permissions and keeps the refresh token, encrypted, for the new owner's organisation; log-in asks only for identity. A new person gets an account and an organisation as owner; an earlier password account for the same address is taken over and its password removed |
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
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY` | The Google OAuth client and the 32-byte (base64) key that protects stored tokens. All four together, or none: without them Google is off, a stand-up needs a pasted link and no email is sent | none |

## Database

Migrations are the numbered files in `migrations/`. As the server admin:

```
ADMIN_DATABASE_URL=postgres://admin:...@host:5432/postgres APP_DB_PASSWORD=... npm run migrate
```

It creates the `lira_app` role (which owns nothing) and applies what has not run. A file that was already applied must not change; add a new one.

## Tests

```
npm test                                   # 108 tests, no database needed
TEST_DATABASE_URL=postgres://admin:...@host:5432/postgres npm test   # all 258
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

A schedule that deletes expired sessions, breach checking of passwords, a Microsoft Teams link creator, reminders before a call, putting calls into the Google Calendar, changing one day of a series, and rows of their own for sprint goals, the team directory and board settings (those stay in the shared settings, Owner and Admin only).
