# 🤖 Viva AI Copilot & Autonomous Agent Module (`src/components/ai`)

> React components and client services powering the omnipresent, non-blocking AI Copilot and Autonomous Agent in Lira.

---

## 📁 Module File Structure

```
src/components/ai/
├── LiraAIAvatar.tsx           # Enhanced Viva AI SVG brand avatar component
├── LiraAICopilot.tsx          # Floating dialogue card, animated bottom-right trigger & settings
└── README.md                  # Component documentation (this file)
```

Companion service:
```
src/services/
└── aiAgentService.ts          # NLU parser, intent execution pipeline, Gemini API client
```

---

## 🎨 Component Overview

### 1. `LiraAIAvatar.tsx`
Renders the official enhanced Viva AI Avatar as a scalable SVG.

* **Props**:
  ```typescript
  interface LiraAIAvatarProps {
    size?: number;            // Default: 48 (renders size x size px)
    className?: string;       // Custom CSS classes
    hasSparkles?: boolean;    // Default: true (renders AI constellation stars)
  }
  ```
* **Features**:
  * Scoped gradient and filter IDs generated via React `useId()` to prevent SVG DOM collision.
  * Multi-stop gradient background (`#4F46E5` → `#7C3AED` → `#0052CC` → `#0284C7`).
  * Authentic Atlassian-grade bold "L" glyph with SVG drop-shadow.
  * Cyber energetic circuit arc and 4-point golden/cyan AI sparkle star.

### 2. `LiraAICopilot.tsx`
Renders both the **floating bottom-right avatar trigger button** and the **curved floating dialogue card**.

* **Props**:
  ```typescript
  interface LiraAICopilotProps {
    isOpen: boolean;                         // Controls dialogue card visibility
    onClose: () => void;                     // Callback to dismiss the dialogue card
    onToggle?: () => void;                   // Optional toggle callback
    activeSpace: Space | undefined;          // Current active space context
    spaces: Space[];                         // List of all spaces in workspace
    onSelectIssue?: (issue: Issue) => void;  // Callback when user clicks "Open" on an issue action card
  }
  ```
* **Key States**:
  * `isExpanded`: Toggles between **compact mode** (`w-[440px] h-[590px]`) and **expanded mode** (`w-[680px] h-[calc(100vh-6.5rem)]`).
  * `showSettings`: Switches the card view between the live chat feed and the System Instructions / Gemini API configuration editor.
  * `messages`: Message thread containing conversational text, structured markdown tables, action cards, and suggested quick action pills.

---

## 💫 CSS Animations & Micro-Interactions

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

## ⚙️ LocalStorage Configuration Keys

| Key | Type | Description |
|---|---|---|
| `lira_ai_system_instruction` | `string` | Custom system instruction prompt governing the agent's behavior. If unset, defaults to `DEFAULT_SYSTEM_INSTRUCTION`. |
| `lira_gemini_api_key` | `string` | Optional Google Gemini API key. If empty, the agent uses the local offline engine. |

---

## 🧪 Testing Intent Execution Locally

Standalone test scripts reside in the `scratch/` directory:
* `test_future_spaces.cjs`: Verifies dynamic resolution of future space keys, names, and ticket identifiers.
* `test_nlp_intents.cjs`: Validates status transitions, subtask breakdown, issue creation, and table formatting.

Run via Node:
```bash
node test_future_spaces.cjs
```
