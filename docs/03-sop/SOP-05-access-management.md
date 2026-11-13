# SOP-05: Access management (joiner, mover, leaver, review)

**Purpose:** the right people have the right access, no one else does. **Scope:** Lira organisation membership, space roles, admin roles, and production/cloud access for engineers. **Roles:** Org admin, Space admin, Security lead. **Status:** Proposed.

## Principles
Least privilege; access through the identity provider groups where possible; every grant has an owner and a reason; admin roles are few and named; shared accounts are not allowed.

## Joiner
1. Request approved by the person's manager (record in the ticket).
2. Add to the correct identity-provider group. First sign-in creates the Lira user (key: IdP subject).
3. Org admin sets the **organisation role** (default Member) and adds them to the required **spaces**.
4. Confirm they can sign in and see only the expected spaces.

## Mover
1. Manager requests the change. Add the new access first, then remove the old access within 5 working days.
2. Review any admin roles held; remove if no longer needed.

## Leaver
1. HR or manager notifies on or before the last day.
2. Disable the user at the identity provider **and** in Lira (this revokes sessions).
3. Reassign their owned items (tickets, dashboards, roadmaps) to a named person; do not delete content.
4. Remove engineer access to the cloud subscription, Key Vault, database and repository. Rotate any secret they could read.
5. Confirm in the audit log that no sessions remain active.

## Quarterly access review
1. Export the member list with roles per organisation and space, and the list of admins and cloud role assignments.
2. Each space admin confirms their members; the Security lead confirms all admins.
3. Remove anything not confirmed within 10 working days. Record the review.

## Break-glass
A named, MFA-protected emergency admin account exists. Its use is alerted, time-limited and reviewed the next working day.

## Records
Request tickets, audit log entries for role changes, review sign-off.
