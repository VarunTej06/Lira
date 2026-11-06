# 🤖 Viva AI Copilot & Autonomous Agent Module (`src/components/ai`)

> React components and client services powering the omnipresent, non-blocking AI Copilot and Autonomous Agent in Lira.

---

## 📁 Module File Structure

```
src/components/ai/
├── LiraAIAvatar.tsx           # Viva AI SVG brand avatar
├── VivaAIChatbot.tsx          # Launcher, chat card (grows out of the launcher), settings, confirm / undo buttons
└── README.md                  # this file
```

The logic lives in `src/services/ai/` (`src/services/aiAgentService.ts` re-exports it):

```
src/services/ai/
├── agent.ts            # processUserMessage: refine the prompt, then the model or the built-in handlers
├── intent.ts           # What is being asked: space, ticket, status, sprint, standup, risk
├── handlersRead.ts     # Searches, status tables, epics, overview
├── handlersWrite.ts    # Move a ticket, add subtasks, create a ticket
├── handlersSprint.ts   # Plan a sprint, summarise one, standup digest, risk radar
├── sprintInsights.ts   # The pure logic behind those four (capacity, risk, idle tickets, digest)
├── preview.ts          # "Please confirm" text for every change
├── confirm.ts, undo.ts # Run a previewed change, remember how to take it back
├── suggest.ts          # Duplicates, labels, priority, epic while creating a ticket
├── provider.ts         # Gemini or an OpenAI-compatible server
├── gemini.ts           # Gemini client and the prompt (ticket text flattened and marked as data)
├── settings.ts         # System instruction, provider, keys, confirm switch
├── subtasks.ts, context.ts, types.ts
```

---

## 🎨 Component Overview

### `LiraAIAvatar.tsx`
Renders the Viva AI avatar as a scalable SVG. Props: `size` (default 48), `className`, `hasSparkles` (default true). Gradient and filter ids come from `useId()` so several avatars never collide.

### `VivaAIChatbot.tsx`
The floating launcher and the chat card.

* **Props**: `isOpen`, `onClose`, `onToggle`, `activeSpace`, `spaces`, `onSelectIssue`, `initialPrompt`, `onClearInitialPrompt`.
* **Open and close** use Framer Motion (`AnimatePresence`): the card grows out of the round launcher and shrinks back into it. Messages slide in from their own side and the suggestion chips pop in one after another.
* **Confirm and Undo**: when a prompt would change tickets, Viva replies with a preview and **Confirm / Cancel** buttons (`msg.pending`). After a confirmed change the reply carries an **Undo** button (`msg.undo`). Undo works until the page is reloaded.
* **Settings tab**: system instruction, "confirm before changing anything", model choice (built-in, Gemini, OpenAI-compatible with base URL, model and key).

---

## 🧠 What it can do

| You say | What happens |
|---|---|
| "Move AP-10 to in progress", "Create a bug login crashes in Certifications", "Break down AP-10 into subtasks" | Preview, Confirm, change, Undo |
| "Plan next sprint from my backlog" | Picks backlog tickets by priority within the sprint's capacity, only from spaces that work in that sprint. Preview, Confirm, Undo |
| "Summarise this sprint" / "next sprint" | Counts, time passed, status (on pace, watch, at risk), high-priority work still open |
| "Write my standup" | Done and started since the last working day, what is in progress, blockers |
| "Show the risk radar", "which tickets are idle" | Sprints behind their time, over-committed sprints, tickets idle 5 days or more, overdue tickets |
| "Show all spaces with number of tickets in each status", "What is in progress?", "Search for docker" | Tables and lists across every space (read-only) |

Anything else goes to the configured model when there is one; otherwise to the built-in answers.

---

## 💫 Animations

The launcher's floating and glowing are CSS (below). The chat card opening and closing, the messages and the suggestion chips use Framer Motion (see `src/components/common/motion.tsx`).

Declared in [`src/index.css`](../../index.css):

```css
@keyframes float-subtle {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-4px); }
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 15px rgba(124, 58, 237, 0.4), 0 0 25px rgba(79, 70, 229, 0.2);
  }
  50% {
    box-shadow: 0 0 22px rgba(124, 58, 237, 0.65), 0 0 35px rgba(99, 102, 241, 0.35);
  }
}

.animate-float-subtle {
  animation: float-subtle 3.2s ease-in-out infinite;
}

.animate-pulse-glow {
  animation: pulse-glow 2.8s ease-in-out infinite;
}
```

---

## ⚙️ Settings keys

All are mirrored to `data/settings.json`, except the API keys, which go to `data/private/secrets.json` (git-ignored). They are never sent to tablets or phones.

| Key | Description |
|---|---|
| `lira_ai_system_instruction` | System instruction for the agent. Defaults to `DEFAULT_SYSTEM_INSTRUCTION`. |
| `lira_ai_provider` | `local`, `gemini` or `openai`. If unset: Gemini when a key exists, otherwise local. |
| `lira_gemini_api_key` | Google Gemini key (secret). |
| `lira_ai_base_url`, `lira_ai_model`, `lira_ai_api_key` | OpenAI-compatible server (for example `http://localhost:11434/v1`, `llama3.1`). The key is a secret. |
| `lira_ai_confirm_writes` | `0` turns the confirmation off. On by default. |

---

## 🧪 Tests

Behaviour tests run in Vitest with an in-memory IndexedDB: `src/services/aiAgent.test.ts`, `aiIntent.test.ts`, `aiPhase6.test.ts` (preview, confirm, undo, sprint prompts, standup, risk, suggestions, provider) and `aiSecurity.test.ts` (prompt injection, key in a header).

```bash
npm test
```
