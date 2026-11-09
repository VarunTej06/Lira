# SOP-01: Release and rollback

**Purpose:** ship a change safely and be able to undo it. **Scope:** any change deployed to staging or production. **Roles:** Release manager (runs it), Reviewer (approves), On-call engineer (watches). **Status:** Proposed; **(manual until DevOps)** steps are marked.

## Prerequisites
- Pull request approved by a code owner (a second code owner if it touches auth, data access, validation, secrets or migrations).
- From `lira-app/`: `npm run test:all` passes locally (typecheck, lint with 0 warnings, 1585+ tests, data health). **(manual until DevOps)**
- `npm audit` shows no high or critical findings. **(manual until DevOps)**
- Release notes drafted: what changed, any migration, any config change, how to roll back.

## Steps
1. Create a release tag `vMAJOR.MINOR.PATCH` on the merge commit. Record the commit id.
2. Build the web bundle and the API container image from that tag only. Never build from a working copy. **(manual until DevOps)**
3. Deploy to **staging**. Run the smoke checks: sign in, open a space, create/move/edit a ticket, add a comment and attachment, run a Viva read query, sign out.
4. If the release has a database migration: take a backup first (SOP-02 step 1), run the migration on staging, verify row counts and one sample record, then proceed. Migrations must be backward compatible with the previous release (add before remove) so rollback does not need a data restore.
5. Get approval from the Release manager to promote.
6. Deploy to **production** outside peak hours. Roll out gradually (new revision at low traffic share, then increase) once the platform supports it.
7. Watch for 30 minutes: error rate, p95 latency, failed sign-ins, 5xx, database CPU, queue/SSE connections. Compare with the previous hour.
8. Announce completion with the version and notes. Record in the release log.

## Verification
Smoke checks pass in production; error rate and latency within 10% of baseline; audit log shows the deployment event.

## Rollback
Trigger if: error rate above 2× baseline for 5 minutes, any data-integrity doubt, or a security regression.
1. Route traffic back to the previous revision/image (one command or platform action).
2. If a migration ran: it must be backward compatible, so the old release works with the new schema. Do **not** restore data unless integrity is damaged; if it is, follow SOP-02 restore.
3. Open an incident (SOP-03) if users were affected. Write what happened in the release log.

## Records
Release log entry: version, commit, date, approvers, migration yes/no, smoke result, rollback yes/no.
