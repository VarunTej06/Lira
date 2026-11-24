# Manual test checklist (after the code-quality and component refactor)

Use this once after the 9 Nov 2026 refactor, and again before any release until browser tests (Playwright) exist.
No behaviour was meant to change anywhere. **If anything looks or acts different from before, that is a bug: note the screen, the steps and what you saw.**

How to run it
- Use a **copy** of your workspace if you can (`LIRA_DATA_DIR`), or accept that testing edits `data/`.
- Start with `npm run dev` in `lira-app/`. Test in **dark and light mode** (Settings, Appearance) for sections marked ◐, and walk the main screens once in each of the six palettes (section A26).
- Open the browser console once (F12): there should be **no red errors** while you work through the list.
- Tick each box. "Expect" says what you should see.
- The same cases are in `Lira-manual-test-cases.xlsx`. After adding a section here, copy it into the workbook with `python docs/04-quality/sync-manual-cases.py A25` (workbook closed in Excel).

---

## A. The screens that were reworked (A1–A33)

### A1. Ticket popup (open any ticket)  ◐
The popup keeps an unsaved copy ("draft") of the ticket. This is the riskiest change.
- [ ] Open a ticket. Expect: title, description, status, priority, assignee, labels, dates all as saved. Nothing says "unsaved".
- [ ] Change the **priority**, then press **Save changes**. Expect: popup closes, "Changes saved" card appears, board shows the new priority.
- [ ] Open the same ticket, change nothing, press **Save changes**. Expect: it just closes; **no** "saved" card.
- [ ] Change the title only, close with **X**. Expect: "Discard changes?" with *Discard changes* and *Keep editing*. *Keep editing* keeps the popup; *Discard* closes and the ticket is unchanged.
- [ ] Repeat with **Escape** and with a click outside the popup. Expect: same prompt when there are changes, plain close when there are none.
- [ ] Clear the title and Save. Expect: "Title needed" message, nothing saved, popup stays.
- [ ] Change **type** Task to Bug. Expect: history shows "changed issue type from Task to Bug" after saving.
- [ ] Change type to **Epic** on a ticket that has a parent. Expect: the parent/epic link disappears.
- [ ] Change a ticket **with child tickets** to **Subtask**. Expect: a "Convert to subtask" question; *Convert* works, cancelling keeps the type; after Save the children are detached.
- [ ] Pick a **parent/epic** from the parent control, then clear it. Expect: the parent shows, then disappears; "Epic" shown correctly for task under epic.
- [ ] Turn **Blocked** on, choose one or two blocking tickets, Save. Expect: Blocked pill shows; the blocking tickets show "blocks"; turning it off removes both.
- [ ] Add a **comment** (Ctrl+Enter also sends). Expect: saved **at once** (no Save needed), appears in history.
- [ ] Edit your own comment. Expect: the new text is saved at once. Another person's comment cannot be edited.
- [ ] Add a **child ticket** from the popup. Expect: it appears under the ticket with the same assignee; progress bar updates when you finish children.
- [ ] Open ticket A, then ticket B. Expect: B shows its own data; none of A's edits leak into B.
- [ ] **Delete** a ticket (More menu). Expect: confirmation, then the ticket is gone.
- [ ] While the popup is open, scroll the page behind it. Expect: the page behind does not scroll; after closing it scrolls again.

### A2. Create ticket dialog  ◐
- [ ] Open **Create** from the top bar. Expect: "Create Issue in <space>"; Title field focused; status "To Do"; priority "Medium"; current sprint selected and marked "(current)".
- [ ] From a board column "+ Add", Expect: status matches that column.
- [ ] From the **Sprints** page "Add ticket": Expect: a **Space** picker is shown and required; parent list says "Select a space first…" until a space is chosen.
- [ ] Click **Create Issue** with an empty title. Expect: "Title is required".
- [ ] Type **Epic**. Expect: parent control replaced by the "Epics are top-level" note, and the **Sprint** field disappears.
- [ ] Type **Task / Bug**. Expect: "Epic (optional)" list of the space's epics, or "No epics in <space> yet".
- [ ] Type **Subtask** with no parent, then Create. Expect: "Choose the task this subtask belongs to". With a parent, it saves.
- [ ] Fill title, priority High, labels "a, b", due date, description with bold text, Create. Expect: ticket appears on the board with those values and the key of the space.
- [ ] After creating, open Create again. Expect: the form is **empty** again.
- [ ] Press **Cancel** after typing. Expect: closes; reopening shows an empty form.
- [ ] Check the **suggestions** under the title (duplicates, labels, likely epic) still appear while typing.

### A3. Rich text editor (ticket description, comments)  ◐
- [ ] In a description: bold, italic, underline, strikethrough, bullet list, numbered list, checkbox list, quote, code. Expect: each works and the button highlights while the cursor is inside it.
- [ ] **Text style** menu: Normal, Heading 1, 2, 3. Expect: menu closes after choosing; clicking elsewhere also closes it; the button shows the current style.
- [ ] **Text colour** and **Highlight** menus: eight and six swatches; choosing applies; **Escape** closes the menu.
- [ ] **Link**: select text, add a web address, apply; then clear it. Expect: link added, then removed.
- [ ] **@mention**: type @ and pick a person. Expect: mention chip appears.
- [ ] **Add attachment** (paperclip): add a file, a picture, a web link. Expect: picture appears in the text; file/link appear as links; all join the ticket's Attachments.
- [ ] **Paste a screenshot** (Ctrl+V). Expect: it is inserted as a picture named "screenshot-<time>".
- [ ] Drag a file into the editor. Expect: inserted like the paperclip.
- [ ] Add a file **over 2 MB**. Expect: "File not stored" message; the name stays in the text.
- [ ] Click a stored file link in a saved description. Expect: it downloads.
- [ ] **Undo / Redo** buttons are greyed when there is nothing to undo; work after typing.
- [ ] **Comments** use the short toolbar (no Text style, colour, highlight, quote, code, clear formatting). Expect: that is all that is missing.
- [ ] Saved comments display **read-only** with no toolbar.
- [ ] Open another ticket while editing. Expect: the editor shows the other ticket's text.

### A4. Roadmap: item dialog  ◐
- [ ] Open a roadmap and **Add item**. Expect: title "Add roadmap item (epic)", button "Add item".
- [ ] Banner offers **Create a new epic in <space>** or **Use an existing epic**. With *existing*, the list shows only epics of that space that no other item uses; choosing one fills an empty title.
- [ ] A roadmap **without a space** with "new epic": red warning and Add item disabled.
- [ ] Add item is disabled for: empty title, end before start (message shown), "+ New lane…" with no name, "existing epic" with none chosen.
- [ ] Choose **+ New lane…**, name it, save. Expect: the lane appears.
- [ ] Open an existing item with an epic. Expect: "This item is the epic LIRA-n" and **Open epic** works; status note "(follows the epic on the board)".
- [ ] Change the **status** of an existing item, save. Expect: the epic's board status follows.
- [ ] **Checklist**: add (button and Enter), tick, remove; "x/y done" updates; blank entries ignored. Expect: the progress slider is locked when a checklist exists.
- [ ] A checklist saved under a task shows the **task link**; clicking opens it.
- [ ] **Depends on**: tick and untick other items; each row shows "ends <date>". Save and reopen: ticks kept.
- [ ] **Remove** on an existing item asks first; none on a new item.
- [ ] **Cancel** closes without saving.

### A5. Roadmap: planner view
- [ ] Open a roadmap, **Planner**. Expect: lanes, epic bars and ticket chips as before, milestone lines, today line.
- [ ] Summary line: "N tickets shown · M without a due date".
- [ ] Ticket **without a due date** has a dashed border; with a date, solid. Hover titles say "Due ..." or "No due date: drag to schedule".
- [ ] **Click** an epic bar. Expect: the item dialog opens (a plain click must not move it).
- [ ] **Click** a ticket chip. Expect: the ticket popup opens.
- [ ] **Drag** an epic bar a few days. Expect: a small tip shows the new dates while dragging; on release the dates change, length stays the same.
- [ ] Drag the **left edge** and the **right edge**. Expect: only that end moves.
- [ ] Drag a **ticket chip** to another day. Expect: its due date changes.
- [ ] Drag near the left or right edge. Expect: the calendar scrolls.
- [ ] Right mouse button does nothing. Collapse and expand lanes and epics; **+ add ticket** under an epic still works.

### A6. Sprints page  ◐
- [ ] Open **Sprints**. Expect: four tabs (Sprint, Planning, Reports, Epics); Sprint selected; Burndown and Velocity charts.
- [ ] Switch through all four tabs and back. Expect: content changes each time; the underline slides.
- [ ] Pick a **past sprint with unfinished tickets**. Expect: blue prompt "<sprint> ended with N unfinished ticket(s)"; **Carry over and close** opens the close dialog.
- [ ] A yellow notice when unfinished tickets sit in **ended sprints**; **Move to <current sprint>** moves them and shows a toast.
- [ ] Tick tickets in the list. Expect: a blue bar "N selected" with **Move to** (sprint list), **Next sprint**, **Clear**.
- [ ] **Jump to a space** buttons (all-spaces view only) show counts and open the space.
- [ ] A space's own **Sprints tab** (locked to one space): no "Jump to a space", only that space's tickets.
- [ ] **Edit spaces** for a sprint: dialog "Spaces in <sprint>"; Save shows "Sprint spaces updated"; Cancel discards.
- [ ] Switch sprint or space. Expect: selection and filters reset.

### A7. Create sprint dialog  ◐
- [ ] **Create sprint**: starts on Monthly with the first free month chosen; twelve months shown, marked Current / Already planned / Free.
- [ ] Choose a month already planned. Expect: button reads **Open sprint**.
- [ ] **Weekly**: start date and name; preview shows "Nov 9 – Nov 15 · 7 days".
- [ ] **Number of days**: day count field plus a full-width name; 0 and more than the maximum disable Create.
- [ ] Choose a start that **overlaps** an existing sprint. Expect: red "Overlaps the sprint starting ..." and Create disabled.
- [ ] Type a **goal**, pick only some spaces, Create. Expect: the goal shows on the sprint; only those spaces can add tickets.
- [ ] Close and reopen. Expect: the form starts fresh.

### A8. Viva (floating chat)  ◐
- [ ] Ask "Show blocked tickets". Expect: a normal answer with suggestion chips; clicking a chip sends it.
- [ ] "Move LIRA-n to done". Expect: a **refined goal** box, then **Confirm / Cancel** buttons.
- [ ] Confirm. Expect: "Confirmed", the ticket moves, and **Undo (1 ticket)** appears; Undo restores it and shows "Undone".
- [ ] Cancel another one. Expect: "Cancelled, nothing changed".
- [ ] "Create a bug called test": preview shows the space and any duplicate; confirm creates it; the reply has an **Open** link to the ticket.
- [ ] "Break down LIRA-n into subtasks": four subtasks listed in the preview; Docker/Kubernetes/CI/interview/exam words give matching subtasks.
- [ ] "Plan next sprint from my backlog": preview lists tickets that fit the capacity.
- [ ] "Build me a sprint health dashboard": reply has **Open dashboard**.
- [ ] "Show tasks in AP" (any space key or name): the right space is recognised.
- [ ] In the small **info** chat (read-only mode), ask it to change something. Expect: "Read-Only Mode" message pointing to the agent.
- [ ] With a model configured (Settings): questions go to the model; changes still use confirm and undo.

### A9. Filter dropdowns (Priority, Status, Labels, sprint)  ◐
- [ ] Open each. Expect: checkbox list; count badge on the button once something is ticked; button highlights.
- [ ] **Labels** has a search box; typing narrows; "No match" when nothing fits.
- [ ] **Clear** link clears only that filter.
- [ ] Open one near the **bottom** of the window. Expect: it opens **upward** and fits; near the top it opens downward; never wider than the window.
- [ ] **Escape**, a click elsewhere, resizing the window, and scrolling the page close it; scrolling inside the list does not.
- [ ] Sprint filter (single choice): radio buttons, choosing closes it, button shows "Sprint: <value>".

### A10. Filters page (results table)  ◐
- [ ] Open **Filters**. Expect: "Showing X of Y work items".
- [ ] Headings **Key, Summary, Status, Priority, Updated** sort when clicked (again reverses); Type, Space, Assignee do not.
- [ ] Click a **row**: popup opens. Click the **space chip**: the space opens, not the ticket.
- [ ] Labels show up to three, then "+N". Blocked tickets have a red Blocked badge. Status badge colours: Done green, In progress amber, To do blue, other grey.
- [ ] Assignee shows initials avatar and name, or "Unassigned".
- [ ] Filters matching nothing: "No work items matched your filters" and **Reset all filters** works.
- [ ] Open the page from a preset in the Filters menu of the top bar. Expect: the preset applies once and is not re-applied after you change filters.

### A11. Confirm / alert / prompt dialogs  ◐
- [ ] Trigger a **delete** (ticket, space or dashboard). Expect: red warning icon, main button says **Delete**, Cancel works.
- [ ] Trigger a plain yes/no (for example Discard changes). Expect: button says what the caller named it (or **Confirm**).
- [ ] Trigger a notice (for example "Title needed"). Expect: blue "i" icon, one **OK** button.
- [ ] Trigger a question with a text box (for example rename or new lane). Expect: pencil icon, text box focused, **Enter** confirms, empty or Cancel gives nothing.
- [ ] **Escape** and a click outside: a notice counts as seen, a question as "no", a text prompt as cancelled.

### A12. Date picker (any date field)  ◐
- [ ] Click a date field. Expect: calendar opens under the field; on a field near the bottom of the window it opens **above**; never off the left or right edge.
- [ ] Pick a day. Expect: the field shows it and the calendar closes. Month and year arrows and chooser work; Monday is the first column.
- [ ] A field that allows clearing shows a small **x**; clicking it empties the date without opening the calendar.
- [ ] **Escape**, a click elsewhere, resizing or scrolling the page close the calendar. A disabled field does not open.

### A13. Project page header
- [ ] Open **Projects**, then a project. Expect: "All Projects / <name>" at the top; **All Projects** goes back.
- [ ] **Create Issue** (top right) opens the create dialog with status To Do.
- [ ] Banner shows initials in the space colour, name, key, category (if any), description (or the default text), lead, "Created <date>".
- [ ] The **Space** button opens that space; a project with no space says "No linked space".
- [ ] Six tabs: Overview, Board, Tickets, Sprints, Technical Details, Settings. The open one is blue; **Board and Tickets show the ticket count**; each tab opens its content.

### A14. Ordering, search and board columns
- [ ] Board and list: sort by each option (rank, priority, due date, updated, key, title). Expect: same order as before; tickets without a due date last.
- [ ] Top-bar search finds by key, title, label and assignee; the best match comes first.
- [ ] Drag a ticket **between** two others, to the top and to the bottom of a column. Expect: it stays where dropped after reload.
- [ ] Board search/priority/label filters hide the right cards; empty columns say so.

### A15. Notifications and sprint reports
- [ ] Bell: overdue, due soon, blocked and assigned-to-me tickets are listed, newest relevant first; the count matches.
- [ ] **Reports** for a sprint: scope added, removed and carried-over tickets listed under the right heading; totals match the board.

### A16. Roadmap timeline header
- [ ] Zoom **Weeks, Months, Quarters**. Expect: months/years on top, weeks (Monday dates), month names or Q1-Q4 below; widths line up with the bars and today line.
- [ ] A range that starts mid-month or mid-quarter: the first and last cells are shorter, not misaligned.

### A17. Board bar, sidebar menus and roadmap page header  ◐
- [ ] Board bar: search box (with the small x), "me" avatar filter, Priority / Status / Labels dropdowns, **Clear filters**, **Group** menu all work as before.
- [ ] Board bar **...** menu: Board settings, Space settings, Hide/Unhide, Archive/Unarchive (menu closes first), WIP limits (label opens settings, switch turns them on/off), Bulk actions, Export view to JSON.
- [ ] Sidebar: hover a space, press its **...** button. Expect: menu opens under it (above if the space is near the bottom), stays inside the window, closes on scroll or resize; star, settings, hide, archive, delete all work. Same for project and sprint rows.
- [ ] Sidebar sections: the header count, the **+** button and minimise/expand animation still work.
- [ ] Roadmap page header: name, "Epics in <space>" (or the picker when none), description, **Export CSV** (file named after the roadmap and the day), **Milestone**, **Add epic**, and the **...** menu (Rename, Edit description, Delete with confirmation).
- [ ] Roadmap page: the red/amber banner "N dependency problem(s)" only when an epic starts before something it depends on ends; the notice bar (created/linked epic or error) can be dismissed.
- [ ] Sprint planning: backlog on the left, sprint on the right; drag across, + and −; capacity box, bar colour (green, amber from 90 %, red when over), over-committed warning, "no story points" warning; a closed sprint is read-only.
- [ ] Dashboards: **Add widget** gallery (search, ticks after adding), widget **settings** (title, what to count, group by, list, limit, weeks, own filters), **Alerts**, **Weekly snapshot** and the tickets-behind-a-number popup.
- [ ] App start: the "Initializing Lira" screen shows briefly, then the app; creating a ticket from a project page preselects the project's space; deleting a project keeps its tickets.

### A18. Reports, calendar, roadmaps list, filters page, sprint summary, dashboard header  ◐
- [ ] **Reports** (board ... menu or space actions): four numbers on top (Total, Done, In Progress, Story Points with rates), a "N high priority" flag only when there are some, **Status Breakdown** and **Priority Distribution** tabs switch the donut, the legend and the bars; the progress sentence changes at 40 % and 75 %; an empty space says "No issues on board".
- [ ] **Calendar** view: month and year in the title, the chooser jumps to any month (Escape and an outside click close it), **Today**, previous and next month; weeks start on Monday; today is tinted; tickets sit on their due day with the right colour (done green, blocked red, in progress blue, high priority red); "+N more" expands and "Show less" folds.
- [ ] Calendar: drag a ticket onto another day (due date changes, "Drop on a day to schedule" shows while dragging) and drag one from **Without a due date** onto a day; the tray folds and unfolds; "Every ticket has a due date." when none are left.
- [ ] **Roadmaps** list: four tiles, tabs **Active / Starred / Archived** with counts, search (name, description, space key), sort (Recently updated, Name, Progress), empty states ("No roadmaps yet" with a Create button, "No roadmaps match").
- [ ] Roadmap card: space or "No space", description, progress and status chips, lanes, dates, next milestone ("5d: Launch"); click or Enter opens it; the star toggles without opening; the **...** menu has Rename, Duplicate, Archive/Unarchive, Delete (asks first) and closes on a click elsewhere.
- [ ] **Filters** page controls: search box with x, four presets with counts, "N of M" and Reset, and the six dropdowns (Space, Status, Priority, Type, Assignee, Tags & Team) each with its summary text, a tick on chosen values, only one open at a time.
- [ ] **Sprint** summary: name, dates, days left, Closed badge and date, spaces and **Edit**, **Create ticket** (hidden for a past sprint), **Complete sprint** / **Retrospective**, goal box (Save and Cancel appear after a change, Enter saves), progress bar with a "today" mark, six status tiles.
- [ ] Sprint ticket box: heading with fold button, select-all (half-ticked when some are ticked), title and colour follow the Status filter, count "N of M" when filtered, tickets ordered In progress, To Do, Backlog, Done.
- [ ] **Dashboard** header: click the name to rename (Enter saves, Escape cancels), star, alert badge, Customise, Add widget, Alerts, Snapshot, **Export** (PNG, Print, Markdown, JSON file named after the dashboard), **Share**, **...** (Duplicate, Delete with confirmation); a missing dashboard shows "This dashboard does not exist".
- [ ] Ticket popup: quick actions (**Child issue** asks for a title; not on subtasks), parent pill opens the parent, title click-to-edit (Enter saves, Escape cancels), description, **Attachments** count includes files from comments, **Child work items** progress bar (epics and tasks only), checklist (tasks only).
- [ ] Project page tabs and header (see A13) and the sidebar **Spaces** list: choosing a space keeps your tab when you are already inside a space.

### A19. Documents, list view, project cards, create-ticket hints
- [ ] **Documents & Notes** (space actions): the template names the space the first time; typing shows "Unsaved changes" and the word and character counts; **Save** saves, shows a saved card and closes; **Ctrl+S** saves without closing; Done closes.
- [ ] Documents: **Bold, Italic, Heading, Bullet, Checklist, Code** wrap the selected text (or the word "text") and keep it selected; **Copy** says "Copied!"; **Export .md** downloads `<KEY>-docs.md`; **Reset** asks first and restores the template.
- [ ] Documents **Preview**: headings, bullets, numbered items, checklist ticks (done ones struck through) and paragraphs are drawn; an empty note says "This document is empty."
- [ ] **List** view (space tab): sort by clicking any heading (again reverses; the arrow shows the direction), the search box filters by key, title and assignee, the board filters apply, labels show three and "+N", Blocked badge, empty state text.
- [ ] List view paging: 10 / 15 / 25 / 50 rows per page, "Showing a–b of n", Prev and Next stop at the ends, sorting or searching returns to page 1.
- [ ] **Projects** grid cards: name, key, category, description (or default text), space tag (or "Unlinked Space"), lead initials, "N issues (M done)" with the bar; clicking opens the project, the standup button does not.
- [ ] **Create ticket** hints under the title: possible duplicates (clickable), label chips (hidden once typed), a priority chip only when it differs, an epic chip only for tasks and bugs; clicking a label adds it to the comma-separated list.
- [ ] Notifications bell, "show me <ticket>" in Viva (title, space, type and priority, status, people, due date, parent epic, subtask progress, description preview), and board tab/page links (browser Back and Forward, refresh on a shared link) still work.

### A20. Capacity tab of a space
- [ ] Open a space, then **Capacity**. Expect: one row per person, busiest first, with total, To Do, In Progress, Blocked, Done, overdue and story points (a ticket with no points counts as 1); unassigned work shows as "Unassigned".
- [ ] Team totals at the top (tickets, done, in progress, points, overdue) match the sum of the rows.
- [ ] Quick chips (**Mine, In progress, Blocked, High priority, Overdue**) each narrow the list correctly; picking a person narrows to them; "Clear" shows only while a filter is on.
- [ ] The board bar filters (search, "me", Priority, Status, Labels) also narrow this view; an overdue ticket is one that is not done with a due date in the past.
- [ ] Group by **Status** (five columns, Blocked is the flag), **Priority** (low and lowest together), **Assignee** and **Epic / Parent** (progress per epic, an epic with no children shows 100 % when done, else 0 %); points and shares add up.

### A21. Themes and light palettes (13 Nov 2026; more palettes were added later, see A26)  ◐
Reference screens: `docs/04-quality/ui-references/`.
- [ ] Settings, Appearance. Expect: a Dark and a Light card, each showing its three colours; Dark is selected in a new workspace; there is no accent colour picker.
- [ ] Choose **Light**. Expect: "Choose a light palette" appears with **Sorrel** (selected) and **Fawn**; the page behind does not change; "Not saved yet" shows.
- [ ] Pick **Fawn**, **Save**. Expect: cream page, brown navigation and text, baby blue buttons with brown labels; the dialog closes.
- [ ] Reopen, pick **Sorrel**, **Save**. Expect: off-white page, sage frame and navigation, tomato red buttons with white labels.
- [ ] Choose **Dark**, **Save**. Expect: black page, silver text, yellow buttons with black labels.
- [ ] Choose another theme or palette, then **Cancel**. Expect: nothing changes; reopening shows the saved choice.
- [ ] Gear menu, System settings. Expect: choosing Light shows the light palettes; Save applies the choice.
- [ ] Reload the page, and open Lira in a browser that has never opened it (dev server running). Expect: the saved theme and palette are shown from the first moment.
- [ ] In each theme walk the board, list, calendar, summary, sprints, roadmaps, dashboards, filters, projects, For you, a ticket popup and the Viva chat. Expect: no white label on a yellow or baby blue button, no leftover navy bars or purple gradients, every text readable.

### A22. Space icons, app switcher and sidebar speed (13 Nov 2026)  ◐
- [ ] Sidebar, board header, summary, filters, calendar, projects, For you. Expect: every space shows a line icon like the navigation icons; no emoji anywhere.
- [ ] A space created before this change. Expect: it shows the icon that matches its old emoji (clipboard, trophy, book ...), or a folder.
- [ ] Create space (sidebar +) and Create project with a new space. Expect: a grid of 24 line icons, the chosen one highlighted and shown in the preview; the new space appears with that icon.
- [ ] Edit a space, change only its name, save. Expect: its icon is unchanged.
- [ ] Space dropdowns (create ticket, sprint filter, all tickets) and Viva's answers. Expect: the space name without an emoji in front.
- [ ] Start-up screen and Settings, Plan. Expect: both say v3.4.
- [ ] Logo (top bar, start-up screen, browser tab). Expect: a hexagon holding a gold open book; on load the left page settles with a small shake, then the right page; it does the same when the logo is hovered, and keeps moving while Liraspaces starts. With "reduce motion" on in the system it stands still.
- [ ] Avatars (top right, board cards, ticket popup, filters, capacity). Expect: all in the button colour of the theme, with a readable label.
- [ ] Collapse and expand the sidebar several times on a full board. Expect: it slides quickly, without stutter, and the rows do not jump or re-wrap while it moves.

### A23. Ticket popup: child issues, links, comments, labels (13 Nov 2026)  ◐
- [ ] Open an epic. Expect: a "Child issues" section right below Attachments, saying "No tickets linked." when it has none; a "Linked issues" section below it.
- [ ] Epic, **Child issue**. Expect: a dialog listing only the other tasks of the space (not bugs, subtasks or tasks already under it), with a box to name a new task.
- [ ] Type a name and press Enter. Expect: the dialog closes and the new task is listed under Child issues, in To Do.
- [ ] Open that new task. Expect: its Parent is the epic; it has its own Child issue button, which offers and creates subtasks.
- [ ] Epic, Child issue, tick two existing tasks, **Add as child issues**. Expect: both appear under Child issues; each shows the epic as Parent.
- [ ] Open a subtask. Expect: no Child issue button and no Child issues section; Link issue is there.
- [ ] **Link issue**. Expect: every other ticket is offered, of any type, status (also Done) and space; search and the type chips narrow the list.
- [ ] Tick three tickets. Expect: each gets a dropdown with relates to, blocks, is blocked by, duplicates. Choose a different one for each, **Link tickets**. Expect: all three are listed under Linked issues with their relation; "You have unsaved changes" shows.
- [ ] **Save changes**, then open each linked ticket. Expect: "relates to" shows on both; the ticket this one blocks is switched to Blocked and shows "is blocked by" this one; the ticket this one is blocked by shows "blocks"; the duplicated ticket shows "is duplicated by".
- [ ] Choose "is blocked by" for a ticket. Expect: the Blocked switch of this ticket turns on with that ticket listed.
- [ ] Remove a link with its X, Save changes. Expect: the link is gone from the other ticket too; a ticket that was blocked only by this one is unblocked.
- [ ] Link a ticket, then close the popup and choose Discard changes. Expect: no link on either ticket.
- [ ] Write a comment, do not press its Save, press **Save changes**. Expect: a dialog with Save comment, Discard comment and Keep editing.
- [ ] Choose **Save comment**. Expect: the comment and the ticket are saved and the popup closes. Reopen: the comment is there.
- [ ] Repeat and choose **Discard comment**. Expect: the ticket is saved, the comment is not, the popup closes.
- [ ] Repeat and choose **Keep editing** (or press Escape). Expect: nothing is saved, the popup stays open with the comment still in the box.
- [ ] Write a comment and close the popup with X. Expect: "Discard changes?" is asked.
- [ ] Paste a very long text (several pages) as a comment and save it. Expect: all of it is saved.
- [ ] In the comment box and in the description, type a slash. Expect: "/" is typed; the cursor stays in the box and the search box does not take over. Outside any text box, "/" still jumps to search.
- [ ] Below the comment box. Expect: only Cancel and Save; the line about pasting screenshots and Ctrl+Enter is gone.
- [ ] Labels in the ticket popup: press + Add, type a label, press Enter; type another, press comma. Expect: each is added and the cursor stays in the box; Escape closes the box; the same label is not added twice.
- [ ] Create ticket dialog: type a label and press Enter in the Labels box. Expect: the ticket is not created; a comma is added so the next label can be typed.
- [ ] Add a label to an epic, Save changes. Expect: its tasks, their subtasks and the bugs under any of them show the label, with a dashed outline and no X.
- [ ] Add a label to a task (not its epic), save. Expect: its subtasks and bugs get it; the epic and the other tasks do not.
- [ ] Remove the label from the epic, save. Expect: it is gone from everything below, except where it was also typed on the ticket itself.
- [ ] Create a ticket with a parent chosen, and a child with Child issue. Expect: both have the labels of the parent straight away.
- [ ] Change a ticket's Parent to another epic, save. Expect: it loses the old epic's labels and gets the new one's.

### A24. New-ticket status and space colours (13 Nov 2026)  ◐
- [ ] Create ticket dialog. Expect: Status offers only Backlog and To Do.
- [ ] Board, "+ Add" in the In Progress or Done column. Expect: the dialog starts on To Do. "+ Add" in Backlog starts on Backlog.
- [ ] Ask Viva to create a ticket "in progress". Expect: the ticket is created in To Do.
- [ ] Create space, and Create project with a new space. Expect: no colour swatches; an icon grid only.
- [ ] Sidebar, board header, summary, filters, calendar, projects, For you, sprint planning. Expect: every space tile and chip uses the colours of the theme; no space has a colour of its own.
- [ ] Edit an existing space and save. Expect: nothing about its look changes.

### A25. Roadmap layout (13 Nov 2026)  ◐
- [ ] Open a roadmap. Expect: one strip with the four numbers and the status bar, and the timeline directly below the toolbar, not at the bottom of the page.
- [ ] Timeline with a short roadmap (a month or two). Expect: the calendar spans the whole panel, with no empty area to the right; bars are wide enough to tell apart.
- [ ] Switch Weeks, Months, Quarters. Expect: the calendar still fills the panel in each; only the header rows change for a short roadmap.
- [ ] A long roadmap (a year or more) in Weeks. Expect: it keeps its scale and scrolls sideways.
- [ ] Look at the first and last dates. Expect: the calendar starts a few days before the first item and ends a few days after the last; no empty months.
- [ ] Several milestones close together. Expect: their labels sit in separate rows and none overlaps another; the milestone row grows as needed.
- [ ] Collapse and expand the sidebar, and resize the window. Expect: the calendar re-fits the new width.
- [ ] Drag a bar, and drag its edge. Expect: it follows the pointer day by day and lands on the day shown, as before.
- [ ] Planner. Expect: it fills the panel the same way; dragging an epic bar or a ticket chip lands on the day under the pointer.
- [ ] Today button. Expect: today's line is in view.

### A26. Six palettes (14 Nov 2026)  ◐
Reference screens: `docs/04-quality/ui-references/`.
- [ ] Settings, Appearance, Dark Mode. Expect: "Choose a dark palette" with Pace (selected in a new workspace) and Blackridge.
- [ ] Pick **Blackridge**, Save. Expect: jet black page, smoke grey secondary text, cherry red buttons with white labels.
- [ ] Choose Light Mode. Expect: four palettes: Sorrel, Fawn, Mossgrove, Tidewell.
- [ ] Pick **Mossgrove**, Save. Expect: white cards on a pale green page, emerald navigation and links, tangerine buttons with dark green labels.
- [ ] Pick **Tidewell**, Save. Expect: pearl white page, ink navy navigation and text, electric coral buttons with navy labels.
- [ ] Pick Blackridge for dark, switch to Light and pick Tidewell, switch back to Dark without saving. Expect: Blackridge is still the one picked; each mode remembers its own choice.
- [ ] Save in Light, later switch to Dark and save. Expect: Dark comes back in the dark palette you last saved, and Light later in the light one.
- [ ] Gear menu, System settings. Expect: the palette pills are those of the chosen mode (two for dark, four for light) and Save applies the choice.
- [ ] Reload the page in Blackridge, Mossgrove and Tidewell. Expect: each comes back as saved.
- [ ] In each of the three new palettes walk the board, a ticket popup, sprints, roadmaps, dashboards, filters and the Viva chat. Expect: every label on a button is readable, links are readable, and no screen falls back to another palette's colours.

### A27. Flat design pass (18 Nov 2026)  ◐
- [ ] Open the board, a ticket popup, a dropdown, a dialog and Viva in any palette. Expect: no drop shadows anywhere; panels are separated by borders and surface steps; nothing glows.
- [ ] Hover buttons, cards, icons and the Viva button. Expect: colour changes only; nothing grows, slides or tilts.
- [ ] Look at dialog backdrops. Expect: a plain dim layer, no blur behind it.
- [ ] Look at corners. Expect: small, even rounding everywhere; nothing pill-shaped except round avatars and dots.
- [ ] Open Viva. Expect: a flat panel in the navigation colour, the product mark as its picture, no sparkle icon, no glow, no purple.
- [ ] Look at epics, labels, categories and anything that used to be purple. Expect: the accent colour of the palette in use, or ochre for epics.
- [ ] Look at status colours (red, green, amber, blue) in light and dark palettes. Expect: four muted hues only, readable on every page colour.
- [ ] Calendar view and the roadmap Now/Next/Later board. Expect: no coloured stripe down the side of a card; a thin full outline or a small coloured dot instead.
- [ ] A blocked ticket. Expect: the flames still rise, with a flat outline instead of a glow.
- [ ] Read any message from Viva, the standup agenda and the sprint report. Expect: no em dashes.
- [ ] Reload the page with a slow connection (browser tools, Slow 3G). Expect: a grey skeleton of the app while it starts, then the real screen; with "reduce motion" on, the skeleton does not pulse.
- [ ] Open Dashboards, Roadmaps, Projects, Sprints and Filters for the first time. Expect: a grey page skeleton for a moment, then the page.
- [ ] Open a ticket for the first time after loading, and Viva. Expect: both open correctly (they load when first used).

### A28. Top bar and quick page changes (18 Nov 2026)  ◐
- [ ] Look at the top bar. Expect: no nine-dot app switcher; the Lira mark and name sit alone at the left, on the page colour, not in the dark box.
- [ ] Look at the dark box. Expect: it holds only Your work, Filters, the search field and Create, centred on the screen.
- [ ] Look at the right side. Expect: the bell, the settings gear and your avatar sit outside the box, each in its own dark circle; PC Saved has no circle and is readable in every palette.
- [ ] Open Your work, Filters, the bell and the account menu. Expect: each panel opens under its control and closes on Escape or a click outside.
- [ ] Click Projects, Sprints, All tickets and Roadmaps one after another, quickly. Expect: the highlight in the sidebar keeps up (about a tenth of a second per step) and each page appears at once, without a long grey skeleton after the first second of use.
- [ ] Narrow the window to phone width. Expect: the mark, the box (search and Create) and the three circles all fit with no sideways scroll.
- [ ] Open Viva from its round button at the bottom right, and Backup from Settings. Expect: both still work now that the switcher is gone.

### A29. Sidebar rows all the same size (18 Nov 2026)  ◐
- [ ] Look down the left sidebar: For you, Projects, Sprints, All tickets, Roadmaps, then spaces, projects and sprints. Expect: every row has the same height, the same text size and weight, and the icons line up in one column.
- [ ] Hover a space, a project and a sprint. Expect: the row keeps its size and the "..." button appears at the right without moving the name much.

### A30. Name and logo: Liraspaces (19 Nov 2026)  ◐
- [ ] Look at the browser tab on any page. Expect: the title ends in "Liraspaces" (for example "Board · Liraspaces"), and the icon is the hexagon with the gold book. In a dark browser theme the hexagon is cream; in a light one it is navy.
- [ ] Look at the top bar, the empty home screen and the start-up screen. Expect: the hexagon logo, with the name "Liraspaces" next to it in the top bar and on the home screen, and "Initializing Liraspaces v..." at start-up. The top bar name still fits on one line at a narrow window.
- [ ] Open Settings. Expect: the title "Liraspaces Settings & Administration" and, under About, "Liraspaces Community Edition v...".
- [ ] Read the Share window, the account menu's Log out message, the Devices tab, the Dashboards, Roadmaps and attachment messages, and Viva's example prompt. Expect: they say "Liraspaces" where they mean the app.
- [ ] Open the space, projects and roadmap that you named "Lira". Expect: they keep the name "Lira"; only the app name changed.
- [ ] Add the site to the phone home screen (or look at `public/lira-icon.png`). Expect: a navy square with the hexagon and gold book, not the old L.

### A31. Public pages of the hosted edition (19 Nov 2026)  ◐
Run `npm run hosted` in a terminal (it builds the hosted edition, then serves it at http://localhost:5175 and does not touch `data/`). Leave it running, and run `npm run dev` in another terminal to see the local app at http://localhost:5173 beside it.
- [ ] Open `/`. Expect: a fixed top bar (logo set in from the left edge, Features, Solutions, Guides, Templates, a search button, Sign in, Get it free), the headline "Everything you are working on and learning, in one place.", an email bar with Sign up and a Google button (greyed out until Google is set up on the server, A40), and the large sample space below. There is no Pricing anywhere. Light mode looks like Sorrel (off-white, sage frame, tomato red buttons); dark mode looks like Pace (black, silver text, yellow buttons).
- [ ] Scroll down the landing page. Expect: the top bar stays at the top and the page moves beneath it.
- [ ] Press "Light mode" or "Dark mode" in the top bar (wide windows). Expect: the page switches, and the choice is the same one the app uses.
- [ ] Click Features, then Solutions, then Templates. Expect: each opens a list; Escape, a click elsewhere or scrolling closes it. Features items go to "What is inside"; the others go to the "Still baking" page.
- [ ] Open `/signup`, `/terms`, `/privacy` and `/notice`. Expect: the top bar has no search button on any of them (only the landing page keeps it).
- [ ] Click the search button and type "privacy", then "zzzz". Expect: the Privacy Policy is listed and opens when clicked; for "zzzz" it says "Nothing found".
- [ ] In the email bar press Sign up empty, then with "abc", then with "asha@example.com". Expect: "Enter your email." then "Enter an email like you@example.com." then the get-started page with the email already filled in.
- [ ] On the get-started page (`/signup`). Expect: a window titled "Get started with Liraspaces" over a grey drawing of the app, the email field, Sign up, a Google button (greyed out until Google is set up on the server, A40), "Already have an account? Log in", and a × that returns to the landing page. A valid email moves to a second step asking for a name and a password (10 characters or more) for that email, with "Use a different email".
- [ ] Open `/login`. Expect: nothing but the card and the two scenes: no top bar, no footer, no search. A centred card (logo, "Log in to continue", Email, Password, Remember me with a small "i" whose tooltip says 30 days, Log in, Google (greyed out until Google is set up, A40), "Can't log in?" and "Create an account"). On a wide window two flat scenes sit in the bottom corners: a work board with a chart, tickets and a plant on the left, and an arched library window with books and a graduation cap on the right. Both stay visible in light and dark mode. Empty fields show "Enter your email." and "Enter your password.". With the API running (A33), a wrong password shows "The email or password is not correct." and a right one opens the app.
- [ ] Open `/terms`, `/privacy` and `/notice` from the footer. Expect: each shows a draft notice, names WorldXAdmins and the contact email, and the tab title ends in "Liraspaces".
- [ ] Open `/app`. Expect: the app, with its own addresses under `/app` (for example `/app/for-you`), and refresh keeps you on the same page. Click the logo. Expect: the "Still baking" page.
- [ ] Open an address that does not exist, such as `/nothing`. Expect: the landing page.
- [ ] Narrow the window to phone width. Expect: no sideways scrolling; the top bar keeps the logo mark, search, Get it free and a Menu button that lists the pages; the email bar stacks; the sample board becomes one column.
- [ ] With `npm run dev` (local edition) open `/` and `/login`. Expect: the app as before and no landing page.

### A32. Landing page, the rest of the sections (19 Nov 2026)  ◐
Same way of running as A31 (`npm run hosted`, then http://localhost:5175).
- [ ] Press the sun or moon button in the top bar. Expect: the page switches between light (Sorrel) and dark (Pace); in dark mode the button shows a sun, in light mode a moon; nothing else moves.
- [ ] Click into the email field on the landing page and on `/signup`. Expect: the focus box goes around the whole bar (field and Sign up button together) with a small gap, not hard against the button.
- [ ] Scroll the landing page. Expect, in order: the hero and sample space, "What is inside", "More than project management" (Search, Viva, Roadmaps and dashboards, each with a picture, alternating sides), "Liraspaces is better with documents and files" (with the Includes list and four example cards, one dark), the black band, "Discover the latest", "Your data", the black closing band, and the large grey footer.
- [ ] Reach the black band. Expect: it is black in light mode too; "Liraspaces for the AI era" and a second line "> connect anywhere" whose word "anywhere" is typed letter by letter, again each time you scroll to the band, with a blinking block caret; "WORKS WITH" shows only "Any MCP agent" with a note that it is coming soon; three columns with dot icons, two of them marked COMING SOON.
- [ ] Move the mouse over the black band. Expect: faint dots light up around the pointer and fade as it moves away. With "reduce motion" on in the system, or on a phone, the dots stay still.
- [ ] Scroll to "Discover the latest". Expect: the cards slide in from the right once and stay. Use the arrows, the mouse wheel or a swipe: the row scrolls a card at a time, the left arrow is switched off at the start and the right arrow at the end. Six cards: four "UPDATE" and two "COMING SOON".
- [ ] Read the closing band and the footer. Expect: "Plan, learn and deliver in Liraspaces" with two gold words, a "Get Liraspaces free" button to the sign-up page; the footer has Contact us, PRODUCT, RESOURCES and LEGAL columns, no Pricing, Careers or Press kit.
- [ ] Narrow the window to phone width. Expect: no sideways scrolling of the page; the row of cards still scrolls sideways inside itself; the sections stack to one column.

### A33. Sign-up, log-in and the app behind them (19 Nov 2026)
Needs the API and a database: the rehearsal in `infra/azure-playground/`, or the API run locally (see `api/README.md`) behind the web container.
- [ ] Open `/signup`, enter an email, press Sign up, then give a name and a password of at least 10 characters and press Create account. Expect: the app opens at `/app` with its own sample data. Refresh the page. Expect: you are still signed in.
- [ ] Open `/signup` again with the same email in capitals. Expect: "An account with this email already exists." and a Log in link; nothing else changes.
- [ ] Open `/login` in a private window and log in with a wrong password. Expect: "The email or password is not correct." The same message for an email that has no account.
- [ ] Give five wrong passwords for one email, then the right one. Expect: "Too many wrong attempts. Wait a few minutes and try again."
- [ ] Log in with "Remember me" ticked, then without. Expect: both work; with the tick the browser's cookie (developer tools, Application, Cookies) lasts about 30 days, without it about 12 hours. The cookie is marked HttpOnly and Secure.
- [ ] Open `/app` in a private window without logging in. Expect: you are sent to `/login`, and the app never shows.
- [ ] In the account menu (top right of the app) press Log out. Expect: you land on `/login`; pressing the browser's Back button does not show the app, and `/app` sends you to `/login` again.
- [ ] Stop the API (or block `/api/`) and open `/app`. Expect: "Liraspaces could not check your session" with a Try again button, and the app does not show.
- [ ] Open `https://<address>/api/me` directly. Expect: a plain JSON answer with `"code":"unauthorised"` when not signed in, and no stack trace anywhere.
---

## B. Things that changed everywhere (quick sweeps)

### B1. Dialogs start fresh when opened (affects ~25 dialogs)  ◐
For each: open, type something, close, reopen. Expect: empty / reset, not the old text.
- [ ] Create space, Create project, Create sprint, Create ticket, Widget gallery, Dashboard alerts, Weekly snapshot, Standup (Agenda/Schedule/Team), Attach picker, Blocker picker, Customise sidebar, Settings, Close sprint, Documents, Attachments, Forms.
- [ ] **Customise sidebar**: Cancel discards edits; reopening shows the saved layout.
- [ ] **Settings**: an unsaved theme or light-palette choice is dropped on reopen.
- [ ] **Documents / Attachments / Forms** (space actions): first open shows the sample content, later opens show your saved content.

### B2. Saved settings (now go through one storage door)
- [ ] Change theme, light palette, sidebar layout, hidden/archived spaces, starred spaces, profile name, language, notifications. Reload the page. Expect: all remembered.
- [ ] Hide a space, archive another, **Unhide all**. Expect: lists update and survive reload.
- [ ] Open a space, go to **For you**, reload. Expect: you land on the same space; if that space was deleted you land on CERT or the first space.
- [ ] Clear browser data and reload (dev server running). Expect: everything comes back from `data/`.

### B3. Colours and text sizes (look only)  ◐
- [ ] Ticket type icons, priority colours, status badges, avatars, charts, donuts: each keeps its own colour (green done, amber in progress, red blocked, purple epic) in all three themes.
- [ ] Small text (badges, captions, dashboard labels, table headers) looks the same size as before; no text suddenly bigger or smaller.
- [ ] Every palette: nothing unreadable. Button labels are black on yellow (Dark), white on tomato red (Sorrel), brown on baby blue (Fawn).

### B4. Dates and "today"
- [ ] **For you**: greeting and date line show today; "days left" correct.
- [ ] **Calendar** view: today highlighted; month grid starts on Monday.
- [ ] **Date picker** (any date field): opens on the current value or today; month/year chooser works; min/max respected.
- [ ] Roadmap **today line** and "Now" markers are on today.
- [ ] Capacity view date ranges start from today.

### B5. Dashboards (numbers were restructured)
- [ ] Open each dashboard template. Expect: every widget draws (stat cards, bars, donut, trend, throughput, burndown, burnup, cumulative flow, lists, blocked, progress, workload, due strip, roadmap, summary).
- [ ] Click a **stat card**: the ticket list behind it opens, and its length matches the number.
- [ ] Click a bar or donut slice: its tickets open.
- [ ] Change dashboard filters (space, sprint, range, assignee, priority, type, label). Expect: numbers change and make sense.
- [ ] Build one **from a sentence** ("my bugs this week"): the note lists what it understood.
- [ ] **Export**: Markdown snapshot and picture export both work; the snapshot text lists every widget.
- [ ] Alerts: set a goal; it turns red when breached.

### B6. Descriptions from older tickets
- [ ] Open an old ticket whose description was Markdown (headings, lists, `- [ ]` tasks, quotes, code blocks). Expect: shown formatted; a list that starts a line right after a paragraph still becomes a list.

### B7. Server and data (dev server)
- [ ] Create, edit, delete a ticket; check `data/spaces/<KEY>.json` changed and the status bar shows "PC Saved".
- [ ] Delete a space with tickets: its file is removed and its tickets are not lost (see `data/spaces/_orphans.json` if any were left).
- [ ] `npm run test:health` passes.
- [ ] Open `http://localhost:5173/api/health` in the browser. Expect: `"status":"ok"` with counts.
- [ ] Phone/tablet (`npm run dev:lan`): the link with `?key=` works, the plain address from another device is refused.

---

## C. Browser console and build
- [ ] No red errors in the console during sections A and B.
- [ ] `npm run test:all` passes.
- [ ] `npm run build` succeeds and `npm run preview` opens the app (it cannot save to disk; that is expected).

## D. Record the result
- [ ] Note the date, browser, theme(s) tested and any failures in the pull request.
- [ ] For each failure: screen, steps, expected, actual, a screenshot.

### A35. Hosted edition: spaces and tickets live on the server (20 Nov 2026)  ◐
Needs the hosted app running against the API (a cloud rehearsal, A33). Sign up with a new email.
- [ ] Sign in with the new account. Expect: an empty workspace, no sample spaces or tickets.
- [ ] Create a space, then a ticket in it. Expect: both appear, the ticket key starts with the space key and counts up (KEY-1, KEY-2), even if you create tickets in two browser tabs.
- [ ] Reload the page, then open the site in another browser and sign in. Expect: the same space and tickets in both.
- [ ] Change a ticket's status in one browser, wait a few seconds, reload the other. Expect: the new status.
- [ ] Change the same ticket in both browsers, one after the other, without reloading the first. Expect: the later save does not silently overwrite: the first browser ends up showing the other's version.
- [ ] Delete a ticket, then a space. Expect: gone after a reload, in both browsers.
- [ ] Stop the API (or go offline), change a ticket, start it again. Expect: the change reaches the server within seconds.
- [ ] Create a project and a roadmap, change the theme, sign out, then sign in again in a private window. Expect: the project and roadmap are there (shared with the organisation) and the theme is yours.
- [ ] Sign in as a second person on the same browser. Expect: none of the first person's projects or settings show.
- [ ] Open a ticket, Attachments section. Expect: a drop zone, "No files yet.", then after choosing a picture and a PDF both are listed with their size. Download opens a download (not a page); Remove deletes the file. A .html file is refused with a message. Paste a screenshot into the description: expect a message that says to add files in the Attachments section, and nothing is pasted.
- [ ] Known gaps (not bugs yet): links to Drive, OneDrive or Dropbox and files while creating a ticket (add them afterwards); the Viva AI key is still only in the browser; two people saving the same roadmap at once: the later save wins.

### A36. Teams, access and invitations (20 Nov 2026)  ◐
Needs the hosted app against the API (a cloud rehearsal). Use two browsers (or one normal and one private window): the owner in one, the invited person in the other.
- [ ] As the owner, open the account menu, Teams and access. Expect: People, Teams and Access tabs, and the owner listed as Owner.
- [ ] People: invite an email with role Member. Expect: since email is not connected, a message with a link to copy, shown once; the invitation is listed under "Waiting to join".
- [ ] In the other browser, sign up with that email (or log in), open the copied link, press Accept invitation. Expect: "You have joined" and the app opens with no spaces at all.
- [ ] Try the same link again, and a link opened by a different account. Expect: "not valid any more", and "sent to a different email address".
- [ ] Teams: make a team, tick the new person, Save people. Delete a second team. Expect: the card shows the count; deleting asks first.
- [ ] Access: choose Space, then a space, give the team View. In the invited person's browser reload. Expect: that space is listed and its tickets can be read, but creating or changing a ticket is refused.
- [ ] Change the team to Edit. Expect: after a reload the person can add, change and delete tickets and files, but cannot rename the space or create a new one.
- [ ] Change it to Manage. Expect: they can rename the space; they still cannot create a new space.
- [ ] Choose Project, Roadmap and Dashboard in Access. Expect: the list shows their names; a grant on one does not show the others to that person.
- [ ] Owner: set the person's role to Viewer. Expect: even with Manage granted they can only view. Set Admin, then switch off "Can manage people and access": that Admin sees everything but the Teams page says they have no access.
- [ ] Remove the person. Expect: they lose every space at once.
- [ ] A new account (no invitation). Expect: no sample projects, roadmap or forms.
- [ ] Known gaps (not bugs yet): buttons are not hidden for a person who may only view (the server refuses the change); stand-ups; email is not sent.

### A37. Stand-up calls (21 Nov 2026)  ◐
Needs the hosted app against the API, an owner and a second person who is a Member (see A36).
- [ ] As the owner open the account menu, Calls. Expect: "No calls are scheduled for you." and a Schedule a call button.
- [ ] Schedule one for the second person (or a team): title, a start time, 15 minutes, a Google Meet link, tick the guest. Expect: it appears under Upcoming with "Invited: ..." and a Join call button; a note says nobody was emailed because email is not connected.
- [ ] Try a link on another site (for example https://example.com/x) and one starting with http://. Expect: refused before sending, with a message naming Google Meet and Microsoft Teams.
- [ ] Try to schedule with nobody ticked. Expect: "Invite at least one person or team."
- [ ] As the second person open Calls. Expect: the call, a Join call button that opens the link in a new tab, and no Schedule, Change or Delete buttons and no guest list.
- [ ] A third person who is not invited. Expect: the page lists nothing.
- [ ] As the owner Change the call (new time), then Delete it after the question. Expect: the second person sees the new time after a reload, and the call is gone after the delete.
- [ ] A call in the past. Expect: it moves to Earlier, dimmed, with its Join link still shown.

### A38. Repeating stand-ups, Google and the calendar (21 Nov 2026)  ◐
Same set-up as A37. The Google lines need Google set up first (`docs/03-sop/google-setup.md`); everything else works with a pasted link.
- [ ] Schedule "Every weekday" "For 1 month". Expect: the list shows one entry, "Next: ..." and "Every weekday until <date>"; the calendar shows a small dark chip with the time and title on each weekday of the series, and clicking a chip opens the Meet link in a new tab.
- [ ] Try "For 1 week", "For a number of days" (10) and "Until a day I choose". Expect: the last day shown after saving matches (7 days counting the first; 10 days counting the first; the chosen day).
- [ ] Change the series' last day. Expect: the calendar follows after a reload. Delete the series. Expect: the question mentions the whole series, and every chip is gone.
- [ ] Owner: on the Calls page press Connect Google (needs Google set up: docs/03-sop/google-setup.md). Expect: Google's sign-in and permission page, then back with "Google is connected." and the account's email on the page; an Admin sees no connect button.
- [ ] Schedule with the link left empty. Expect: a meet.google.com link on the call; each invited person gets an email from the connected account (time in the call's time zone, the link, and "It repeats ..." for a series), and the page says how many emails were sent.
- [ ] Disconnect Google. Expect: scheduling without a link is refused with a message to paste one or connect Google.

### A53. Mind maps (24 Nov 2026)  ◐
Both editions. Navigation, **Mind maps** (it can be hidden or moved in the sidebar settings).
- [ ] Press **New mind map**. Expect: a map with one central idea named like the map, opened on its own address; it is in the list at the left.
- [ ] Click the central idea, press **Tab**, type a name, press Enter. Expect: a new idea under it, joined by a curve, the text saved. Press **Tab** again on it: a deeper level. Press **Enter** on a child: a sibling next to it.
- [ ] Double click an idea, or press F2, change the text, press Escape. Expect: the old text stays. Change it again and press Enter: the new text stays.
- [ ] Press Delete on an idea with children. Expect: it and its branch go; the central idea cannot be deleted.
- [ ] Press Space on an idea, or the small round button on its right. Expect: its branch hides and shows a plus; again to unfold. **Fold all** and **Unfold all** do it for every branch.
- [ ] Drag an idea onto another. Expect: it moves, with its branch, under the other; dropping it onto its own child or onto nothing changes nothing.
- [ ] Drag the empty background to pan, use the wheel and + and – to zoom, **Fit** to see it all. Expect: nothing overlaps whatever the size of the map.
- [ ] Select an idea. Expect: a panel with colours, a note and a ticket key (try LIRA-1): a coloured edge, a note dot, the ticket key above the box and its title in the panel.
- [ ] Type in **Search ideas**. Expect: matching ideas are ringed with a dashed line.
- [ ] **Undo** and **Redo** (or Ctrl+Z, Ctrl+Y) after several changes. Expect: each goes back and forward.
- [ ] **Import outline**: paste an indented list. Expect: the map is replaced by it and Undo brings the old one back. **MD**: a Markdown outline downloads. **JSON**, **SVG** and **PNG** also download, named after the map; the picture shows every idea.
- [ ] Make a copy, delete one (it asks first). Reload the page. Expect: everything is as left. Local edition: the maps are in the data folder's `mindmaps.json`. Hosted: another member does not see your map until you share it (Access, kind Mind map); an Owner sees all.

### A54. Story boxes (24 Nov 2026)  ◐
Both editions. Navigation, **Story boxes**. Hosted: use an Owner or Admin and a second person invited to a space (A46).
- [ ] As the Owner press **New story box**, choose **Space** and a space, give it a name, **Make the box**. Expect: it opens with every ticket of that space (no epics), and is listed under Open.
- [ ] Make another by **Sprint**. Expect: the tickets of that sprint from every space, with a Space filter.
- [ ] Press a number under **Your points** for a ticket. Expect: it is highlighted, "1 votes, average N" and your name with the points appear, a suggested value appears. Press it again: your points are taken back.
- [ ] Hosted, as the second person (view access to the space): open the box. Expect: the same tickets; you can press your own points and see the Owner's; you cannot close, delete, apply or change the final points; no **New story box** button.
- [ ] As the Owner, wait about ten seconds. Expect: the second person's points appear without a reload.
- [ ] Press **Use** next to a suggested value, then **Apply suggested points**. Expect: tickets without points get them (ticket pages show the story points); tickets that had points keep them. Change a ticket's points from its dropdown.
- [ ] Search tickets, tick **Without points only**. Expect: the list narrows.
- [ ] **Close the box**. Expect: it moves to History, the point buttons are disabled for everyone, a message says it is closed; a point sent anyway is refused. **Reopen** brings it back.
- [ ] Hosted: a sprint box is not visible to the second person until it is shared with them (Access, kind Story box). A person with no access to a space cannot vote on its tickets.
- [ ] **Delete** asks first, removes the box and its votes; points already on tickets stay.

### A52. Import a local workspace (24 Nov 2026)  ◐
Hosted app, signed in as the Owner. Use a copy of the local data folder (never the real one), for example copy `data/` to a temporary folder first and leave `private` out.
- [ ] Teams and access, tab **Import**. Expect: a short explanation and two file choices (Files, and a data folder); nothing is shown yet.
- [ ] Choose the copy's `lira-workspace.json`. Expect: "Found N spaces, N tickets, ..." and an Import button; nothing has been sent (the sidebar is unchanged).
- [ ] Choose the whole data folder copy instead (including `projects.json`, `dashboards.json`, `roadmaps` and `private`). Expect: spaces and tickets found, plus projects, roadmaps and dashboards; the secrets folder is never read; files it does not use are listed under "Not used".
- [ ] Press Import. Expect: "Importing x of y", then "Imported N spaces, N tickets, ...". The new spaces appear in the sidebar with their tickets.
- [ ] Open an imported epic. Expect: its children are under it, links and blockers point at the right tickets, comments and labels are there, and ticket keys are new (the space's own counter).
- [ ] Import the same files again. Expect: spaces whose key exists come in with a new key (for example AI2), and the report says what was left out and why.
- [ ] Projects, roadmaps and dashboards. Expect: they point at the new spaces; a dashboard filtered on a space shows that space's tickets.
- [ ] Files attached to tickets. Expect: they are not imported (stated on the page).
- [ ] Sign in as a member who is not an Owner or Admin. Expect: the Teams page is not offered, so there is no import.

### A51. Two-step sign-in and leaked passwords (24 Nov 2026)  ◐
Hosted app with the Google key set (Security shows the Turn on button), a phone with an authenticator app, and `BREACH_CHECK=true`.
- [ ] Sign up with the password `password123`. Expect: refused with a message that the password appears in a list of leaked passwords. A long unusual password is accepted.
- [ ] Use Forgot password and choose `password123` as the new one. Expect: the same refusal, and the old password still works.
- [ ] Account menu, **Security**. Expect: "Off" and **Turn on**. Press it. Expect: a key to type into the app and a link; type the key into the authenticator app, type its six digits, press **Turn on**. Expect: ten recovery codes, shown once.
- [ ] Start again and type a wrong code. Expect: a message and nothing switched on; log out and in still works without a code.
- [ ] Log out, log in with the password. Expect: a page "Enter your code", no app behind it. Type the six digits. Expect: you are in. Type the same code again at a later login within the same 30 seconds. Expect: refused, wait for the next code.
- [ ] Log in and type five wrong codes. Expect: after the fifth the login must be started again.
- [ ] Log in and use a recovery code (with or without the dash). Expect: it works once; the second time it is refused.
- [ ] Security, **Turn off**: with no code the button is off; with a wrong code a message; with the right code it turns off and the next login has no second step.
- [ ] Sign in with Google. Expect: no code page (Google has its own). For a Google-only account, Security refuses to turn it on and says to use Google's.
- [ ] Leave a login on the code page for more than ten minutes. Expect: the code is refused with a message to log in again.

### A50. Live updates between people (24 Nov 2026)  ◐
Hosted app, two browsers (or a normal and a private window) signed in as two people who can both see the same space, for example the Owner and a person invited with Can edit (A46).
- [ ] Both open the same space's board. In one, create a ticket. Expect: it appears in the other within a second or two without reloading.
- [ ] In one, drag a ticket to another column, rename it, change its assignee. Expect: the other shows each change within a second or two.
- [ ] In one, delete a ticket. Expect: it disappears in the other.
- [ ] While one person is typing a change that has not been saved yet, the other saves a change to a different ticket. Expect: the typing is not lost and the other ticket updates.
- [ ] The Owner creates a new space and shares it with the second person (Access tab, give access). Expect: the space appears in the second person's sidebar without reloading. Take the access away. Expect: it disappears.
- [ ] The second person has no access to a space where the Owner creates tickets. Expect: nothing changes for them, and nothing about that space is visible anywhere.
- [ ] Switch the network off for the second person for a minute, change tickets as the first, switch it on again. Expect: within seconds everything is up to date.
- [ ] Log the second person out in another tab. Expect: that window stops updating (it is asked to log in again on the next action).
- [ ] Open the same app in seven tabs as one person. Expect: the app keeps working; the seventh tab shows no live updates until another is closed.
- [ ] In one browser rename a roadmap, add a project, make a mind map or a story box. Expect: the other browser shows it within a second or two without a reload (unless it has unsaved changes of its own, which are never overwritten).
- [ ] Note: shared settings (sprint definitions, teams, stand-up notes) are not live yet; they show after a reload.

### A49. Lighter theme picker (24 Nov 2026)  ◐
Open Account settings, Appearance.
- [ ] Look at the choices. Expect: two options, **Dark** and **Light**, each one a single rectangle of three colours with no gap or line between them and its name beside it; no description text, no tick circle, no big boxes.
- [ ] Under them. Expect: the heading "Choose a dark palette" (or light) and one rectangle with a name for each palette: Pace and Blackridge for dark; Sorrel, Fawn, Mossgrove and Tidewell for light.
- [ ] Under those. Expect: a short list for the chosen palette: each of its three colours with its name and what it paints (for Pace: Black, the page and the panels; Silver, text and thin lines; Yellow, buttons and the selected item).
- [ ] Pick another palette, then Light and another palette. Expect: the list changes at once to match; the Dark and Light rectangles show the colours of the palette chosen for each; the selected option has a coloured border.
- [ ] Press Save and reopen. Expect: the saved choices are selected. Check both modes and every palette, on a narrow window too.

### A48. Calls in the Google calendar (24 Nov 2026)  ◐
Needs Google set up with the Calendar API enabled and the calendar.events permission on the consent screen (docs/03-sop/google-setup.md), and a second person with a mailbox.
- [ ] As the Owner open Calls. If Google was connected before this version, Expect: the panel says invitation emails are sent from the account and shows **Allow calendar invitations**. Press it, agree at Google. Expect: back on Calls, the panel now says each call goes into the calendar, and the button is gone.
- [ ] Schedule a call for the second person with no link. Expect: an event with the Meet link appears in the Owner's Google Calendar, the second person gets Google's calendar invitation (not a second email from the app), and Calls lists it as before.
- [ ] Change the time and the title of the call. Expect: the same event moves in the calendar and the second person is told of the change.
- [ ] Make a daily call with a last day, then change its last day. Expect: one repeating event that ends on the last day (at the call's own time of day), not a separate event for each day.
- [ ] Delete the event in Google Calendar, then change the call in Liraspaces. Expect: the event is made again.
- [ ] Delete the call in Liraspaces. Expect: the event disappears from the calendar and the second person is told it is cancelled.
- [ ] Disconnect Google and connect again without ticking the Calendar permission. Expect: calls still work, the panel offers **Allow calendar invitations**, and new calls email the invitation from Gmail as before.

### A47. Reminders by email (24 Nov 2026)  ◐
Needs email set up (docs/03-sop/email-setup.md) and two people with mailboxes you can read.
- [ ] Calls page. Expect: a box "Reminders by email" with two switches, both on. Without email set up Expect: both are disabled and the box says email is not set up.
- [ ] Schedule a call that starts in about 20 minutes and invite the second person. Wait until it is 15 minutes away. Expect: within a minute the second person gets "Reminder: ... starts in 15 minutes" with the time and the link; the person who scheduled it (not invited) gets nothing.
- [ ] Wait another few minutes. Expect: no second email for the same call.
- [ ] Make a repeating call (daily) and invite a team. Expect: each member gets one reminder per day.
- [ ] The second person switches off the call reminder and a new call comes up. Expect: they get nothing; the other invited people still do.
- [ ] Give a ticket to the second person (their exact name as assignee) with a due date of tomorrow. Expect: after 07:00 UTC they get "Due tomorrow: KEY" once; none for a done ticket, and none when two people in the organisation have the same name.
- [ ] The same person has no access to the ticket's space. Expect: no email.

### A46. Invite someone to one space (24 Nov 2026)  ◐
Hosted app. You are the Owner with at least two spaces that have tickets, and a project, a roadmap and a dashboard tied to the first space (plus ones tied to the other, and a dashboard across both). Use a second address you can open (or copy the link when email is not connected).
- [ ] People tab, **Invite**: type the address, choose the space, the access (Can view, Can edit or Can manage) and a role. Expect: choosing a space removes Admin from the roles and shows four switches (Linked projects, Linked roadmaps, Dashboards of this space only, Sprints), all on; the pending list says the space and the access.
- [ ] Open the invitation link in a private window, press **Create an account** and sign up with that address. Expect: after signing up you come back to the invitation and can press **Accept invitation** (confirm the address first when email is set up, A45).
- [ ] After accepting. Expect: "Open the shared workspace" and "Open my workspace"; press **Open my workspace**: you land in your own, empty workspace, never in the inviter's.
- [ ] Open the account menu. Expect: two entries, **My workspace** (in bold) and the inviter's workspace with "(invited)". Press the second. Expect: the app reloads in the shared workspace and stays there until you log out; after logging out and in you are in your own again.
- [ ] In the shared workspace. Expect: only the invited space in the sidebar, with a small **Invited** tag after its name; no other space; no Teams page content. Open the space: every ticket of it is listed.
- [ ] Projects, roadmaps, dashboards. Expect: only the project and roadmap tied to the invited space and the dashboard that uses only that space; nothing tied to the other space, none for a dashboard across both spaces.
- [ ] As the Owner, People tab, **Access**, kind **Space**, the invited space. Expect: a list "People invited to this space" with four switches per person. Switch off **Projects**; the person reloads. Expect: the projects are gone and roadmaps and dashboards stay. Switch off **Sprints**. Expect: the Sprints section and pages are gone for them, tickets still show.
- [ ] Invite someone with all switches off. Expect: they see the space's tickets and comments and no project, roadmap or dashboard.
- [ ] With **Can edit**: create a ticket, change one, comment, add a project and a roadmap for that space. Expect: it works; a project for another space is refused. With **Can view**: Expect: you can read everything but cannot create or change anything. With role **Viewer** and access Can edit: Expect: view only.
- [ ] As the invited person try to invite someone, rename or delete the space. Expect: not possible.
- [ ] As the Owner open the same space. Expect: no **Invited** tag for you, and you see what they created.
- [ ] Try to open another space of that organisation by its address while invited to one. Expect: not found, nothing leaks.
- [ ] Sign up with Google, then use Forgot password for that address. Expect: an email saying to use the Google button, no reset link; no password is ever asked for a Google account.

### A45. Confirm your email and reset your password (24 Nov 2026)  ◐
Needs email set up (docs/03-sop/email-setup.md) and a mailbox you can read. Without email set up only the last three lines apply.
- [ ] Sign up with email and password using your own address. Expect: an email "Confirm your email for Liraspaces" with a link to the site; in the app a small box at the bottom left asks you to confirm.
- [ ] Press **Send it again** in that box, then once more, then a third time. Expect: new emails the first times; then a message that a link was sent a moment ago.
- [ ] Open the link. Expect: "Your email is confirmed" and **Open Liraspaces**; the box is gone after you reload the app. Open the same link again: "This link did not work".
- [ ] On the log-in page press **Forgot password?**, enter your address. Expect: "Check your email", the same text for an address that has no account, and an email only for the real one.
- [ ] Open the reset link, type 5 characters and save. Expect: "Use at least 10 characters." Then a new password. Expect: "Password changed"; the old password no longer logs in, the new one does; an email says the password was changed.
- [ ] Use the reset link a second time, and one older than an hour. Expect: "expired or was already used" with a link to ask again.
- [ ] Be logged in on a phone, reset the password on the laptop. Expect: the phone is logged out.
- [ ] Invite a second address to your organisation; sign that person up but do not confirm; open the invitation. Expect: it asks them to confirm the address first. After confirming it works.
- [ ] Without email set up: open **Forgot password?** and send. Expect: a message that email is not set up; no confirm box in the app.

### A44. Already signed in: the public pages open the app (21 Nov 2026)  ◐
Hosted app, an account that is signed in.
- [ ] Sign in, then close the tab (do not log out) and open the site address again. Expect: you land in your workspace, not on the landing page.
- [ ] Close the whole browser, open it again and go to the site. Expect: the same.
- [ ] While signed in open the landing page and then `/login` by typing the address. Expect: each sends you to the app.
- [ ] Open `/signup`, `/terms` and `/privacy` while signed in. Expect: they show as normal, no redirect.
- [ ] Log out, then open the site address. Expect: the landing page.
- [ ] Sign in without **Remember me**, then leave the browser closed longer than the session hours. Expect: the landing page, and logging in asks for the password.
- [ ] On a phone sign in, then turn on **Desktop site**. Expect: you land in the app and stay signed in.

### A43. The call agenda lists every open ticket (21 Nov 2026)
Use a space that has more than ten To do tickets and more than ten Backlog tickets (the LIRA space does), and its Stand-up button.
- [ ] Open the Agenda tab, "By status". Expect: "Up next · To do" lists every To do ticket (its count in the heading equals the rows below it) and "Backlog" lists every backlog ticket, not only the first 8 and 6. Done tickets appear only under "Done in the last 24 hours".
- [ ] Switch to "By person". Expect: each person's card lists all their To do tickets under "Next" and all their backlog tickets under "Backlog", not three.
- [ ] Open a sprint call. Expect: the same lists, for the tickets of that sprint only; epics are never listed.
- [ ] Press "Copy call notes" and paste. Expect: the notes still give the top of each list only (8 To do, 5 backlog); this is deliberate, the notes are a summary.

### A42. Comment icon on the tickets of a call (21 Nov 2026)  ◐
Open a sprint, project or space call from its Stand-up button (the Agenda tab).
- [ ] Move the mouse over a ticket row. Expect: a small comment icon appears just before the note badge (for example "Overdue by 11d"); move the mouse away and it disappears.
- [ ] Do this in "By status" for every group (needs an update, blocked, in progress, done, up next, backlog), and in "By person" on the tickets of a person's card. Expect: the same icon.
- [ ] Press the icon. Expect: a box opens under the row, the ticket does not open, and the call stays open.
- [ ] Type a comment and press Post (or Ctrl+Enter). Expect: the box closes; open the ticket and the comment is in its activity, by you.
- [ ] Press the icon, then Cancel, or press Escape. Expect: the box closes and nothing is saved. Post is greyed out while the box is empty.
- [ ] Click the title, key or badge of a row. Expect: the ticket still opens as before.
- [ ] Use Tab to reach a row's icon. Expect: it becomes visible while it has the keyboard focus.
- [ ] Open the Calls page (/calls) and the hosted call list. Expect: no ticket rows there, so no icon.

### A41. Google sign-up connects Google for calls (21 Nov 2026)  ◐
Needs the same set-up as A40. Use a Google account that has never been used here, and `https://test.liraspaces.com`.
- [ ] On the landing page press **Google** in the sign-up bar. Expect: Google's page lists, besides your name and email, creating Meet links and sending email; agree to all of them.
- [ ] Back in the app open the account menu, **Stand-up calls**, then **Manage calls**. Expect: the page says Google is connected as your address and does not offer **Connect Google**.
- [ ] Schedule a call and leave the link empty. Expect: a `meet.google.com` link and an invitation email to the people invited.
- [ ] Log out, open `/login` and press **Google**. Expect: Google asks only who you are; you are signed in; Calls still shows Google as connected.
- [ ] Sign up with email and password instead. Expect: the Calls page offers **Connect Google**.
- [ ] Sign up with Google but untick the Meet or email permission. Expect: you are signed in, and Calls offers **Connect Google**.

### A40. Sign up and sign in with Google (21 Nov 2026)  ◐
Needs Google set up (docs/03-sop/google-setup.md), both redirect URIs in the Google client, and your Google account listed as a test user while the app is in Testing. Use `https://test.liraspaces.com`.
- [ ] Open `/login` and the landing page. Expect: the Google button, with the Google "G", is on (it says just "Google"). Without Google set up on the server it is greyed out.
- [ ] Press it with a Google account that has never been used here. Expect: Google's account chooser, then the permission page asking only to see your name and email; then the app opens signed in, with an empty workspace. The account menu shows your Google name and email.
- [ ] Log out and press Google again. Expect: the same account, no second workspace.
- [ ] Try to log in with that email and any password. Expect: "The email or password is not correct."
- [ ] Sign up with email and password for an address that you also own at Google, log out, then use Google with it. Expect: you are signed in to that account; the old password no longer works.
- [ ] Press Google and then Cancel at Google's page. Expect: back on the log-in page with "Google sign-in did not work. Try again, or use your email and password."
- [ ] Open `/api/auth/google/callback?code=x&state=y` directly. Expect: the log-in page with the same message, and nobody is signed in.

### A39. Fixes after the first look at the hosted app (21 Nov 2026)  ◐
Hosted app, a brand new account.
- [ ] Open the landing page, then log in, then open the app. Expect: light theme on all of them. Switch to dark on the landing page, log in: the app is dark too. Log out and in again, in another browser: your choice is still there.
- [ ] In the app press the logo at the top left. Expect: the For you page opens; you stay signed in and never land on the public pages.
- [ ] A new account: open Projects, Sprints, Roadmaps, the board and Forms. Expect: nothing is there, no sample projects, no sprints, no roadmap, no forms.
- [ ] Make a project. Expect: no letters badge before its name or in the sidebar; under the name it says "Owner:" with your own name; the project owner field starts with your own name.
- [ ] Landing page in dark mode, the black band. Expect: the blinking cursor is the same gold as the word "anywhere", while the word is typed.
- [ ] Scroll to "Discover the latest", away and back. Expect: the cards fly in quickly from the far right edge, one after another, each overshooting a little to the left before it settles.
- [ ] Open a project, press its call button (Project sync). Expect: a popup with the calls of that project; the call button is one button, with no second button beside it. As Owner the popup has Schedule a project sync, Change and Delete on a call, and a Manage calls button. Schedule one from the popup, change it, delete it.
- [ ] In the popup press Manage calls. Expect: the popup closes and the Calls page with every kind of call, filter buttons (All calls, Stand-ups, Project syncs, Sprint calls, Space calls), and Schedule a call with a choice of what it is for; a call made here shows in that project's popup.
- [ ] As a member invited to a call: press the call button on that project. Expect: a popup with the call and Join, and no Manage calls button and nothing to schedule, change or delete.

### A34. Scroll animations, names and project page (20 Nov 2026)  ◐
- [ ] On the landing page scroll to the black band, away, and back. Expect: each time, only the word "anywhere" is typed out one letter at a time (the words before it are already there) and the cursor blinks. With reduced motion on, it just appears.
- [ ] Scroll the "Discover the latest" boxes into view, away and back. Expect: the cards come in from the far right edge of the screen, fast, the first one first and each next one starting when the one before has arrived, like a train; again every time you scroll to the section. With reduced motion they simply appear.
- [ ] Footer. Expect: "Operated by WorldXAdmins, India"; the legal pages name WorldXAdmins.
- [ ] Open For you. Expect: no "Recent activity" panel.
- [ ] Open a project. Expect: the project initials sit in a small badge right before the project name; under it the lead shows as "Lead:", then the avatar, then the name (the signed-in person's name when no lead is set).
