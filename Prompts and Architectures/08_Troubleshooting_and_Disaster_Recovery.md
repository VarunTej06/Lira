# 08 — Troubleshooting & Disaster Recovery

> **Updated November 2026.** This document was written earlier; the last section, "Update (November 2026)", lists what has changed since. The root [README](../README.md), [SETUP](../SETUP.md) and [ROADMAP](../ROADMAP.md) are always the most current.

## Common Scenarios & Fixes

---

### 1. Browser Closed Mid-Edit

**Scenario:** You were writing a long description and the browser crashed or you
accidentally closed the tab.

**What happens:**
- The title saves on **blur/Enter** — if you were typing the title and it
  crashed before you clicked away, the change is lost.
- The description **auto-saves every 800ms** of silence.  If it crashed while
  you were actively typing (within the 800ms window), you may lose the last
  few characters.
- All confirmed changes are committed to IndexedDB — they survive crashes.

**Prevention:**
- After a long typing session, click outside the description box once to
  force an immediate save.
- Watch for the "Auto-saving…" indicator to disappear — this confirms the save.

---

### 2. The App Shows a Blank White Page

**Cause:** A JavaScript error in a component caused React to unmount without
an error boundary catching it.

**Fix (step by step):**
1. Open the browser **Developer Console** (F12 → Console tab).
2. Look for a red error message — note the component name and line number.
3. **Hard-refresh** the page: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac).
4. If the page loads normally → the error was transient (e.g., a race condition
   during seed data insertion).  No action needed.
5. If the blank page persists → there is a schema or data corruption issue.
   Follow the **data recovery** steps below.

**Emergency Reset (last resort — clears all data):**
```javascript
// Paste this in the browser console (F12):
indexedDB.deleteDatabase('LiraDB');
location.reload();
```
This resets to seed data.  Restore from your JSON backup afterwards.

---

### 3. IndexedDB Data Not Appearing After Browser Update

**Cause:** Some browsers clear site data during major updates (especially
Firefox, Brave, or Chrome in specific configurations).

**Check durable storage status:**
```javascript
// In the browser console:
navigator.storage.persisted().then(console.log);
// true = protected, false = may be cleared
```

**Fix:**
- If `false`, Lira will request `persist()` on next load.
- If data was already cleared, restore from your JSON backup.
- After restoring, verify `persist()` returns `true`.

---

### 4. Clearing Cache Safely (Without Losing IndexedDB)

> ⚠️ **Important:** "Clear site data" in browser settings usually wipes
> IndexedDB.  Use the targeted approach below instead.

**Safe cache clearing (clears CSS/JS cache only):**
1. Open DevTools (F12) → **Application** tab → **Storage** section.
2. Under **Cache Storage**, right-click entries and select "Delete".
3. Under **Application Cache**, select "Delete".
4. Do **NOT** touch the **IndexedDB** section.
5. Hard-refresh: `Ctrl+Shift+R`.

**Alternatively** — use the Lira JSON export to back up first, then clear
everything safely:
1. Export backup from the Lira top nav.
2. Clear all site data normally in browser settings.
3. Reload Lira (`npm run dev`).
4. Import the backup.

---

### 5. Dexie Schema Version Conflict

**Symptom:** Console shows:
```
Uncaught VersionError: The requested version (2) is less than the existing version (3)
```

**Cause:** You downgraded the app code to an older version that has a lower
schema version number than what is stored in your browser.

**Fix Option A (upgrade the code):**
Pull the latest code and restart `npm run dev`.  The higher schema version will
be used.

**Fix Option B (reset the database):**
```javascript
indexedDB.deleteDatabase('LiraDB');
location.reload();
```
Then import your JSON backup.

---

### 6. Attachment Images Not Displaying

**Symptom:** Attachment thumbnails show a broken image icon.

**Cause:** Base64 data URL is corrupt or truncated.

**Fix:**
1. Open the issue detail modal.
2. Click ✕ on the broken attachment to remove it.
3. Re-upload the file.

If attachments are consistently failing for large files (>5 MB), note that
IndexedDB can store large blobs, but the browser may throttle writes.  Split
large attachments into smaller files.

---

### 7. Drag-and-Drop Not Working

**Symptom:** Dragging cards has no effect.

**Cause:** `@hello-pangea/dnd` requires a `DragDropContext` parent.  This
error usually occurs if the board component failed to mount.

**Fix:**
1. Check the browser console for errors.
2. Hard-refresh: `Ctrl+Shift+R`.
3. If the error mentions `react-dom`, ensure `react-dom@18` is installed:
   ```bash
   npm install react@18 react-dom@18 --save-exact --legacy-peer-deps
   ```

---

### 8. Step-by-Step Disaster Recovery (Full Data Loss)

**When to use:** Your IndexedDB was wiped (OS reinstall, browser data clear).

**Prerequisites:** A JSON backup file (`lira-backup-YYYY-MM-DD.json`).

**Steps:**

1. **Start the app:**
   ```bash
   cd d:\MLOps_LLMOps\Lira\lira-app
   npm run dev
   ```

2. **Open http://localhost:5173** — you will see the seed data (default
   certification tickets) because all user data is gone.

3. **Click the backup icon** (⬇) in the top navigation bar.

4. **Click "Import Backup"** and select your JSON file.

5. **Confirm** the import.  This will:
   - Clear all seed data.
   - Insert all your backed-up spaces and issues.
   - Restore all subtasks, comments, attachments, and activity history.

6. **Verify** by checking that your spaces appear in the sidebar and your
   tickets are visible on the board.

7. **Request durable storage** (if not automatic):
   ```javascript
   navigator.storage.persist();
   ```

---

### 9. Performance Degradation with Many Issues

**Symptom:** The board feels slow when scrolling or filtering with hundreds
of issues.

**Cause:** All issues are fetched into memory by `useLiveQuery` and filtered
client-side.

**Mitigation options:**
- Use the **search filter** to reduce visible cards.
- Archive completed spaces (future feature — sets `archived: true`).
- Split large spaces into smaller focused spaces.

**Future fix:** Implement virtual scrolling (`react-virtual`) for board columns
with >50 cards.

---

### 10. "Failed to render this issue" Error in Modal

**Symptom:** Clicking a card shows the error fallback instead of the detail modal.

**Cause:** The `ErrorBoundary` caught an unhandled exception in the modal
(usually `Cannot read properties of undefined` when a field like `labels` or
`subtasks` is missing from old data).

**Fix:**
1. Open the browser console (F12) and read the exact error.
2. The fix is usually adding a default value for the missing field:
   ```javascript
   // In console — patch the issue:
   const db = window.__liraDb; // not available by default
   ```
3. **Export your backup** (top nav → ⬇).
4. Open the JSON file and find the problematic issue.
5. Add the missing field: `"labels": []`, `"subtasks": []`, etc.
6. **Import the patched backup**.

---

### 11. AI Copilot Not Responding or Behaving Unexpectedly

**Scenario A: Custom System Instructions produce unwanted formatting or behavior.**
* **Fix**: Open the AI Copilot dialogue card → click ⚙️ **Settings** → click **"Reset default"** above the system prompt textarea → click **"Save AI Configuration"**. This instantly restores the canonical factory directives.
* **Console Command (Manual Reset)**:
  ```javascript
  localStorage.removeItem('lira_ai_system_instruction');
  location.reload();
  ```

**Scenario B: Gemini API Key errors, rate limits, or network timeouts.**
* **What happens**: The agent detects cloud API failure and automatically and silently falls back to the **Local Offline Engine**, ensuring zero downtime or user disruption.
* **Fix**: Open Settings tab → verify API key format (`AIzaSy...`) or delete the key to run strictly offline.
* **Console Command (Clear Key)**:
  ```javascript
  localStorage.removeItem('lira_gemini_api_key');
  ```

---

## Quick Reference Card

| Problem | First Action |
|---------|-------------|
| Blank white page | F12 → Console → read error → Ctrl+Shift+R |
| Data disappeared | Check backup → Import backup |
| Drag not working | Ctrl+Shift+R → check Console |
| Schema error | Delete LiraDB in console → import backup |
| Images not showing | Remove & re-upload attachment |
| App very slow | Use search filter to narrow cards |
| Modal crash | Export → patch JSON → import |

---

## Emergency Console Commands

```javascript
// Check if IndexedDB is durable
navigator.storage.persisted().then(p => console.log('Durable:', p));

// Check how much storage is used
navigator.storage.estimate().then(e =>
  console.log(`Used: ${(e.usage / 1e6).toFixed(1)} MB of ${(e.quota / 1e9).toFixed(1)} GB`)
);

// Count issues in DB
const req = indexedDB.open('LiraDB', 2);
req.onsuccess = e => {
  const db = e.target.result;
  const tx = db.transaction('issues', 'readonly');
  tx.objectStore('issues').count().onsuccess = r => console.log('Issues:', r.target.result);
};

// Hard-reset (DELETES ALL DATA)
indexedDB.deleteDatabase('LiraDB');
location.reload();
```

## Update (November 2026)

| Problem | Fix |
|---|---|
| Data looks lost after clearing the browser | It is not: everything is in `data/`. Reload; Lira reads the files back. Check you started `npm run dev` from `lira-app/`. |
| A page shows "This page hit a problem" | Only that page failed. Press **Try again** or go elsewhere from the sidebar. The details are in the browser console. |
| Tablet or phone shows "Lira needs its private link" | Open the link from **Settings, Other devices** once on that device. |
| Tablet or phone cannot connect | Start with `npm run dev:lan`; set Windows Wi-Fi to **Private** or allow Node.js through the firewall; check the computer's address has not changed. |
| "Request refused" in the console | Lira was opened by a name it does not allow. Use `localhost`, or `dev:lan` and the computer's network address. |
| Undo says it can no longer undo | Undo lasts until the page is reloaded (and the last 20 changes). Restore from a backup or git if you need older data. |
| Two devices overwrote each other | Saving is not live: the last save wins. Refresh a device to see what another saved; restore a file from git (`git checkout -- data/spaces/KEY.json`) if needed. |
| Sprint numbers or burndown look off for old tickets | Tickets changed before the status log existed use the resolved date only. New changes are exact. |
| After pulling changes the app fails to start | Run `npm install` (new packages), and restart `npm run dev`. |

To cancel access for every tablet or phone, delete `data/private/lan-token` and restart.
