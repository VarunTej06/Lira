# 06 — Feature Catalog

## Complete Capabilities Matrix

### 1. Spaces & Projects

| Feature | Detail |
|---------|--------|
| Multiple spaces | Unlimited; each is an isolated project |
| Custom key prefix | Auto-generated from space name (e.g., "Certifications" → `CERT`) |
| Auto-increment keys | `CERT-1`, `CERT-2`, … — calculated from DB max |
| Space icon | Emoji picker (12 options) |
| Space colour | 8 preset hex colours |
| Space description | Optional text shown in board header |
| Context menu | Star, Settings, Background, Add people, Template, Archive, Delete |
| Delete cascade | Deleting a space also deletes all its issues recursively |
| Starred spaces | Pinned to top of sidebar (local state, persists in localStorage) |

### 2. Issue Hierarchy

| Level | Type | Contains | Created from |
|-------|------|---------|-------------|
| 1 | Epic ⚡ | Tasks, Bugs | Create Issue modal or "+" in board |
| 2 | Task ✅ | Subtasks (checklist) + child Subtask issues | Inside Epic's "Child work items" section or board |
| 3 | Subtask ↳ | Nothing (leaf) | Inside Task's children or checklist |

### 3. Kanban Board

| Feature | Detail |
|---------|--------|
| 4 columns | Backlog, To Do, In Progress, Done |
| Drag and drop | @hello-pangea/dnd — smooth, accessible, continuous multi-drag |
| Continuous multi-drag | Reactive state synchronization eliminates sensor unmount on second drag |
| Full-height drop targets | Columns dynamically stretch droppable area so dragging works to bottom of any column |
| Edge auto-scrolling | requestAnimationFrame loop smoothly auto-scrolls board when dragging cards near edges |
| Fractional ranking | Cards maintain position with float-based rank |
| Optimistic updates | Card moves visually before DB write confirms |
| Issue count per column | Shown in column header |
| Column accent dots | Colour-coded (amber = In Progress, green = Done) |
| Add issue button | Top-right aligned `+ Add` button next to column counter |
| Smooth board panning | Mouse wheel, Alt+wheel horizontal scroll, and canvas click-and-drag panning |
| Column WIP indicator | Issue count displayed |

### 4. Issue Cards

| Feature | Detail |
|---------|--------|
| Status accent bar | Coloured strip at top (amber = In Progress, green = Done) |
| Issue type badge | Shown if issue has a parent (Epic/Story/Task context) |
| Title | 3-line clamp with hover blue colour |
| Labels | Up to 3 shown inline; overflow as "+N more" |
| Subtask progress | "2/5 tasks" + animated progress bar |
| Due date | Colour-coded: red = overdue, amber = due within 7 days |
| Priority icon | Emoji-based (⏫ Highest, 🔺 High, ▬ Medium, 🔻 Low, ⏬ Lowest) |
| Assignee avatar | Coloured circle with initials |
| Hover actions menu | ⋯ → Open, Set Status (4 options), Delete |
| Drag handle | Entire card is draggable |

### 5. Issue Detail Modal

| Feature | Detail |
|---------|--------|
| Status colour banner | 1.5px strip at top matching status colour |
| Type + key badge | Coloured pill showing type symbol, label, and key |
| Parent breadcrumb | Shows parent issue key; clickable to navigate up |
| Inline title edit | Click title to edit; save on blur or Enter |
| Description textarea | Auto-save on 800ms debounce |
| Quick action bar | + Child issue, Link issue, Attach |
| Attachments | Drag-drop or click to upload; image thumbnails; download button |
| Child work items | Interactive table: Work / Priority / Assignee / Status |
| Create child | Inline title input → creates linked child issue |
| Subtask checklist | Add, toggle, delete; animated progress bar |
| Activity feed | Comments + history; tabs: All / Comments / History |
| Quick comment chips | Status update…, Thanks!, Agree, etc. |
| Ctrl+Enter to save | Comment shortcut |
| Status dropdown | Coloured button at top of right panel |
| Automations button | Lightning bolt icon (UI placeholder) |
| Assignee field | Avatar + name display |
| Due date picker | Native `<input type="date">` |
| Priority picker | SelectDropdown with coloured icons |
| Labels | Multi-tag with inline + Add button and × to remove |
| Time tracking | Progress bar + "Xh logged / Yh est." |
| Start date picker | Native date input |
| Reporter field | Avatar + name |
| Story points | Numeric display |
| Metadata card | Created, Updated, Resolved timestamps |
| Delete issue | Cascade deletes all children; confirmation dialog |
| Share / More menu | Copy link, Open in full page, Delete |
| Close on ESC | Keyboard accessible |
| Close on backdrop click | Click outside modal to close |

### 6. Search & Filter

| Feature | Detail |
|---------|--------|
| Board search | Real-time title text filter |
| Assignee filter toggle | VY button — shows only assigned-to-me issues |
| Labels on cards | Visible as blue chips |

### 7. Backup & Restore

| Feature | Detail |
|---------|--------|
| Dual-Sync Export | Downloads `lira-backup-YYYY-MM-DD.json` AND syncs fresh snapshot to `data/lira-workspace.json` on PC disk |
| Dual-Sync Import | File picker → parse JSON → restore IndexedDB → immediately sync to `data/lira-workspace.json` |
| Data included | All spaces, issues (with subtasks, comments, attachments, activity) |
| Triggered from | Top navigation backup icon |

### 8. Create Issue Modal

| Feature | Detail |
|---------|--------|
| Issue type selector | Button grid: Task, Bug, Epic, Subtask |
| Summary field | Auto-focused; required |
| Description textarea | Optional |
| Status dropdown | Select column |
| Priority dropdown | 5 levels with emoji icons |
| Due date picker | Native date input |
| Labels field | Comma-separated |
| Auto key generation | Computed from space key + max existing number |

### 9. Create Space Modal

| Feature | Detail |
|---------|--------|
| Icon picker | 12 emoji options |
| Colour picker | 8 hex colours |
| Name field | Auto-generates key from initials |
| Key field | Manual override; max 6 uppercase letters |
| Live preview | Shows icon + name + example key |
| Validation | Name and key are required |

### 10. Accessibility & UX

| Feature | Detail |
|---------|--------|
| ESC to close | All modals |
| Backdrop click | Closes modal |
| Keyboard navigation | Tab through form fields |
| Error boundary | Prevents full app crash on component error |
| Auto-scroll | Scrollable modal panels |
| Loading state | Spinner during initialization |
| Responsive typography | Inter font via Google Fonts |
| Custom scrollbars | Thin, styled scrollbars (no browser default) |
| Micro-animations | `animate-fade-in`, `animate-scale-in` on modals |
| Hover transitions | Cards lift on hover (translate-y, shadow) |

### 11. Local PC Disk Storage & Persistence Engine

| Feature | Detail |
|---------|--------|
| File Location | `data/lira-workspace.json` (canonical JSON file on user's machine) |
| Vite Backend Middleware | Custom `localFileDbPlugin` intercepts `/api/data` (GET) and `/api/save` (POST) |
| Automatic Two-Way Sync | Hydrates on startup from disk; debounced save on all mutations |
| Live Status Indicator | Top navigation badge shows `🟢 PC Saved` or `💾 Saving to PC…` |
| Manual Sync Trigger | Click status badge in navbar to force immediate disk flush |
### 12. Lira AI Copilot & Autonomous AI Agent

| Feature | Detail |
|---|---|
| Floating Avatar Trigger | Fixed at `bottom-5 right-5` with gentle floating bob and glowing breath animations (`animate-float-subtle`, `animate-pulse-glow`) |
| Top Navbar Trigger | Secondary `Lira AI` launcher in navbar synced with bottom-right trigger |
| Enhanced Brand Avatar | Scalable SVG (`LiraAIAvatar.tsx`) combining Lira's iconic "L", multidimensional gradients, cyber circuit arc, and AI star constellation |
| Non-Blocking Interface | Detached floating card with curved edges on all 4 sides (`rounded-3xl`), keeping Kanban board columns visible |
| Expand / Maximize Toggle | Switch between compact card (`w-[440px]`) and spacious view (`w-[680px]`) with a single click (`↗` / `Maximize2`) |
| Cross-Space Omnipresence | 100% real-time read and write visibility across all spaces (present and future) |
| Dynamic Entity Resolution | Resolves space names, keys (`AP`, `LIRA`, `IG`, `CERT`, etc.), and partial keywords dynamically without hardcoding |
| Configurable System Instructions | In-drawer Settings view to inspect, customize, or reset the agent's governing prompt (`localStorage`) |
| Hybrid Model Engine | Built-in zero-config local offline engine with optional Google Gemini 1.5 Flash cloud API integration |
| Autonomous Task Breakdown | Domain-specific engineering subtask generator (Docker, Kubernetes, CI/CD, Certifications) |
| Interactive Action Cards | Ticket inspection displays interactive "Open Ticket" button for one-click modal navigation |
| Formatted Table Output | Workspace directories and cross-space roadmaps render as clean, structured Markdown tables |
| Local Disk Persistence | All changes initiated by the agent auto-sync to `data/lira-workspace.json` within 400ms |
