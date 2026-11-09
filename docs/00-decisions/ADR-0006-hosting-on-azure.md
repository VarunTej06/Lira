# ADR-0006: Hosting topology on Azure

- **Status:** Proposed (the choice of Azure without AKS is already decided in `PUBLIC_EDITION_PLAN.md`)
- **Date proposed:** 2026-11-09
- **Decision owner:** (to be named)

## Context
Hosting must be Azure and must not use AKS. CI/CD is built after the multi-user and SSO work, so this ADR sets the target shape without building it yet.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| **A. Azure Container Apps** (API) + Static Web Apps or Blob+CDN (SPA) | Scale to zero, simple ops, supports containers and revisions | Fewer knobs than AKS |
| **B. Azure App Service** (Linux, Node) | Familiar, built-in slots and TLS | Less container flexibility |
| **C. Azure Functions** | Pay per use | Awkward for long-lived SSE/WebSocket connections |

## Recommendation
Option A. Components (see HLD): Front Door with WAF in front of the SPA and API; Container Apps for the API; PostgreSQL Flexible Server on private networking; Blob Storage for attachments; Key Vault for secrets; Application Insights/OpenTelemetry for logs and traces; managed identities between services (no stored credentials). Environments: dev, staging, prod, separated by subscription or resource group.

## Consequences
- Infrastructure as code (Bicep or Terraform) is part of the DevOps step.
- Cost estimate and sizing are produced once ADR 0003 sizing questions are answered.

## Security and operations impact
Private endpoints for data stores, WAF rules, TLS 1.2+, diagnostic logs retained per policy, backup and restore tested (SOP 02).

## Revisit when
Load or compliance requires dedicated networking or Kubernetes.
