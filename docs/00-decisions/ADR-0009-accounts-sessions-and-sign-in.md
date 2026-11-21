# ADR-0009: Accounts, passwords and sessions for the first hosted slice

- **Status:** Accepted (19 Nov 2026) for the first slice: email with password. Google sign-in and single sign-on (ADR-0001) come later and sit beside this.
- **Date proposed:** 2026-11-19
- **Decision owner:** product owner

## Context
The hosted edition needs real accounts. The owner chose, for now, **email with password, and Google later**. The API is NestJS on PostgreSQL (ADR-0002, ADR-0003). The first slice must let a person sign up, log in, stay logged in, and log out, with the controls in `docs/02-security/secure-coding-standard.md`.

## Decision
- **Identity is global, data is per organisation.** One `users` row per person (email unique ignoring case). Signing up also creates an organisation of one with the person as `owner` (ADR-0004). Tickets and other tenant data will carry `org_id` and row-level security; the identity tables have none, because a person must be found before any organisation is known.
- **Passwords:** Argon2id (19 MiB memory, 2 passes, 1 lane, the OWASP minimum), 10 to 128 characters. Only the hash is stored. A wrong email and a wrong password get the same answer and take the same time (a dummy check is run for an unknown email).
- **Sessions:** a random 256-bit token in an `HttpOnly; Secure; SameSite=Lax` cookie. Only its SHA-256 hash is stored, with an expiry: 12 hours, or 30 days with "Remember me". No token in `localStorage`. Log-out deletes the row.
- **Abuse limits:** 5 wrong passwords per email and 20 per network address in 15 minutes pause sign-in (HTTP 429). The counters hold hashes, not the email or address.
- **Cross-site requests:** a call that changes something must come from an allowed origin and carry `X-Requested-With: liraspaces`. Allowed origins are a fixed list in the settings.
- **Input:** every body is checked with a schema that refuses unknown fields; bodies over 16 KB are refused. All SQL is parameterised.
- **Audit:** every sign-up, log-in (success, wrong, locked) and log-out writes a row (who, what, when, from where) to `audit_log`. The application's database role can add and read rows, and cannot change or delete them. This is separate from the application log.
- **Logs and metrics:** JSON lines with a request id; never a body, a password, a token or ticket text. Counters at `/metrics`, which the public web server does not forward.
- **Database roles:** migrations run as the server admin; the API connects as `lira_app`, which owns nothing and cannot create, alter or drop a table.
- **Migrations:** plain SQL files named `V<number>__<name>.sql` (Flyway's form, so Flyway can adopt them unchanged), applied by a small runner that records a checksum and refuses a file that changed after it ran.
- **Health:** `/health` (the process is up) and `/ready` (the database answers).

## Addendum, 21 Nov 2026: Google sign-up and sign-in
The owner asked for it. It is OpenID Connect with the authorisation code and PKCE, as `ADR-0001` says, handled by the API (`src/auth/google-login.service.ts`, `google-id-token.ts`). The browser is sent to Google; the state, the nonce and the PKCE secret are kept in a short-lived, signed, `HttpOnly` cookie, so a callback that this browser did not start is refused. The ID token is accepted only when its RS256 signature matches one of Google's published keys and its issuer, audience (our client id), expiry and nonce are right and Google says the email is verified. Then the same session as for a password is opened. Users get `google_sub` and `email_verified`; `password_hash` may be empty (a Google-only person cannot be logged in by password, and the answer is the same as for a wrong password).

**Linking by email, and the choice made.** There is no email verification for password sign-ups, so an address on a password account has not been proved. If the person who proves an address at Google finds an account already using it, the account is **taken over**: Google's id is attached, the address is marked verified, the **password is removed and every session of the account is ended**. Otherwise someone could sign up with a stranger's address, wait for the stranger to use Google, and keep a password to their account. The cost is that a person who first used a password and then uses Google can no longer log in with the password (a password reset, when built, brings it back). The organisation-level Google connection (Meet and Gmail) is asked for in the same step when the person **signs up** with Google (`?intent=signup`; Google shows each permission and the person may refuse any, in which case nothing is kept); **logging in** with Google asks only for identity. Everyone else connects from the Calls page.

## Consequences
- **Not yet done, and needed before real customers:** email verification and password reset (they need outgoing email), password-breach checking, two-step sign-in, a lock for the whole account after many different addresses fail, deleting expired sessions on a schedule, and the privacy notice entry for the address stored in the audit log.
- Anyone can register any email address until verification exists. Acceptable for the rehearsal only.
- The count of proxies in front of the API (`TRUST_PROXY_HOPS`) must match the real chain, or the per-address limit reads the wrong address.

## Security and operations impact
Covered above. The tests (`api/src/auth/*.test.ts`) include negative cases: forged origin, unknown fields, oversized body, hostile text, a wrong password, a locked account, an expired session, and the database role refusing to change the audit log.

## Revisit when
Google sign-in or single sign-on is added, or before the first real customer signs up.
