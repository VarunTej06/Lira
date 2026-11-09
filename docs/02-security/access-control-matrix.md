# Access-control matrix

**Status:** Proposed; the product owner must review. This table is the source for the authorisation function and its tests (one test per cell).

Roles: **Owner** (organisation), **Admin** (organisation), **Space Admin** (one space), **Member**, **Viewer**, **Guest** (external, only spaces they are added to). Effective role in a space = the higher of the organisation role and the space role. ✔ allowed · ✖ denied · ◐ allowed only for own items or as described.

| Action | Owner | Admin | Space Admin | Member | Viewer | Guest |
|---|---|---|---|---|---|---|
| Sign in, view own profile, edit own preferences | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| View organisation settings | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| Change organisation settings, SSO, AI providers | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| Delete organisation | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ |
| Invite, disable, remove users | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| Change roles (cannot grant above own role) | ✔ | ✔ | ◐ space roles | ✖ | ✖ | ✖ |
| View audit log | ✔ | ✔ | ◐ own space | ✖ | ✖ | ✖ |
| Create a space | ✔ | ✔ | ✖ | ◐ if enabled | ✖ | ✖ |
| View a space and its tickets | ✔ | ✔ | ✔ (own) | ✔ (member of) | ✔ (member of) | ◐ added only |
| Edit space settings, columns, WIP limits | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ |
| Archive or delete a space | ✔ | ✔ | ◐ archive | ✖ | ✖ | ✖ |
| Create ticket | ✔ | ✔ | ✔ | ✔ | ✖ | ◐ if granted |
| Edit ticket, change status, assign | ✔ | ✔ | ✔ | ✔ | ✖ | ◐ if granted |
| Delete ticket | ✔ | ✔ | ✔ | ◐ own | ✖ | ✖ |
| Bulk actions | ✔ | ✔ | ✔ | ◐ own tickets | ✖ | ✖ |
| Comment | ✔ | ✔ | ✔ | ✔ | ◐ if enabled | ◐ if granted |
| Edit/delete a comment | ✔ | ✔ | ✔ | ◐ own | ✖ | ◐ own |
| Upload or download attachments | ✔ | ✔ | ✔ | ✔ | ◐ download | ◐ if granted |
| Manage sprints, plan, close | ✔ | ✔ | ✔ | ◐ if enabled | ✖ | ✖ |
| Create/edit roadmaps and dashboards | ✔ | ✔ | ✔ | ✔ own | ✖ | ✖ |
| View roadmaps and dashboards | ✔ | ✔ | ✔ | ✔ (permitted spaces only) | ✔ | ◐ |
| Manage projects and teams | ✔ | ✔ | ◐ own space | ✖ | ✖ | ✖ |
| Use Viva (read) | ✔ | ✔ | ✔ | ✔ | ✔ | ◐ |
| Viva write actions (after confirm) | ✔ | ✔ | ✔ | ✔ | ✖ | ✖ |
| Export data | ✔ | ✔ | ◐ own space | ◐ own view | ✖ | ✖ |
| Run import | ✔ | ✖ (separate break-glass role) | ✖ | ✖ | ✖ | ✖ |

## Rules
- A role never exceeds what the identity provider and Lira membership allow; disabled users have no access regardless of any cached session.
- Results of search, dashboards, exports and AI context only include data in spaces the caller can view.
- Every denied attempt on an object the caller can see exists in a log; for objects they must not know about, the API returns `404`.
- Any change to this table needs product-owner and security-lead approval and updates the tests in the same change.

## Open items
Guest scope at launch; whether Members may create spaces; whether Viewers may comment.
