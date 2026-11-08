# 07 — User Guide & How-To

> **Updated November 2026.** This document was written earlier; the last section, "Update (November 2026)", lists what has changed since. The root [README](../README.md), [SETUP](../SETUP.md) and [ROADMAP](../ROADMAP.md) are always the most current.

## Getting Started

### 1. Run the App Locally

```bash
# Navigate to the project folder
cd d:\MLOps_LLMOps\Lira\lira-app

# Install dependencies (only needed once)
npm install

# Start the development server
npm run dev
```

Open your browser and go to **http://localhost:5173**.

The first time you open the app, Lira will:
1. Request **durable storage** from your browser (click Allow if prompted).
2. Seed realistic certification and DevOps learning data.
3. Open the **Certifications** space board automatically.

---

## Step-by-Step Walkthroughs

### How to Create a New Learning Space

A **Space** in Lira is like a project — an isolated workspace for one
topic area (e.g., AWS, Kubernetes, Python).

**Steps:**
1. Click the **+** button in the left sidebar header (next to "Spaces").
   *Or* click the **+ Create** button in the top navigation.
2. The **Create Space** modal opens.
3. Pick an **icon** (emoji) and a **colour** for the space.
4. Type the **Name** — e.g., `Azure Fundamentals`.
5. The **Key** is auto-generated from the name initials (e.g., `AF`).
   You can change it manually (max 6 uppercase letters).
6. Optionally add a **description**.
7. The preview at the bottom shows exactly how the space will look in the sidebar.
8. Click **Create Space**.

You will be taken to the new space's empty Kanban board immediately.

---

### How to Create a Certification Ticket

**Create an Epic for the certification:**
1. Click **+ Create** (top nav) or **+ Add issue** in any column.
2. Select **Epic** as the issue type.
3. Title: `AWS Solutions Architect Associate (SAA-C03)`.
4. Priority: `Highest`.
5. Due date: Your target exam date.
6. Labels: `aws`, `certification`.
7. Click **Create Issue**.

**Create Tasks inside the Epic:**
1. Click the Epic card to open its detail modal.
2. In the **Child work items** section, click **Create child issue** (Task).
3. Title: `Watch KodeKloud video series — Section 1` and press Enter.

**Create Subtasks inside a Task:**
1. Open the Task detail modal.
2. Scroll to **Child work items** or the **Subtasks** checklist.
3. Type the subtask title and press Enter.

---

### How to Break Down a Big Topic Using Subtasks

Subtasks inside the detail modal work as a **quick checklist**.  They are ideal
for tracking micro-steps within a task.

1. Open any Task or Story.
2. Find the **Child work items** section (if this is a Task, you also see a
   Subtasks checklist below it).
3. Click **+ Add subtask** or type in the inline input.
4. Press **Enter** to save.
5. Tick the checkbox when done.
6. The **progress bar** at the top of the section updates in real time.
7. When all subtasks are ticked, the bar turns green.

---

### How to Attach Study Materials

You can attach PDFs, images, cheat sheets, or architecture diagrams directly
to any issue.

1. Open the issue detail modal.
2. Click the **Attachments** section header to expand it.
3. **Drag and drop** any file onto the attachment zone, *or*
   click the zone to open the file picker.
4. The file is stored inside IndexedDB (no internet needed).
5. Images show as thumbnails; other files show as file-type icons.
6. Click the ** Download** button to retrieve the file later.
7. Click **** on a thumbnail to remove an attachment.

> **Tip:** Attach your cheat sheets and last-minute review PDFs here — they
> survive browser restarts and are always exactly where your tickets are.

---

### How to Track Time on Study Sessions

1. Open any issue.
2. In the right panel, find the **Time tracking** row.
   (It appears once `timeEstimate` or `timeLogged` is set.)
3. The progress bar shows how much of your estimate has been logged.
4. To set values, you can edit the issue directly via the DB (future UI planned).

---

### How to Use the Kanban Board

1. Select a **Space** from the left sidebar.
2. The board shows four columns: **Backlog**, **To Do**, **In Progress**, **Done**.
3. **Drag** any card to a different column to update its status.
4. Use the **Search board** input to filter cards by title.
5. Click the **VY** avatar button to toggle "My work" filter — shows only
   tickets assigned to you.
6. Click the **+ Add** button at the top-right of any column heading to create a ticket
   pre-set to that column's status.
7. To scroll across large boards, use your standard mouse wheel, Alt+Wheel (or touchpad horizontal swipe), click-and-drag panning on the canvas, or drag cards near board edges to trigger automatic edge scrolling.

---

### How to Use the Lira AI Copilot & Autonomous Agent

Lira comes with a built-in, omnipresent AI Assistant with cross-space visibility and autonomous execution:

1. **Open the Copilot**:
   - Click the **floating animated AI avatar** at the bottom-right corner (`bottom-5 right-5`), or
   - Click the **Lira AI** button in the top navigation bar.
2. **Interact with the Non-Blocking Dialogue Box**:
   - The dialogue card floats nicely at the bottom-right with rounded corners on all 4 sides (`rounded-3xl`), leaving your Kanban board fully visible in the background.
   - Click the **Maximize button** (the `Maximize2` icon) in the header to expand into a spacious view (`w-[680px]`) for wide cross-space comparison tables.
3. **Cross-Space Commands (Works from Anywhere)**:
   - *"What tasks are in Atmos?"* (queries Atmos space even if you are on Lira board)
   - *"Tell me about AP-7"* or *"What is IG-3?"*
   - *"Move AP-10 to in progress"* (autonomously transitions status across spaces)
   - *"Create task 'Setup AKS' in Atmos with high priority"*
   - *"List all spaces"* or *"Workspace overview"*
4. **Autonomous Subtask Breakdown**:
   - *"Break down AP-10 into subtasks"*
   - The agent analyzes the title and writes domain-specific engineering checklist items directly into the ticket.
5. **Configure System Instructions & Cloud LLM**:
   - Click the ** Settings** icon in the dialogue card header.
   - View and edit the System Instructions governing cross-space directives and response rules.
   - (Optional) Paste a free Google Gemini API key to activate Cloud LLM reasoning with automatic local offline fallback.
6. **Open Tickets from Chat**:
   - Click **Open →** on any action card generated in the chat to immediately view and edit the ticket modal.

---

### How Local PC Disk Persistence Works

Your data is never trapped in ephemeral browser memory.

1. Every workspace mutation automatically persists to:
   ```
   d:\MLOps_LLMOps\Lira\data\lira-workspace.json
   ```
2. The top navigation bar displays a live indicator:
   - ` PC Saved`: All changes are safely written to disk.
   - ` Saving to PC…`: Disk flush currently in progress.
3. You can click the status badge at any time to force an immediate save.

---

### How to Export Your Database & Backups

Your study notes, tickets, and progress are precious. Back them up in seconds:

1. Click the **** (download/backup) icon in the **top navigation bar**.
2. A modal opens with **Export JSON Backup** and **Import JSON Backup**.
3. Click **Export JSON Backup**:
   - Updates `data/lira-workspace.json` on your PC with a fresh snapshot.
   - Simultaneously downloads `lira-backup-YYYY-MM-DD.json` to your browser's Downloads folder.
4. To restore on another computer, click **Import JSON Backup**, pick your backup file, and confirm. All spaces, tickets, subtasks, and comments will be restored and synced to your PC disk.

---

### How to Manage the Issue Hierarchy

| Action | How to do it |
|--------|-------------|
| View an Epic's tasks | Open the Epic → see "Child work items" table |
| Link a task to an epic | Create the Task from inside the Epic's modal or select Epic in Parent dropdown |
| Change a child's status | Click the Status dropdown in the child row |
| Navigate to child | Click the child's title in the table |
| Navigate back to parent | Click the parent key in the breadcrumb |
| Delete an issue + children | Open issue → ⋯ menu → Delete issue → confirm |

---

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Esc` | Close modal |
| `Enter` | Save title edit |
| `Ctrl + Enter` | Submit comment |
| `Tab` | Navigate form fields |

## Update (November 2026)

**Edit a ticket.** Open it, change what you need, then press **Save changes**. The ticket saves and closes. If you close it first (X, outside click or Escape), Lira asks whether to discard your changes.

**Write a description.** The description box is a full editor. Use the toolbar for headings, bold, italic, underline, strikethrough, bullet, numbered and checkbox lists, quotes, code, links, text colour and highlight. Type **@** to mention a person. Use the paperclip, drop files, or paste a picture to add files: pictures appear in the text and every file is added to the ticket's attachments (files up to 2 MB are stored in Lira).

**Pick a date.** Click the date field to open the calendar. **Today** and **Clear** are at the bottom.

**Delete something.** Deleting a space, project, roadmap, sprint or form asks in a Lira dialog with a red button. **Cancel** or Escape keeps it.

**Change the theme.** Account menu, Theme (or Settings, Appearance): choose, then **Save**. Closing without saving leaves the theme as it was.

**Create a sprint with a length and spaces.** Sprints, then **New sprint**. Choose Monthly, Weekly, Bi-weekly or Number of days (1 to 90), the start date (or the month), an optional name and goal, and which spaces work in it ("All spaces" by default). Custom sprints cannot overlap each other.

**Plan a sprint.** Open the sprint, **Planning** tab. Drag tickets from the backlog on the left to the sprint on the right (or use + and -). Type the team capacity in story points; going over shows a warning.

**Filter a sprint.** On the **Sprint** tab, **Filter** by status and by space.

**Close a sprint.** **Complete sprint**, pick where unfinished tickets go, optionally write the retrospective, **Close sprint**. Tick off retrospective actions later on the sprint page.

**Reports.** **Reports** tab: burnup, cumulative flow, scope changes, lead and cycle time. **Markdown** downloads a file; **PDF** opens the print dialog.

**Ask Viva.** Open the chat button. Examples: "Plan next sprint from my backlog", "Summarise this sprint", "Write my standup", "Show the risk radar", "Move LIRA-12 to in progress". Viva shows a preview; press **Confirm**, and **Undo** if you change your mind.

**Open Lira on a tablet or phone.** Start with `npm run dev:lan`. On the computer open **Settings, Other devices**, scan the QR code with the device (same Wi-Fi), once. See SETUP.md section 13.

**Move around.** Every page has its own address, so Refresh and Back work, and you can paste a link to a page or a ticket.
