# Lira documentation

Start here. Everything under `docs/` is written for the **multi-user, SSO** stage of Lira (decided 9 November 2026). Anything that is a proposal, not a fact about today's code, is marked **Proposed**.

| Folder | What it holds | Read it when |
|---|---|---|
| [`00-decisions/`](00-decisions/README.md) | The decisions to settle **before** implementation, as short decision records, plus a readiness checklist | Before writing any multi-user code |
| [`01-architecture/`](01-architecture/README.md) | Current-state baseline, High-Level Design (HLD), Low-Level Design (LLD) | Designing or reviewing structure |
| [`02-security/`](02-security/README.md) | Secure-coding standard, threat model, access-control matrix | Touching auth, data, input, AI, or secrets |
| [`03-sop/`](03-sop/README.md) | Standard operating procedures: release, backup/restore, incident, access, dependencies, onboarding | Running or supporting the system |
| [`04-quality/`](04-quality/README.md) | Definition of done, code-review checklist for AI-assisted code, test strategy, today's measured baseline, the manual test checklist | Writing or reviewing code |
| [`05-presentations/`](05-presentations/README.md) | PowerPoint deck for stakeholders | Presenting the plan |

Other documents (older, still maintained): root [`README.md`](../README.md), [`SETUP.md`](../SETUP.md), [`TESTING.md`](../TESTING.md), [`SECURITY_REPORT.md`](../SECURITY_REPORT.md) (single-user security check), [`ROADMAP.md`](../ROADMAP.md), [`PUBLIC_EDITION_PLAN.md`](../PUBLIC_EDITION_PLAN.md), and the nine design notes in [`Prompts and Architectures/`](../Prompts%20and%20Architectures/). [`CLAUDE.md`](../CLAUDE.md) holds the rules AI coding assistants must follow.

## Reading order for a new engineer

1. Root `README.md` and `SETUP.md` (what Lira is, run it).
2. `01-architecture/current-state.md` (how it works today).
3. `01-architecture/HLD.md`, then `LLD.md` (where it is going).
4. `02-security/secure-coding-standard.md`.
5. `04-quality/definition-of-done.md`.

## Status of these documents

Written 9 November 2026 from the code at commit `4eb938e` (branch `v3.4.1`). Facts about the current code were checked against the repository; design sections for the multi-user stage are **Proposed** until the matching decision record in `00-decisions/` is accepted.
