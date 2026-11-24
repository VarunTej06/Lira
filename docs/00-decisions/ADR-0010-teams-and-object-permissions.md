# ADR-0010: Teams and permissions on each object

- **Status:** Accepted (20 Nov 2026) by the owner, with the proposals below. Build steps 1 to 5 are done. Stand-ups can repeat, show in the calendar, and get a Google Meet link made for them and invitation emails sent from the Owner's connected Google account (`docs/03-sop/google-setup.md`); that part is written from Google's documentation and not yet run against a real Google project. A pasted Meet or Teams link always works.
- **Date proposed:** 2026-11-20
- **Decision owner:** product owner

## Context
Every person who signs up gets an organisation of their own and is its **owner** (ADR-0009). The owner must be able to bring other people into that organisation, group them into teams, and decide per team (or per person) what they may do on each space, project, sprint, roadmap or dashboard. Example: bring in people only for the Lira space, and nothing else. This refines the access matrix in `docs/02-security/access-control-matrix.md`, which is by role only.

## Decision
- **Three levels on an object.** **View** (read only), **Edit** (add, change and remove entries inside the object, but not create a new roadmap, project or sprint), **Manage** (Edit, plus create, delete and share inside the object).
- **Grants.** A grant says: this person or this team has this level on this object. The highest level that applies to a person wins. A grant on a space reaches the projects, sprints and roadmaps in it unless a narrower grant is set on one of them.
- **The owner of an organisation has every level on everything in it,** and alone may add or remove people, create and delete teams, change grants, delete the organisation and import data. Nobody else can raise their own level.
- **Roles stay as the account-wide setting:** Owner, Admin, Member, Viewer, Guest. A Member sees nothing until granted something. A Guest can only ever hold grants on objects they were added to. **Space Admin stops being a separate role:** it is Manage on a space.
- **Teams.** A team is a named set of people in one organisation. A grant to a team applies to everyone in it, now and later.
- **A page for teams** (owner only to begin with) lists people, teams and the grants, and is the one place to add a person to a team or change what a team may reach.
- **The server decides.** Every request is checked on the server for the calling person and the object. The page hiding a button is not a control. Every change to a person, team or grant writes an audit row. A person of organisation A can never see or change anything of organisation B, with a test for it.

## Consequences
- Spaces, projects and roadmaps still live only in the browser in the hosted edition (ADR-0005). A grant can only be enforced on an object the server knows about, so this ADR is built in three slices: (1) people, teams, grants and the check on the server, with tests; (2) the Teams page (its layout is agreed with the owner first); (3) enforcement on real objects once they are stored on the server.
- Until slice 3, the Teams page can record who should get what, but it cannot yet stop anyone seeing a browser-only object. The page says so.

## Owner's answers (20 Nov 2026)
- **Nothing is stored in the browser only.** Online (hosted edition): everything is on the server, in PostgreSQL. Offline (local edition): JSON files in `data/`. This replaces the earlier "online with a local cache" answer: the browser keeps no copy of shared data. Spaces, projects, roadmaps and tickets therefore have to move to the server before grants can be enforced on them (slice 3 above is not optional, and comes before the Teams page can do anything real).
- **People come in by email invitation.** An email service (Gmail) is to be added soon; until then there is no way to invite, and the Teams page does not pretend otherwise.
- **Stand-ups:** Owners and Admins create them; they see them as an item in the app. Everyone else can only view a stand-up and join its call. An invitation goes to the email of every person invited. The call itself is in Google Chat or Microsoft Teams.

- **A cache is allowed for speed, never as the only copy.** Both editions may keep a copy in the browser so pages load faster. The server (hosted) or `data/` (local) always holds the real data, a cache can be thrown away at any time, and a write is not finished until the server or the file has it.
- **Stand-up guests** are a whole team, chosen people, or a team plus chosen people.
- **Stand-up timing** is set when the Owner or Admin schedules the call, one call at a time; there is no fixed repeat rule.
- **The call link is made by the app through Google Meet,** with the Owner's or Admin's Google permission. Microsoft Teams comes later, behind the same seam.
- **A second person can be made Admin and allowed to manage teams.** It is the owner's choice per person, and the owner can take it back at any time.

## Open questions
1. Which Google permission and sign-in the app asks for to create Meet links and send invitation emails (to be checked against Google's current rules before the build, and it needs a Google Cloud project that is yours).

## Build plan (20 Nov 2026, for the owner's approval)

### What the code looks like today, and why it decides the plan
- **Spaces and tickets are rows** (`spaces`, `tickets`, `attachments`), so a grant can point at one space and reach its tickets and files.
- **Projects, roadmaps, dashboards, sprint goals, teams and stand-ups are not rows.** Each is one value inside one shared key (`lira_projects`, `lira_roadmaps`, `lira_dashboards`, and so on) in `kv_entries`. The server cannot tell one project from another there, so it cannot give one person View on project A and nothing on project B. **To grant per object, each of these must first become rows with an id**, one table per kind, and the app reads and writes them through the API like it does tickets.
- Until that is done, the shared settings-style data stays owner and admin only.

### Data (new migration)
- `teams` (id, org, name), `team_members` (team, user), `grants` (org, subject = a person or a team, object kind, object id, level View | Edit | Manage). One grant per subject and object; the highest level that applies to a person wins.
- Object kinds: space, project, roadmap, dashboard. A grant on a space reaches its tickets, sprints and files; a grant on a project reaches what is inside it; a narrower grant can add to a wider one but never lowers it.
- Rows for projects, roadmaps, dashboards, sprints and stand-ups, each with `org_id`, a version number and its JSON body (the way tickets are done).

### Rules (one function the whole API uses)
`levelOf(person, object)`: Owner and Admin give Manage on everything in the organisation. A Member, Viewer or Guest gets the highest grant they hold directly or through a team, or that a parent object gives. A Viewer is capped at View whatever they were granted. A Guest never holds Manage. What each level allows:
- **View:** read the object and everything in it, download files.
- **Edit:** add, change and delete entries inside it (tickets in a space, items on a roadmap). Not creating a new space, project, roadmap or dashboard.
- **Manage:** Edit, plus create and delete objects inside it, and share it with people and teams.
- Only the Owner (and an Admin the owner allows) adds people, makes teams, changes grants and removes access.

### Build order, each step with tests, including "organisation A cannot reach B" and "View cannot write"
1. **Rules and tables:** teams, members, grants, `levelOf`, and its tests. Replace the current "owner and admin only" check on spaces, tickets and attachments with it.
2. **Objects become rows:** projects, then roadmaps, dashboards, sprints, stand-ups, one at a time; the app switches from the shared key to the API for each; the shared key shrinks until only preferences are left.
3. **Teams page** (owner and allowed admins): people, teams, and the grants of each. Layout, states and colours are agreed with the owner first (reference screens), as the product rules require.
4. **Story boxes and mind maps (24 Nov 2026, migration V19):** two more kinds of object with grants like the others. A story box is made and changed by the Owner and Admins; people who may view its space (or who were given access, for a sprint box) see it and give their own points through `story_votes`, which are rows of their own so that viewing never allows changing. A mind map is its maker's until shared.
4. **Invitations by email (a space can be named, 24 Nov 2026: `invitations.space_id`, `space_level`, migration V15; accepting grants only that space at that level, capped by the role; the invited person lands in their own workspace and the shared one is in the account menu, tagged "Invited" in the sidebar; projects and roadmaps tied to the space (`spaceId`, `spaceKey`) and dashboards whose filters name only that space are visible through the space at most at Edit, unless the Owner switched that kind off for the person (`space_shares`, migration V15, `objects/tied-space.ts`); the Sprints switch hides the sprint pages and sidebar section; a person who can edit the space may add projects and roadmaps tied to it; invitees cannot invite others):** an `invitations` table (email, role, team, a random token stored only as a hash, expires in 7 days, single use), the accept page, and an `EmailSender` seam. Sending through Gmail needs a Google Cloud project and the owner's approval of the permission it asks for; until then an invitation can be created and its link copied, and the page says email is not connected.
5. **Stand-ups:** created by Owner and Admin only, for a team and/or chosen people, with a Google Meet link made through the same Google connection; others view and join.

### What could break
- Moving projects and roadmaps from one JSON value to rows changes how the app reads them; the local edition keeps today's files and must not change. Tests that pin today's behaviour come first.
- Existing hosted test accounts hold their projects and roadmaps in the shared key; a one-time conversion is needed, or those accounts are recreated (there is no real customer data yet).

### Decisions (the owner chose "go with your proposals", 20 Nov 2026)
1. Does a **Member with no grant see nothing**, even the list of spaces, or see the names of spaces they cannot open? (Proposed: nothing.)
2. May an **Admin** manage teams and grants, or only the Owner? (Earlier answer: the owner can allow a second Admin; proposed: Admins may, unless the owner switches it off per person.)
3. Are **dashboards personal** (only their maker) unless shared, or shared with the organisation by default? (Proposed: personal until shared.)
4. Who may **create a space**: only Owner and Admin, or anyone with Manage at the organisation level? (Proposed: Owner and Admin.)
