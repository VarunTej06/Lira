# Lira: Public Edition Plan

**Status: draft for discussion. Nothing in this document is built yet.** *Update 9 November 2026: the product owner confirmed the target is a multi-user application with SSO, starting within two to three days, and that CI/CD is built in the DevOps step after that.* It records the strategy we talked through, the questions you need to answer before we plan in detail, and a proposed plan to take Lira from a single-user local app to an app that outside users can use, hosted on Azure.

Related documents: [README](README.md) · [SETUP](SETUP.md) · [ROADMAP](ROADMAP.md) (phases of the current app) · [SECURITY_REPORT](SECURITY_REPORT.md) (what is safe today, and what only applies once there are many users)

---

## 1. The goal in one paragraph

Keep today's Lira exactly as it is as the **local edition** (one person, no accounts, data in JSON files, works offline). Add a **public edition** that runs on a server: many people sign in, belong to organisations and teams, have roles, and share one database. Both editions use **the same code** for everything users see and do (sprints, boards, roadmaps, reports, Viva AI). Only two things differ: where data is stored, and who is allowed to do what.

Along the way we finish the application itself: fix the known bugs, close the functional gaps, and reach a quality bar we are proud of before outside people use it.

---

## 2. What we decided and what is still open

| # | Topic | State | Notes |
|---|---|---|---|
| 1 | One app with a **mode setting**: `LIRA_MODE=local` (default, or unset) and `LIRA_MODE=public` | **Decided** | See section 4 |
| 2 | Local edition keeps **JSON files**; the public edition uses a **database** | **Decided** | See section 4 |
| 3 | The UI should not care where data lives | **Decided, with one refinement** | It still needs to know what it is *allowed* to do (for example, whether there is a login). See section 4 |
| 4 | Azure for hosting, **using services other than AKS** (Container Apps, App Service and similar) | **Decided** | See section 7 |
| 5 | DevOps (pipelines, environments, code scanning) is done **after** the app reaches its best version | **Decided**, re-confirmed 9 Nov 2026: CI/CD comes after multi-user and SSO; two cheap things done early | See section 9 |
| 6 | Users sign in through SSO, with roles | **Decided 9 Nov 2026** (multi-user with SSO, starts within days); identity provider still open | See sections 5 and 6 |
| 7 | **Repository layout**: one repo (monorepo) with a shared core and two apps | **Recommended**, not yet confirmed | See section 3 |
| 8 | **Branching strategy**: trunk-based | **Recommended**, not yet confirmed | See section 9 |
| 9 | Everything in section 11 (questions) | **Open** | You answer, then we plan |

---

## 3. Repository layout (recommended)

One repository, two products, no long-lived `local` and `public` branches. Two branches that share about 80% of their code drift apart, and every bug fix has to be merged twice.

```
lira/
├── packages/
│   ├── core/        # Domain types and logic with no browser or file access:
│   │                #   sprints, roadmaps, reports, Viva's intent logic, validation
│   ├── ui/          # Shared React components, themes, motion
│   └── data-port/   # The DataStore interface: "load tickets, save a sprint, list roadmaps..."
├── apps/
│   ├── local/       # Today's app: browser + disk files, no accounts
│   ├── web/         # The public front end: same UI, talks to the API, shows sign-in
│   └── api/         # The public back end: sign-in, roles, PostgreSQL
├── infra/           # Infrastructure as code, pipelines (later)
└── docs/            # Architecture decisions, runbooks
```

The key pattern is **ports and adapters**. The app asks the `DataStore` for data and does not know where it comes from:

| Adapter | Used by | Stores data in |
|---|---|---|
| File adapter | Local edition | JSON files under `data/`, plus the browser cache (as today) |
| API adapter | Public edition | The API, which stores in PostgreSQL |

**When separate repositories would make sense instead:** if the public edition gets its own team, or you want the local edition open-source while the hosted code stays private. The monorepo layout makes that split easy later, so this decision is not permanent.

---

## 4. One app, a mode setting, and settings from the environment

### The mode

| Setting | Meaning |
|---|---|
| `LIRA_MODE` unset, or `local` | Local edition. JSON files, no sign-in. The default, so nothing changes for you today. |
| `LIRA_MODE=public` | Public edition. Needs a database address and sign-in settings. Refuses to start without them. |

### Settings for the public edition (proposed names)

| Variable | Purpose |
|---|---|
| `LIRA_MODE` | `local` or `public` |
| `DATABASE_URL` | PostgreSQL address (in Azure, read from Key Vault, never written in a file) |
| `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_CLIENT_ID` | Which sign-in service to trust |
| `APP_URL`, `ALLOWED_ORIGINS` | The public address and which sites may call the API |
| `STORAGE_ACCOUNT` / container | Where attachments go (public edition) |
| `LOG_LEVEL` | How much to log |

### Build once, configure at run time

We build **one Docker image** and give it different settings per environment (dev, prod). We do not build a different app for each environment. This is what makes promoting a tested build from dev to prod safe, and it keeps the later pipelines simple.

### What the UI is told: capabilities

The UI does not know *where* data lives, but it must know *what it can do*. At start-up the server sends a small list of capabilities:

| Capability | Local | Public |
|---|---|---|
| Save to disk, tablet and phone link, "Other devices" | Yes | No |
| Sign-in, organisations, roles, inviting people | No | Yes |
| API keys stored in the browser | Yes (the user's own) | **No**: AI keys stay on the server |
| Attachments | Inside the ticket file | Blob storage |

### The one hard piece of engineering

Today, components and hooks read the browser database (Dexie) and localStorage directly. Before the public edition is possible, all of that must go **through the DataStore interface**. In the public edition the browser holds a cache only, never the master copy. This is the largest prerequisite (see phase B in section 10), and it also makes the current app easier to test.

---

## 5. Identity: how outside users sign in

**Principles**
- Use **OIDC** (the standard sign-in protocol, with PKCE for browser apps). The API only checks tokens, so the provider can be swapped later.
- **Never build our own passwords.**
- Staff and outside users can come from different places: staff from your company's identity, outside users from a customer-facing identity service.

**Options to compare** (prices and limits change, so verify before committing):

| Option | Good for | Notes |
|---|---|---|
| **Microsoft Entra ID** | Your own staff | Groups can be turned into Lira roles |
| **Microsoft Entra External ID** | Outside users, if you stay on Azure | Has a free tier for monthly active users; verify the current limit and pricing |
| **Auth0 or Clerk** | Fast start, nice sign-in screens | Free tiers; verify limits |
| **Keycloak** (self-hosted) | Full control, free to license | You run and patch it |
| **Cloudflare Access** | A **private beta**: puts an email login in front of the whole app | Free for a small number of users; verify. Not a full user system |
| Okta, Ping | Large companies | Free developer tiers exist but are not meant for real users |

**My lean:** Entra ID for staff, plus Entra External ID or Auth0 for outside users, and Cloudflare Access for any early private beta. Decide after the questions in section 11.

---

## 6. Roles and teams

A **role** says what you may do. A **team** says who you work with. Developers, QA and DevOps are **teams** (the Teams feature in the roadmap), not roles.

### Organisation roles

| Role | Can do |
|---|---|
| **Organisation admin** | Manage users, roles, spaces and settings |
| **Manager / head** | See everything and all reports; edit their own areas |
| **Member** | Read and write in the spaces their team is assigned to |
| **Viewer** | Read only (for example stakeholders) |
| **Guest** | An outside user limited to named spaces |

### Space roles
Space admin, space member, space viewer, so a person can be a Member in one space and a Viewer in another.

### How it is enforced
- The identity service says who you are and which groups you are in; Lira maps groups to roles.
- **The server checks the role on every request.** Hiding a button in the UI is never the protection.
- The database also restricts rows by organisation (row-level security), so a bug in one query cannot leak another organisation's data.

---

## 7. Azure architecture (no AKS)

Everything private except one public door.

```
                    Internet
                       │
          Azure Front Door + WAF   (the only public entry; HTTPS, firewall rules)
                       │ (private link)
        ┌──────────────┴───────────────────────────────┐
        │   Virtual network (private)                  │
        │                                              │
        │   Azure Container Apps                       │
        │   ├─ web   (static front end)                │
        │   └─ api   (Node, validates tokens, roles)   │
        │        │                │             │      │
        │        ▼                ▼             ▼      │
        │  PostgreSQL        Blob Storage   Key Vault  │
        │  (private endpoint)(private)      (secrets)  │
        └──────────────────────────────────────────────┘
   Sign-in: Entra ID / External ID          Telemetry: Application Insights + Log Analytics
```

| Need | Azure service | Why |
|---|---|---|
| Run the app | **Azure Container Apps** (or App Service for Containers) | Simple to operate, scales down to zero for dev, runs the same Docker image everywhere. AKS can come later if scale demands it |
| Container images | **Azure Container Registry** (private) | One image per build, promoted dev to prod |
| Database | **Azure Database for PostgreSQL, Flexible Server** | Managed backups and point-in-time restore; **private access only** |
| Secrets | **Key Vault** + managed identities | No passwords or keys in code or settings files |
| Public entry and firewall | **Azure Front Door with WAF** (or Application Gateway WAF) | Verify which tier is needed to reach private origins |
| Identity | **Entra ID / Entra External ID** (see section 5) | |
| Attachments | **Blob Storage**, private | Today attachments sit inside ticket files; that does not scale |
| Logs, metrics, alerts | **Application Insights, Log Analytics, Azure Monitor** | |
| Invite emails | **Azure Communication Services (Email)** | Needed for "invite a teammate" |
| Viva AI (optional) | **Azure OpenAI**, called **from the server** | Keeps AI keys off the browser. Local edition keeps its own settings |
| Realtime updates (later) | **Azure Web PubSub** or SignalR | For live boards, after the basics |
| Infrastructure as code | **Bicep** (Azure-native) or Terraform | Choose later |
| Pipelines (later) | **GitHub Actions** (sign in to Azure without stored passwords) or Azure DevOps | |
| Budget safety | **Budgets and alerts**, dev scaled to zero, small database tier, stop dev out of hours | Set a monthly cap before creating anything |

**Private by default:** the database, storage, registry and Key Vault have no public address. Only Front Door is public. Developers reach the private parts through a controlled route (for example a jump host or VPN), never by opening the database to the internet.

**Environments**

| | Local machine | Dev | Prod |
|---|---|---|---|
| Purpose | Day-to-day coding | Integration and testing, auto-deployed from `main` | Real users |
| Run with | Docker Compose (app + PostgreSQL), or the local edition on files | Container Apps | Container Apps (or AKS later) |
| Data | Throwaway | Test data | Real; backups and restore drills |
| Release | n/a | Automatic | After approval |

Dev and prod run the **same platform and the same image**, differing only in settings and size.

---

## 8. Data and database (public edition)

- **PostgreSQL**, with every row belonging to an **organisation** (the tenant): organisation, then spaces, then tickets and everything under them.
- **Row-level security** by organisation, plus server-side role checks.
- **Schema validation** on every API call (reject unknown or oversized fields), and database **migrations** under version control.
- **Versioned updates** replace today's "last save wins": two people editing the same ticket get a clear conflict message, not silent overwrite. Realtime sync can follow.
- **Scale:** today the browser loads every ticket. The public edition needs **server-side filtering and paging** so a large organisation stays fast.
- **Import path:** a local backup file can be imported into a public workspace.
- **Backups:** automated backups with point-in-time restore, and a restore drill before launch.
- **Audit log:** who did what and when (today's log records only *what*).

---

## 9. Engineering process

### Branching: trunk-based (recommended)
One `main`; short-lived branches; pull requests with required checks; unfinished work hidden behind feature flags; environments are **promotion steps**, not branches; release tags mark versions. The traditional `develop`/`release`/`main` flow adds merge overhead that only pays off with large teams and scheduled releases. We can change later.

### Do now (cheap, protects quality)
1. **A basic check on every pull request:** type-check, lint, tests, build, `npm audit`.
2. **Build for deployment:** a Dockerfile, a health endpoint, settings from environment variables, a server that keeps no state of its own.

### Do later, once the app is at its best version
Code-quality scanning (for example SonarCloud or CodeQL), container scanning, full CI and CD pipelines, dev and prod environments, infrastructure as code, branch protection and required reviews, and a release process.

### Pipeline shape (target)
Pull request: checks, then merge to `main`: build the image once, scan it, push to the registry, deploy to **dev** automatically, run browser tests against dev, then **prod** after an approval click.

---

## 10. The plan

Time estimates are rough and assume one developer with AI help. They will change once we know the team (question 5 below).

### Track 1: finish the application (runs first, and in parallel after)

**Phase A: Stabilise the local app and tag it as offline v1** (about 2–4 weeks)
- Triage every known bug and gap **inside Lira itself**, using a short "definition of done".
- Fix functional and implementation gaps found in the triage (known areas: Teams and real invites from ROADMAP Phase 3, command palette and bulk edit from Phase 5, phone and tablet tuning for the board and wide tables, accessibility and focus handling, empty states and consistency).
- Add **browser end-to-end tests** (Playwright) for the main flows: board, sprint planning and closing, roadmap, Viva confirm and undo, create ticket, backup and restore.
- Write `CONTRIBUTING.md`, a coding guide and onboarding notes so new people can start.
- **Exit:** triage list empty or consciously deferred, end-to-end tests green, tag `local-v1.0`.

### Track 2: build the public edition

**Phase B: The DataStore port** (about 2–4 weeks)
- Move all data access behind the `DataStore` interface in the current app. No visible change.
- **Exit:** the whole app and test suite run through the interface; the file adapter is the only adapter.

**Phase C: Monorepo and the basic checks** (about 1–2 weeks)
- Extract `core` and `ui`, set up the folders in section 3, add the basic pull-request check from section 9.
- **Exit:** the local app builds and passes tests from the new layout.

**Phase D: Public MVP** (about 6–10 weeks)
- API with token validation, organisations, memberships, roles, and the PostgreSQL schema with row-level security and migrations.
- API adapter, capabilities, sign-in screens, "invite a person", role-aware UI.
- Core features working in public mode first: spaces, tickets, board, sprints. Roadmaps, reports and Viva follow.
- Docker Compose for local development.
- **Exit:** two test organisations, three roles each, cannot see each other's data; automated tests prove it.

**Phase E: Azure environments** (about 2–4 weeks, can overlap Phase D)
- Infrastructure as code for dev, then prod; private networking, Key Vault, registry, Front Door and WAF, monitoring, budget alerts.
- Pipelines: build once, scan, deploy to dev, approve, deploy to prod.
- **Exit:** a merge to `main` reaches dev automatically; prod needs one approval; secrets are never in the repo.

**Phase F: Hardening and beta** (about 3–4 weeks)
- Security review against the 20-point list again, with the new items (roles, tenancy, tokens), then an external penetration test.
- Load, abuse and restore-from-backup tests; monitoring and alerts tuned; privacy terms, a data deletion path, terms of service, a support contact and an incident plan.
- Closed beta with a few real users.
- **Exit:** no open high-severity findings, backup restore proven, beta feedback triaged.

**Phase G: Launch** and then continuous improvement.

### Optional later: offline sync
The local edition could later sync to a cloud workspace (local-first with sync), so one product covers both. It is harder, and we would decide it before Phase B because it affects the data model.

---

## 11. Questions to settle before detailed planning

Please fill in the last column. Where I have a recommendation it is in the third column.

| # | Question | Why it matters | My recommendation | **Your answer** |
|---|---|---|---|---|
| 1 | **Who are the first public users?** Friends or students, colleagues, a company's staff, or paying customers? | Decides the sign-in provider, how strict security must be at launch, and whether billing is needed | Start with a small, invited group (private beta) | |
| 2 | **Which sign-in service?** | Cost, effort, and how roles map | Entra ID for staff; Entra External ID or Auth0 for outside users; Cloudflare Access for the earliest beta | |
| 3 | **Staff and outside users in one organisation, or separate organisations?** | Shapes the data model and roles | Separate organisations, with Guest users for outsiders | |
| 4 | **Business model and licences:** free, paid or open-source, for each edition? | Decides whether billing, plans and licence files are needed | Decide before Phase D | |
| 5 | **How many people will work on this, and by when?** | Sets how much can run in parallel and the realistic dates | | |
| 6 | **Azure details:** which subscription and tenant, which region, a monthly budget cap, and is there a domain name? | Needed before any environment is created | Pick one region close to users; set a low cap with alerts | |
| 7 | **Compute platform:** Container Apps for both dev and prod, or App Service, and revisit AKS later? | Operating effort | Container Apps for both | |
| 8 | **Branching and repository:** monorepo with trunk-based development, as recommended? | Affects every contributor | Yes | |
| 9 | **Data and privacy:** where may user data be stored, which privacy rules apply (for example GDPR), how long are backups kept? | Region choice and legal work | Keep data in one region; 30-day backups | |
| 10 | **Viva AI in the public edition:** use Azure OpenAI from the server, let users bring their own key, or turn it off? | Cost and safety | Server-side Azure OpenAI with per-organisation limits | |
| 11 | **Invites and notifications:** is email enough (Azure Communication Services), or do you also want Teams or Slack? | Scope of Phase D | Email first | |
| 12 | **Offline sync:** should the local edition ever sync to the cloud? | Affects the data model now | Not for v1; keep the door open | |
| 13 | **Name and brand:** is "Lira" clear to use publicly, and is any look or wording borrowed from another product to be avoided? | Legal risk | Check the name; keep the design original | |
| 14 | **Quality bar for "perfect":** what would you accept as done? (for example: zero known high bugs, end-to-end tests on main flows, accessibility pass, performance targets) | Defines the exit of Phase A | Use the list in Phase A | |

---

## 12. Risks

| Risk | What we do about it |
|---|---|
| The data-port refactor touches many files | Do it in small steps with the existing 294 tests; no visible changes until it is done |
| Scope grows ("perfect app") | Triage into must-fix, later and never; exit criteria per phase |
| Cost surprises in Azure | Budget cap and alerts first; dev scales to zero; small database tier |
| Security mistakes in multi-user code | Server-side role checks, row-level security, tests that prove tenants are isolated, external penetration test |
| Two editions drift apart | One repo, shared core, one test suite for both |
| Provider lock-in | Standard OIDC and standard PostgreSQL; infrastructure as code |
| One person is a bottleneck | Contributor guide, tests, and small pull requests so others can join |

---

## 13. Next steps

1. You answer the questions in section 11 (partial answers are fine).
2. We turn the answers into a short **architecture decision record** and a dated plan.
3. We start with Phase A (stabilise) and Phase B (the data port), because both keep today's app fully working.
