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
| Backend and database | Lira gets a **real backend service and a real database**. Today the only server code is a plugin inside the Vite dev server that saves the whole workspace as JSON files; it has no accounts and does not exist in a production build. Decided 14 Nov 2026: NestJS on Node.js with TypeScript, and PostgreSQL (ADR 0002, 0003). |
| Audience | Many organisations (SaaS). Each organisation has its own isolated workspace. |
| Sign-in | Microsoft Entra ID, Google, email and password, and email magic link. |
| Joining | Public sign-up creates a new organisation (the person becomes its Owner). Colleagues join an existing organisation by invitation. |
| Roles | All six of the access matrix from the start: Owner, Admin, Space Admin, Member, Viewer, Guest. |
| Groups | An organisation can make groups of people (for example "Managers") and give a group one of the six roles, for the whole organisation or for one space. A person's role is the highest of their own role and the roles of their groups. There is no separate "Manager" role (decided 14 Nov 2026). |
| Offline | Online with a local cache. No offline editing. |
| Local edition | Stays supported beside the hosted edition (JSON files, no accounts). |
| First target | Runs on the owner's PC first. Azure deployment comes in the DevOps step. |
| Market and law | India only at first; India's Digital Personal Data Protection Act 2023. |
| Terms and privacy | Terms and Conditions and a Privacy Policy, accepted at sign-up, with a record of who accepted which version and when. None exist yet: first versions are drafted for a lawyer to review. |
| Data location | Azure regions in India. |
| Deletion | A deleted account or organisation is kept 7 to 10 days with an option to restore, then erased (exact number of days to be fixed). |
| Cookies | Analytics and marketing cookies are wanted, so the landing pages need a cookie consent banner. |
| Age | Adults only for now (18 and over), stated in the Terms and confirmed at sign-up. No parental-consent flow in the first version (decided 14 Nov 2026). |
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
