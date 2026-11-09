# ADR-0007: Repository layout and branching

- **Status:** Proposed (recommended in `PUBLIC_EDITION_PLAN.md` section 3, not confirmed)
- **Date proposed:** 2026-11-09
- **Decision owner:** (to be named)

## Context
Today the repository has `lira-app/` (UI plus the dev-server plugin), `data/` (real workspace), and docs. A hosted edition needs a separate API service and shared domain logic. Earlier notes said single-user and multi-user would live on separate branches (ROADMAP, now updated); two long-lived branches that share most code drift apart and need every fix merged twice.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| **A. Monorepo, shared packages, trunk-based** (`packages/core`, `packages/ui`, `apps/local`, `apps/web`, `apps/api`) | One fix lands once; shared types and validation | Restructure cost; needs workspace tooling |
| **B. Long-lived `local` and `public` branches** | No restructure | Drift and double merging |
| **C. Separate repositories** | Clean ownership | Cross-repo changes; version skew |

## Recommendation
Option A with short-lived branches, pull-request review, and feature flags for unfinished work. Move to workspaces in steps (extract `core` first: types, sprint/roadmap logic, Viva's pure intent code, validation schemas). Do not restructure and add features in the same change.

## Consequences
- A one-off restructure PR with no behaviour change, protected by the existing 1585 tests.
- Branch protection and required reviews are enabled in the DevOps step.

## Security and operations impact
Code owners for `docs/02-security`, auth and data-access code. Signed commits recommended.

## Revisit when
A team boundary or release cadence needs independent repositories.
