# Threat model (STRIDE) for the multi-user edition

**Status:** Proposed; part of it is now built (see "What is built, 21 November 2026" at the end). Review again before real users sign up. Scope: browser SPA, API, database, object storage, identity provider, AI providers, secrets. Assets: ticket content (may include confidential work), user identities, attachments, audit log, AI provider keys.

Actors: a legitimate user, a user of another organisation, an external guest, a malicious insider, an anonymous internet attacker, a malicious web page the user visits, a compromised dependency, a prompt-injecting author of a ticket.

## Findings table

| # | Threat | STRIDE | Where | Likelihood | Impact | Mitigation (rule IDs) | Status |
|---|---|---|---|---|---|---|---|
| T1 | User of org A reads or edits org B's ticket by guessing an id | Information disclosure, Tampering | Every object route | High if unchecked | Severe | Per-object authorisation, `org_id` scoping, RLS, negative tests per route (S-7..S-10, S-12) | Design |
| T2 | Stored XSS: a user saves hostile HTML in a comment or description; another user's session runs it | Elevation, Info disclosure | Rich-text fields | High (HTML stored today) | High | Sanitise on write and render, CSP, no inline scripts (S-16, S-29) | Design |
| T3 | Session theft or fixation | Spoofing | Cookies | Medium | High | HttpOnly/Secure cookies, rotation, idle timeout, no tokens in browser storage (S-3, S-4) | Design |
| T4 | CSRF: a hostile page makes the browser send a state-changing request | Tampering | Cookie-authenticated API | Medium | High | SameSite, CSRF token, Origin check (S-5) | Design |
| T5 | Forged or replayed login response | Spoofing | OIDC callback | Low | Severe | `state`, `nonce`, PKCE, token validation (S-1, S-2) | Design |
| T6 | Server-side request forgery through the AI provider base URL or link previews | Info disclosure, Elevation | AI settings, outbound calls | Medium (today the URL is user-typed) | High | Admin-only allow-list, block private ranges (S-19) | Design |
| T7 | Prompt injection: ticket text tells the assistant to leak data or change records | Tampering, Info disclosure | Viva | High | Medium | Text is data; model cannot write; preview + confirm; permission-filtered context (S-37..S-39) | Partly exists today |
| T8 | Mass assignment: client sets `org_id`, `reporter_id`, `role`, `version` | Tampering, Elevation | Create/update routes | Medium | High | Strict schemas, server-set ownership (S-10, S-13) | Design (partial today) |
| T9 | Privilege escalation: member makes themselves admin | Elevation | Membership routes | Medium | Severe | Role changes need admin permission, audited, cannot exceed own role (S-7, S-27) | Design |
| T10 | Leaver keeps access | Elevation | Sessions, IdP | Medium | High | Disable user revokes sessions; periodic access review (SOP 05) | Design |
| T11 | Malicious upload (malware, HTML/SVG with script, huge file) | Tampering, DoS | Attachments | Medium | High | MIME allow-list, scan, size limits, download-only for non-images, separate origin (S-18) | Design |
| T12 | Secrets leak (repo, logs, browser, backups) | Info disclosure | Config, AI keys | Medium | Severe | Key Vault, secret scanning, no secrets in logs (S-21, S-26) | Design |
| T13 | Dependency compromise or slop-squatted package | Tampering | npm supply chain | Medium | Severe | Verify packages, lockfile, audit, SBOM (S-33..S-36) | Process |
| T14 | Denial of service: huge bodies, expensive queries, AI abuse | DoS | API | Medium | Medium | Size and rate limits, pagination caps, query timeouts, AI budgets (S-32, S-40) | Design |
| T15 | Log or audit tampering; repudiation | Repudiation | Audit log | Low | High | Append-only table, restricted grants, central log shipping (S-27) | Design |
| T16 | Data loss: bad migration, deletion, region outage | Tampering, DoS | Database | Medium | Severe | PITR backups, tested restore, migration review (SOP 02, 01) | Process |
| T17 | Shared LAN token gives anonymous access (today's tablet mode) | Spoofing | Local edition only | Low (local network) | Medium | Not available in hosted edition; per-user sessions replace it (S-31) | Documented |
| T18 | Insecure defaults reach production (dev server, debug, no-login mode) | Elevation | Config | Medium | Severe | `LIRA_MODE=hosted` guards, startup checks (S-31) | Design |
| T19 | Cross-tenant leak through search, dashboards, exports or AI context | Information disclosure | Aggregations | High if forgotten | Severe | All aggregate queries share the same permission filter; tests on each (S-9, S-39) | Design |
| T20 | Clickjacking / UI redress | Tampering | SPA | Low | Medium | `frame-ancestors 'none'` (exists today as a meta/headers policy) | Exists |

## Trust boundaries
1. Internet ↔ Front Door/WAF. 2. Browser ↔ API (untrusted client). 3. API ↔ database/storage (private network, managed identity). 4. API ↔ identity provider. 5. API ↔ AI providers (data leaves the platform). 6. Importer ↔ production database (privileged, temporary).

## Residual risks to accept explicitly
- AI answers can still be wrong or misleading even though they cannot change data.
- A compromised identity-provider account is only as safe as the provider's MFA and policies.

## Review
Revisit when: a new route group is added, a new data type or external integration appears, or after any security incident. Owner: security lead (to be named).

## What is built, 21 November 2026 (version 4.0.0)

Checked against the code, not a pen test. "Built" means the control exists and has a test.

| Threat | State |
|---|---|
| T1, T19 Another organisation's data | Built for tickets, spaces, objects, kv, attachments, teams, grants, invitations and calls: every route is scoped by organisation and authorised per object; row-level security applies a second time; tests use two organisations. Dashboards and search across data are only as safe as these routes, which they use |
| T2 Stored XSS | Comments are stored as escaped or sanitised HTML and rendered sanitised; the new quick comment on a call row escapes what is typed. Not independently tested |
| T3, T4 Sessions and CSRF | Built: `HttpOnly`, `Secure`, `SameSite` cookie; calls that change something need an allowed origin and the header `X-Requested-With` |
| T5 Forged login response | Built for Google: state, nonce and PKCE in a signed cookie; the ID token is checked for signature, issuer, audience, expiry, nonce and verified email |
| T8 Mass assignment | Built: zod schemas refuse unknown fields; ownership and `org_id` are set by the server |
| T9 Privilege escalation | Built: only the Owner changes roles and the Admin's right to manage access; the owner cannot be changed or removed |
| T11 Uploads | Partly: private container, short-lived addresses, size checked after upload, always a download. No virus scan, no content sniffing |
| T12 Secrets | Partly: Key Vault in the rehearsal, a separate key encrypts Google refresh tokens. No secret scanning in a pipeline yet |
| T14 Denial of service | Partly: body size limits, login attempt limits. No general rate limit |
| T15 Audit | Built: `audit_log` is insert-only for the application role |
| T6, T7, T10 | Not built or not applicable yet: AI runs in the browser, no organisation AI settings, no sign-out of leavers beyond removing the membership |

New risks that came with the hosted edition and are accepted for the rehearsal: a person who signs up with a password for someone else's address (nothing proves the address) until that person signs in with Google, which takes the account over and removes the password (ADR-0009); no email verification and no password reset yet.
