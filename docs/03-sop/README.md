# Standard operating procedures (SOPs)

Step-by-step procedures for running and supporting Lira. They are written for the hosted, multi-user edition. Steps marked **(manual until DevOps)** become automated pipeline stages in the DevOps phase that follows multi-user + SSO. Until then a person does them and records the result.

| SOP | Title | Owner (to be named) | Review cycle |
|---|---|---|---|
| [01](SOP-01-release-and-rollback.md) | Release and rollback | Release manager | Each quarter |
| [02](SOP-02-backup-and-restore.md) | Backup and restore drill | Platform owner | Each quarter (drill) |
| [03](SOP-03-incident-response.md) | Incident and security response | Security lead | Twice a year |
| [04](SOP-04-dependency-and-vulnerability-management.md) | Dependency and vulnerability management | Tech lead | Monthly run |
| [05](SOP-05-access-management.md) | Access management (joiner, mover, leaver, review) | Org admin | Each quarter |
| [06](SOP-06-developer-onboarding-and-local-setup.md) | Developer onboarding and local setup | Tech lead | When tooling changes |

Format of every SOP: purpose, scope, roles, prerequisites, numbered steps, verification, records to keep, rollback/escalation. Keep each SOP to one page; link to detail instead of repeating it. If a step is wrong, fix the SOP in the same change that fixed the process.

For the **local edition** (single user), backup and recovery steps are in [`SETUP.md`](../../SETUP.md) and [`Prompts and Architectures/08_Troubleshooting_and_Disaster_Recovery.md`](../../Prompts%20and%20Architectures/08_Troubleshooting_and_Disaster_Recovery.md).
