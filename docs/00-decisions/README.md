# Decisions to settle before implementation

Implementation of multi-user + SSO should not start until the **Must** decisions below are **Accepted**. Each decision is a short record (see [`ADR-TEMPLATE.md`](ADR-TEMPLATE.md)) with the options, a recommendation, and the consequences. Status values: **Proposed** (recommendation written, not decided) → **Accepted** → **Superseded**.

Already decided (from `PUBLIC_EDITION_PLAN.md` and the product owner):

- Target is a multi-user application with SSO (9 Nov 2026).
- Hosted on Azure, using services other than AKS (Container Apps, App Service and similar).
- CI/CD, environments and code scanning are built in a DevOps step **after** multi-user + SSO.
- The existing local edition keeps working (JSON files, no accounts).

## Confirmed requirements (product owner, 13 Nov 2026, branch `v4.0.0`)

These are decided. Where a decision record below still says Proposed, it is because its technology choice is not settled yet, not because the requirement is in doubt.

| Topic | Requirement |
|---|---|
| New product name and logo | The product is renamed. "Lira" is already used by other products, so a new name that is not in use is chosen and the logo is redrawn. The new name and logo then replace the old ones everywhere they are shown: app, landing pages, documents, browser tab and phone icon. The name is Liraspaces and the logo is the hexagon with an open book (19 Nov 2026, files in `docs/07-brand/logo/`). Internal names in the code, such as the `lira_` settings keys, can stay to avoid touching saved data (confirmed 17 Nov 2026). |
| Backend and database | Lira gets a **real backend service and a real database**. Today the only server code is a plugin inside the Vite dev server that saves the whole workspace as JSON files; it has no accounts and does not exist in a production build. Decided 14 Nov 2026: NestJS on Node.js with TypeScript, and PostgreSQL (ADR 0002, 0003). |
| Audience | Many organisations (SaaS). Each organisation has its own isolated workspace. |
| Sign-in | Microsoft Entra ID, Google, email and password, and email magic link. |
| Joining | Public sign-up creates a new organisation (the person becomes its Owner). Colleagues join an existing organisation by invitation. |
| Roles | All six of the access matrix from the start: Owner, Admin, Space Admin, Member, Viewer, Guest. |
| Groups | An organisation can make groups of people (for example "Managers") and give a group one of the six roles, for the whole organisation or for one space. A person's role is the highest of their own role and the roles of their groups. There is no separate "Manager" role (decided 14 Nov 2026). |
| Privacy between organisations | One organisation's data is never visible to anyone outside it. This holds for every space, ticket, roadmap, sprint, file and comment. A person who signs up alone has an organisation of one, and nobody else can see it. Inside an organisation, a person sees only what their role (their own and their groups') allows. The server enforces this on every request, and tests prove that a user of organisation A cannot read or write organisation B (13 Nov 2026 requirement, restated 18 Nov 2026). |
| Single user | Someone can sign in alone (for example with Gmail) and use all of Lira. They can then create teams, invite friends and set their access. A single user is an organisation of one, not a special case. |
| Public pages and app address | In the hosted edition only: a landing page, a login page, a sign-up page and legal pages (User Notice, Privacy Policy) in the same app. After sign-in the app lives under `/app`. The local edition has no sign-in and opens straight into the app. Login and sign-up must really work (18 Nov 2026). The screens were built on 19 Nov 2026 (landing, log in, sign up, legal drafts, coming-soon page; `npm run build:hosted`); log in and sign up send nothing until the server exists. Sign-in methods for now: email with password, and Google. |
| Landing and login content | The landing page, login and sign-up take their structure from well-known work-tracking sites (study only: no copied text, images, colours or code, and no mention of any other product in our code). The login tab title is "Log in to continue". Login offers email, and Continue with Google; other providers come later. One dark and one light palette. |
| Logo after sign-in | Clicking the logo of a signed-in user opens a separate "coming soon" page (it is being baked); its real content is decided later. |
| Login security | The app must resist attack and follow `docs/02-security/secure-coding-standard.md`. HTTPS only (redirect and HSTS). Passwords are never stored (only a salted Argon2id hash) and never written to logs, the console, URLs, error messages or analytics. Rate limiting and lockout on sign-in, sign-up, password reset and email sending. Sessions in `HttpOnly; Secure; SameSite` cookies. No account enumeration. Email verification. Note: a password necessarily travels in the sign-in request body, so it is visible to its own owner in the browser's Network tab; it is protected by HTTPS and never visible to anyone else (18 Nov 2026). |
| Product name | **Chosen on 18 Nov 2026: Liraspaces** (the owner may change it later and will say so; Skolarspace was the fallback). Domain `liraspaces.com` bought by the owner on 18 Nov 2026 for one year (renew before Nov 2027; `.app` and `.in` not yet bought). Open concern: LIRA marks exist in classes 9 and 42 (a pending application by Lira Technologies LLC, and an active registration by Wirescan AS), so the IP India and WIPO trademark search is still to be done. The logo is drawn next (a first attempt with the registrar's logo maker, then a designed one), then the visible rename (the internal `lira_` storage keys stay). |
| Offline | Online with a local cache. No offline editing in the hosted edition. |
| Local edition | Stays supported beside the hosted edition. Anyone with the code can install it and run it on their own PC with no sign-in; it starts empty and keeps its data in JSON files on that PC. It is also what the owner uses if the hosted edition is stopped to avoid cost. "PC Saved" is shown in the local edition only. |
| Download my data | The hosted edition has a "Download my data" action that gives one zip in the same folder layout as the local `data/` folder, so someone with the code can unzip it into `data/` and carry on in the local edition. It respects the person's role (an Owner gets the whole organisation, a Member only what they can see), contains no secrets or password hashes, and each download is written to the audit log (18 Nov 2026). |
| First target | Runs on the owner's PC first. Azure deployment comes in the DevOps step. |
| Market and law | India only at first; India's Digital Personal Data Protection Act 2023. |
| Terms and privacy | Terms and Conditions and a Privacy Policy, accepted at sign-up, with a record of who accepted which version and when. None exist yet: first versions are drafted for a lawyer to review. |
| Data location | Azure regions in India. |
| Deletion | A deleted account or organisation is kept 7 to 10 days with an option to restore, then erased (exact number of days to be fixed). |
| Cookies | Analytics and marketing cookies are wanted, so the landing pages need a cookie consent banner. |
| Age | Adults only for now (18 and over), stated in the Terms and confirmed at sign-up. No parental-consent flow in the first version (decided 14 Nov 2026). |
| MCP server | Lira gets an MCP server so AI assistants can work with it (list, search and view tickets, sprints and roadmaps; later create and change them). Built in TypeScript on top of the multi-user API, after that API works. It acts as the signed-in person, never with a shared key, and is limited by that person's role and organisation. First version is read-only; write tools need a preview, confirmation and undo, as the Viva rules already require. Every change through it is audited as coming from an assistant (confirmed 17 Nov 2026). |
| Pricing page | Built behind a feature flag and switched on later. |
| Tests and documents | Unit tests for everything new, every README and document kept true, and Playwright browser tests for the whole application before the DevOps step starts. |

Consequences that are now requirements too: an email-sending service (magic links, password resets, invitations), and the security work a password login brings (hashing, reset flow, lockout, email verification).

## Decision register

| ADR | Decision | Priority | Status | Blocks |
|---|---|---|---|---|
| [0001](ADR-0001-identity-provider-and-sso.md) | Identity provider and SSO protocol | Must | Proposed | Everything auth |
| [0002](ADR-0002-backend-runtime-and-api.md) | Backend runtime and API style | Must | **Accepted** (NestJS on Node.js, 14 Nov 2026) | API, data layer |
| [0003](ADR-0003-database.md) | Database | Must | **Accepted** (PostgreSQL; Flyway to be confirmed, 14 Nov 2026) | Data model, migration |
| [0004](ADR-0004-tenancy-and-authorization.md) | Tenancy and authorization model | Must | Proposed | Every query |
| [0005](ADR-0005-client-data-sync-and-offline.md) | Client data layer, sync and offline behaviour | Must | Proposed | UI data access |
| [0006](ADR-0006-hosting-on-azure.md) | Hosting topology on Azure | Should | Proposed | DevOps step |
| [0007](ADR-0007-repository-and-branching.md) | Repository layout and branching | Should | Proposed | Code organisation |
| [0008](ADR-0008-data-migration.md) | Migration of existing JSON data | Must | Proposed | First deploy |
| [0009](ADR-0009-accounts-sessions-and-sign-in.md) | Accounts, passwords and sessions (first slice) | Must | Accepted (19 Nov 2026) | Built |

## Readiness checklist (gate before coding)

- [ ] ADR 0001–0005 and 0008 are Accepted.
- [ ] Roles and permissions in [`../02-security/access-control-matrix.md`](../02-security/access-control-matrix.md) reviewed by the product owner.
- [ ] Threat model [`../02-security/threat-model.md`](../02-security/threat-model.md) reviewed; open risks have owners.
- [ ] HLD and LLD reviewed; the "open questions" sections are empty or have owners.
- [ ] Baseline quality numbers recorded ([`../04-quality/baseline-metrics.md`](../04-quality/baseline-metrics.md)) so progress can be measured.
- [ ] Test strategy agreed, including tenant-isolation tests.
- [ ] Someone is named as owner for each SOP in [`../03-sop/`](../03-sop/README.md).

## Open questions for the product owner

Answered on 13 Nov 2026 (see "Confirmed requirements" above): identity providers, single or many organisations, compliance regime, offline, and the future of the local edition. Still open:

1. Migration tool: Flyway is recommended with the accepted NestJS and PostgreSQL stack; the owner has not confirmed it yet (the alternative is Prisma Migrate).
2. Sign-in library or managed identity service for the four sign-in methods: candidates still to be compared.
3. Email service for magic links, password resets and invitations, and the sending address.
4. Which analytics and marketing tools (each must be named in the Privacy Policy).
5. Expected size: organisations, users, tickets, attachments per organisation (sizing for ADR 0003 and 0006).
6. Whether the owner's current workspace in `data/` is imported as the first organisation (ADR 0008).
7. Viva AI keys: each organisation's own, or one provided by Lira.
8. Legal entity (company name and address) and a privacy contact address, for the Terms and the Privacy Policy.
9. Product name and domain. The name "Lira" is already used by other products, so a new, unused name is to be found (14 Nov 2026); the logo is then redrawn and the name replaced everywhere it is shown.
10. The exact deletion grace period: 7 or 10 days.
11. Landing-page palettes: the landing pages have a dark mode and a light mode, each using one of the app's palettes (dark: Pace or Blackridge; light: Sorrel, Fawn, Mossgrove or Tidewell). Which one of each is not decided (raised 15 Nov 2026).
12. Landing-page references and animation library: the owner will send reference sites; highly animated on scroll, not a copy of any of them. Whether to add a scroll-animation library beside Framer Motion is not decided.
