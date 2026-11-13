# ADR-0004: Tenancy and authorization model

- **Status:** Proposed
- **Date proposed:** 2026-11-09
- **Decision owner:** (to be named)

## Context
Lira's current containers are **Space** (a board with a key such as `CERT`), **Project**, **Sprint**, **Roadmap**, **Team**, **Dashboard**. There are no users, roles or ownership. Every query today reads everything. Multi-user means each request must be limited to what that user may see and change.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| **A. Single organisation (internal tool)** | Simplest; one tenant | Cannot serve several customers |
| **B. Multi-tenant, shared database, `org_id` on every row, + Postgres row-level security** | Efficient; strong isolation if enforced in two places | Every table and query must carry `org_id`; discipline and tests required |
| **C. Database per tenant** | Strongest isolation | Costly to operate and migrate at scale |

Authorization model options: **RBAC** (roles per organisation and per space) vs **ABAC/ReBAC** (attributes or relationships). RBAC is enough for the features in sight.

## Recommendation
Option B with RBAC (if the answer to "many organisations?" is yes; otherwise start with A but still add `org_id`, which costs little). Hierarchy: **Organisation → Space → Ticket**, with Projects, Sprints, Roadmaps and Dashboards belonging to an organisation and optionally scoped to spaces. Roles (see the matrix in `../02-security/access-control-matrix.md`): Org Owner, Org Admin, Space Admin, Member, Viewer, Guest. Enforcement in two layers: (1) an authorisation function called by every API handler, (2) PostgreSQL row-level security keyed on the session's `org_id` as a backstop.

## Consequences
- Every table gets `org_id`; every handler loads the caller's membership first.
- Test suite must include cross-tenant and cross-space negative tests for every route (automatable by iterating the route table).
- Ticket keys (`CERT-12`) become unique per organisation, not globally.
- Search, dashboards, AI context and exports are all filtered by the caller's permissions, including Viva reading "all spaces".

## Security and operations impact
Broken object-level authorisation is the highest risk in the system (OWASP API #1). No endpoint may take an id and return data without checking membership. Audit every permission change.

## Revisit when
Per-object sharing or customer-defined roles are needed.
