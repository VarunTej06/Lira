# Manual test checklist (after the code-quality and component refactor)

Use this once after the 9 Nov 2026 refactor, and again before any release until browser tests (Playwright) exist.
No behaviour was meant to change anywhere. **If anything looks or acts different from before, that is a bug: note the screen, the steps and what you saw.**

How to run it
- Use a **copy** of your workspace if you can (`LIRA_DATA_DIR`), or accept that testing edits `data/`.
- Start with `npm run dev` in `lira-app/`. Test in **all three themes** (Dark, and the light palettes Sorrel and Fawn: Settings, Appearance) for sections marked ◐.
- Open the browser console once (F12): there should be **no red errors** while you work through the list.
- Tick each box. "Expect" says what you should see.

---

## A. The screens that were reworked (A1–A22)

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

### A21. Themes and light palettes (13 Nov 2026)  ◐
Reference screens: `docs/04-quality/ui-references/`.
- [ ] Settings, Appearance. Expect: a Dark and a Light card, each showing its three colours; Dark is selected in a new workspace; there is no accent colour picker.
- [ ] Choose **Light**. Expect: "Choose a light palette" appears with **Sorrel** (selected) and **Fawn**; the page behind does not change; "Not saved yet" shows.
- [ ] Pick **Fawn**, **Save**. Expect: cream page, brown navigation and text, baby blue buttons with brown labels; the dialog closes.
- [ ] Reopen, pick **Sorrel**, **Save**. Expect: off-white page, sage frame and navigation, tomato red buttons with white labels.
- [ ] Choose **Dark**, **Save**. Expect: black page, silver text, yellow buttons with black labels.
- [ ] Choose another theme or palette, then **Cancel**. Expect: nothing changes; reopening shows the saved choice.
- [ ] Gear menu, System settings. Expect: choosing Light shows Sorrel and Fawn; Save applies the choice.
- [ ] Reload the page, and open Lira in a browser that has never opened it (dev server running). Expect: the saved theme and palette are shown from the first moment.
- [ ] In each theme walk the board, list, calendar, summary, sprints, roadmaps, dashboards, filters, projects, For you, a ticket popup and the Viva chat. Expect: no white label on a yellow or baby blue button, no leftover navy bars or purple gradients, every text readable.

### A22. Space icons, app switcher and sidebar speed (13 Nov 2026)  ◐
- [ ] Sidebar, board header, summary, filters, calendar, projects, For you. Expect: every space shows a line icon like the navigation icons; no emoji anywhere.
- [ ] A space created before this change. Expect: it shows the icon that matches its old emoji (clipboard, trophy, book ...), or a folder.
- [ ] Create space (sidebar +) and Create project with a new space. Expect: a grid of 24 line icons, the chosen one highlighted and shown in the preview; the new space appears with that icon.
- [ ] Edit a space, change only its name, save. Expect: its icon is unchanged.
- [ ] Space dropdowns (create ticket, sprint filter, all tickets) and Viva's answers. Expect: the space name without an emoji in front.
- [ ] App switcher (nine dots, top left). Expect: a panel headed Lira with a v3.4 badge and five tiles; each opens what it names; Escape and a click outside close it.
- [ ] Start-up screen and Settings, Plan. Expect: both say v3.4.
- [ ] Hover the nine dots, then move away. Expect: the panel opens, then closes. Hover again and click the dots. Expect: it closes.
- [ ] Logo (top bar, start-up screen, browser tab). Expect: a block L with an arrow; the arrow grows out of the corner on load and when the logo is hovered, and keeps growing while Lira starts. With "reduce motion" on in the system it stands still.
- [ ] Avatars (top right, board cards, ticket popup, filters, capacity). Expect: all in the button colour of the theme, with a readable label.
- [ ] Collapse and expand the sidebar several times on a full board. Expect: it slides quickly, without stutter, and the rows do not jump or re-wrap while it moves.

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
- [ ] All three themes: nothing unreadable. Button labels are black on yellow (Dark), white on tomato red (Sorrel), brown on baby blue (Fawn).

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
