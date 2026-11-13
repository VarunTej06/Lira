# SOP-02: Backup and restore drill

**Purpose:** be sure data can be recovered, and prove it. **Scope:** PostgreSQL database and attachment storage. **Roles:** Platform owner (runs), Security lead (reviews access). **Targets (to be confirmed):** RPO ≤ 15 minutes, RTO ≤ 4 hours. **Status:** Proposed.

## What is backed up
| Data | Method | Retention (proposed) |
|---|---|---|
| Database | Platform automated backups + point-in-time restore | 35 days; monthly copy kept 12 months |
| Attachments | Versioning and soft delete on the storage container; geo-redundant copy | 35 days of versions |
| Secrets and configuration | Key Vault soft-delete and purge protection; infrastructure as code in git | Per policy |
| Audit log | Included in the database; also shipped to central logs | Per legal retention |

## Before any risky change (migration, bulk import, bulk delete)
1. Confirm a recent backup exists and note its timestamp.
2. Take an on-demand backup or record the point-in-time you could return to.

## Quarterly restore drill
1. Pick a recovery point (for example "yesterday 14:00").
2. Restore the database to a **new, isolated** server, never over production.
3. Restore the matching attachment versions to a test container.
4. Start a staging API pointing at the restored copy; sign in with a test account.
5. Verify: counts of organisations, users, spaces, tickets, comments, attachments match the source for that moment (±changes since); open three random tickets; confirm one attachment downloads and its checksum matches.
6. Measure elapsed time (RTO) and data gap (RPO). Record both.
7. Delete the restored copies; confirm no production data remains in non-production.

## Restoring in production (disaster)
1. Declare an incident (SOP-03). Put the app in maintenance mode.
2. Choose the recovery point with the product owner (balance data loss and downtime).
3. Restore to a new server, validate as in drill step 5, then switch the API connection (secret/config change) to the restored server.
4. Reconcile any writes lost after the recovery point from the audit log and tell affected users.
5. Keep the damaged server for forensics until the incident closes.

## Verification and records
Drill report: date, recovery point, RTO/RPO achieved, problems found, fixes assigned. A drill that was not done or failed is a finding, not a pass.

## Local edition
Single users use the in-app snapshots (`/api/snapshot`) and **Export JSON Backup**; see `SETUP.md`.
