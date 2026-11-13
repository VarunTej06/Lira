# Secure coding standard

**Status:** Proposed baseline for the hosted edition. Each rule has an ID so reviews and tests can cite it. Target: OWASP ASVS Level 2.

## 1. Authentication and sessions (ASVS V2, V3)
- **S-1** Sign-in only through the organisation's identity provider using OIDC Authorization Code + PKCE. No passwords stored by Lira.
- **S-2** Validate the ID token: signature (provider JWKS), `iss`, `aud`, `exp`, `nonce`; check `state`.
- **S-3** Session cookie: `HttpOnly; Secure; SameSite=Lax; Path=/`, random 256-bit id, server-side store, absolute lifetime and idle timeout, rotated at sign-in, revoked at sign-out and when a user is disabled.
- **S-4** Never place tokens, session ids or secrets in `localStorage`, `sessionStorage`, URLs, logs or error messages. Non-secret browser settings are read and written through `appStorage` only, so they can be prefixed per user and cleared on sign-out.
- **S-5** CSRF: state-changing requests require a CSRF token header plus an Origin check.
- **S-6** Throttle sign-in callbacks and API calls per user and per IP; return generic errors.

## 2. Authorisation (ASVS V4, API #1 and #5)
- **S-7** Deny by default. Every route declares the permission it needs; a route without one fails the build/test.
- **S-8** Authorise per object: load the object, check the caller's organisation and role on **that** object, then act.
- **S-9** List endpoints and search filter by the caller's accessible spaces in the query itself.
- **S-10** Do not trust client-sent ids for ownership (`org_id`, `author_id`, `reporter_id`); set them from the session.
- **S-11** Admin and import functions are separate permissions with audit.
- **S-12** Return `404` when revealing existence would leak information.

## 3. Input and output (ASVS V5)
- **S-13** Validate at the boundary with strict schemas (zod): types, lengths, enums, UUIDs, ISO dates; reject unknown fields. Never `{...req.body}` into a record (mass assignment).
- **S-14** SQL only through parameterised queries or the query builder. No string concatenation into SQL, shell, file paths or URLs.
- **S-15** File names from users are never used as paths. Generate storage keys server-side.
- **S-16** Rich text is sanitised with an allow-list on write and on render. No `dangerouslySetInnerHTML`, `innerHTML =`, `eval`, `new Function` (a test fails the build on these today: `src/hygiene.test.ts`).
- **S-17** User-supplied links: `http`/`https` only (`safeUrl`). Add `rel="noopener noreferrer"` on `target=_blank`.
- **S-18** Uploads: allow-list MIME types, enforce size limits, verify content type, scan for malware, serve non-images as downloads.
- **S-19** Server-side requests (AI providers, link previews, webhooks): destination host must be on an admin-managed allow-list; block loopback, link-local and private ranges; set timeouts and response size limits.

## 4. Data protection (ASVS V6, V8)
- **S-20** TLS 1.2+ everywhere; HSTS. Encryption at rest for database and storage.
- **S-21** Secrets only in Key Vault (or the platform secret store), injected at runtime. Rotate on schedule and on suspicion.
- **S-22** Least privilege: the API's database role cannot alter schema; the importer and migration roles are separate and time-limited.
- **S-23** Personal data: collect the minimum (name, e-mail, initials); document retention and deletion; honour export/delete requests.
- **S-24** No production data in dev or test. Fixtures are synthetic.

## 5. Errors, logging and audit (ASVS V7)
- **S-25** Clients get `{code, message, requestId}`; no stack traces, SQL or file paths.
- **S-26** Structured logs with request id, user id, org id. Never log secrets, cookies, tokens, ticket bodies or attachments.
- **S-27** Audit every create/update/delete, permission change, sign-in/out, import/export, AI confirm/undo, setting change. Audit rows are append-only.
- **S-28** Alert on repeated authorisation failures, unusual export volume, and role changes.

## 6. Configuration and platform (ASVS V14)
- **S-29** Security headers on every response: CSP (no `unsafe-inline` scripts), `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`.
- **S-30** CORS: exact allowed origins, no wildcard with credentials.
- **S-31** Debug and development features (dev server, source maps with secrets, verbose errors) are off in hosted builds. `LIRA_MODE=hosted` refuses to start in a "no login" configuration.
- **S-32** Request size and rate limits on every route; stricter on uploads, auth and AI.

## 7. Dependencies and supply chain (ASVS V14.2)
- **S-33** Before adding a package: confirm it exists on the registry under that exact name, check downloads/maintenance/licence, read its install scripts. Never add a package just because an AI suggested the name (slop-squatting).
- **S-34** Commit the lockfile; pin versions; `npm audit` must show no high/critical issues; review transitive additions.
- **S-35** Subresource Integrity for any third-party script/style; prefer self-hosting (fonts already are).
- **S-36** Generate an SBOM at release (DevOps step).

## 8. AI features (OWASP LLM Top 10)
- **S-37** Ticket and comment text is data. It is flattened, length-limited, and the prompt states it must not be obeyed. A model output cannot call write functions.
- **S-38** Writes from Viva go through preview → user confirmation → the normal service layer with the user's own permissions → audit.
- **S-39** The context sent to a model contains only data the caller may read. Do not send secrets, other tenants' data, or full attachment bytes.
- **S-40** Per-user and per-org rate and cost limits; log model, token counts and outcome (not the content).

## 9. Review gates
A change that touches authentication, authorisation, validation, sanitising, secrets, file handling, outbound requests or AI context needs: a second reviewer who is a code owner, tests that cover the **negative** case (the thing that must not happen), and a note in the PR naming which rules above apply. The checklist is in [`../04-quality/ai-code-review-checklist.md`](../04-quality/ai-code-review-checklist.md).
