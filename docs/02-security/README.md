# Security

| Document | Purpose |
|---|---|
| [`secure-coding-standard.md`](secure-coding-standard.md) | The rules every change must follow (mapped to OWASP ASVS / Top 10). `CLAUDE.md` summarises it for AI assistants |
| [`threat-model.md`](threat-model.md) | What can go wrong in the multi-user design, per component, and what stops it |
| [`access-control-matrix.md`](access-control-matrix.md) | Which role may do what. Becomes the table-driven authorisation test |
| [`../../SECURITY_REPORT.md`](../../SECURITY_REPORT.md) | The 20-point check of today's single-user app, with a re-check dated 9 Nov 2026 |

## Reporting a vulnerability
Report privately to the product owner (name and address to be added before launch). Do not open a public issue. Acknowledge within 2 working days; fix critical issues first. See SOP 03 (incident response).

## What changes when Lira has many users
Things that were harmless for one person become attack paths: HTML in comments (stored XSS), a model base URL typed by a user (request forgery), a shared link token (no individual accountability), and any id-in-URL that is not checked against the caller (broken object-level authorisation). These are called out in the threat model.
