# Decisions to settle before implementation

Implementation of multi-user + SSO should not start until the **Must** decisions below are **Accepted**. Each decision is a short record (see [`ADR-TEMPLATE.md`](ADR-TEMPLATE.md)) with the options, a recommendation, and the consequences. Status values: **Proposed** (recommendation written, not decided) → **Accepted** → **Superseded**.

Already decided (from `PUBLIC_EDITION_PLAN.md` and the product owner):

- Target is a multi-user application with SSO (9 Nov 2026).
- Hosted on Azure, using services other than AKS (Container Apps, App Service and similar).
- CI/CD, environments and code scanning are built in a DevOps step **after** multi-user + SSO.
- The existing local edition keeps working (JSON files, no accounts).

## Decision register

| ADR | Decision | Priority | Status | Blocks |
|---|---|---|---|---|
| [0001](ADR-0001-identity-provider-and-sso.md) | Identity provider and SSO protocol | Must | Proposed | Everything auth |
| [0002](ADR-0002-backend-runtime-and-api.md) | Backend runtime and API style | Must | Proposed | API, data layer |
| [0003](ADR-0003-database.md) | Database | Must | Proposed | Data model, migration |
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

1. Which identity provider does the organisation already use (Microsoft Entra ID, Google Workspace, Okta, other)? One provider or several?
2. Single organisation (internal tool) or many organisations (SaaS)? This changes tenancy (ADR 0004) and cost.
3. Expected size: users, tickets, attachments per organisation? (Sizing for ADR 0003 and 0006.)
4. Any compliance regime (GDPR, SOC 2, ISO 27001, data residency)?
5. Must it work offline for a user, or is "online with a local cache" acceptable? (ADR 0005.)
6. Is the existing local edition still supported long term, or only a migration source?
