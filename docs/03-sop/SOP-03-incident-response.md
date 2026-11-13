# SOP-03: Incident and security response

**Purpose:** act quickly and consistently when something goes wrong. **Scope:** outages, data loss, suspected breach, leaked secret, vulnerability report. **Roles:** Incident commander (IC), Communications lead, Technical lead, Security lead. **Status:** Proposed.

## Severity
| Level | Meaning | Response |
|---|---|---|
| **SEV1** | Data breach or loss, cross-tenant exposure, full outage, active attack | Immediately, all hands, IC appointed |
| **SEV2** | Major feature down, security flaw without evidence of misuse | Within 1 hour |
| **SEV3** | Minor degradation, workaround exists | Next working day |

## Steps
1. **Detect and report.** Anyone can raise it in the incident channel. State: what, since when, how found.
2. **Triage (15 min).** Assign severity and an IC. Open an incident record with a timeline (UTC).
3. **Contain.** Choose the least destructive action that stops harm: disable the feature flag, revoke sessions, block an IP range, disable an account, rotate a secret, take the app to read-only or maintenance mode. Preserve evidence (logs, database state) before changing things.
4. **Assess.** Which organisations, users and data? Use the audit log and application logs by `requestId`, `userId`, `orgId`.
5. **Eradicate and recover.** Fix the cause (patch, config, access), restore data if needed (SOP-02), verify with tests and a targeted check.
6. **Communicate.** Update stakeholders at the cadence set by severity. For personal-data breaches, involve the product owner and legal/DPO at once; regulatory deadlines (for example 72 hours under GDPR) start when the breach is known.
7. **Close.** Confirm normal service, monitor for 24 hours.
8. **Review (within 5 working days).** Blameless post-incident review: timeline, root cause, what worked, what did not, actions with owners and dates. Update the threat model and SOPs.

## Specific playbooks (short)
- **Leaked secret:** rotate it first, then find where it leaked and remove it; scan history; check logs for use between leak and rotation.
- **Suspected cross-tenant exposure:** treat as SEV1; disable the affected route or enable read-only; identify exposed objects by query logs; notify affected organisations.
- **Compromised account:** disable the user at the identity provider and in Lira; revoke sessions; review the audit log for their actions; reset MFA.
- **Vulnerable dependency:** follow SOP-04 emergency path.
- **Vulnerability report from outside:** acknowledge within 2 working days; reproduce; fix by severity; credit if wished.

## Records
Incident record, evidence list, communications sent, post-incident review, and the resulting changes (linked pull requests).
