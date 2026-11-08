import { db } from '../../db/db';
import { v4 as uuidv4 } from 'uuid';
import type { Space } from '../../types/space';
import type { ChatMessage } from './types';
import { getAiProvider } from './settings';
import { refineUserPrompt } from './intent';
import { askConfiguredModel } from './provider';
import { buildPreview, WRITE_INTENTS } from './preview';
import { handleSprintPlan, handleSprintSummary, handleStandupDigest, handleRiskRadar } from './handlersSprint';
import { handleStatusTransition, handleSubtaskBreakdown, handleTicketDetail, handleCreateIssue } from './handlersWrite';
import { handleStatusMatrix, handlePriorityBreakdown, handleSpaceQuery, handleEpicsList, handleStatusQuery, handleKeywordSearch } from './handlersRead';
import type { AgentContext, AgentHandler } from './context';

/** In the order they are tried. */
const HANDLERS: AgentHandler[] = [
  handleSprintPlan,
  handleSprintSummary,
  handleStandupDigest,
  handleRiskRadar,
  handleStatusTransition,
  handleSubtaskBreakdown,
  handleTicketDetail,
  handleCreateIssue,
  handleStatusMatrix,
  handlePriorityBreakdown,
  handleSpaceQuery,
  handleEpicsList,
  handleStatusQuery,
  handleKeywordSearch,
];

export async function processUserMessage(
  userPrompt: string,
  activeSpace: Space | undefined,
  allSpaces: Space[],
  mode: 'info' | 'agent' = 'agent',
  options: { confirmWrites?: boolean } = {},
): Promise<ChatMessage> {
  const q = userPrompt.trim().toLowerCase();
  const now = new Date();

  // Load all issues and spaces into context
  const allIssues = await db.issues.toArray();
  const spacesMap = new Map<number, Space>();
  allSpaces.forEach(s => { if (s.id) spacesMap.set(s.id, s); });

  // ─────────────────────────────────────────────────────────────
  // 1. PROMPT REFINEMENT & GOAL REFORMULATION LAYER
  // Formulates an optimized, actionable goal from raw user text
  // ─────────────────────────────────────────────────────────────
  const refinedGoal = refineUserPrompt(userPrompt, allSpaces, allIssues, activeSpace);
  const refinedMetadata = {
    originalInput: userPrompt,
    optimizedGoal: refinedGoal.optimizedGoal,
    intentType: refinedGoal.intent,
    targetSpace: refinedGoal.targetSpace?.name,
    targetTicketKey: refinedGoal.targetTicketKey,
  };

  // Requests that change data or need exact numbers are answered by the built-in engine (a model cannot write to Lira);
  // everything else can go to the configured model (Gemini or an OpenAI-compatible server) in agent mode.
  const ACTIONS = [...WRITE_INTENTS, 'sprint_summary', 'standup_digest', 'risk_radar'];
  if (mode === 'agent' && getAiProvider() !== 'local' && !ACTIONS.includes(refinedGoal.intent)) {
    try {
      const modelResponse = await askConfiguredModel(userPrompt, activeSpace, allSpaces, allIssues, refinedGoal);
      if (modelResponse) return modelResponse;
    } catch (err) {
      console.warn('[Viva AI Agent] The model call failed, falling back to the built-in engine:', err);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. READ-ONLY RESTRICTION FOR AVATAR INFO CHATBOT (mode === 'info')
  // ─────────────────────────────────────────────────────────────
  const isWriteIntent = WRITE_INTENTS.includes(refinedGoal.intent);

  if (mode === 'info' && isWriteIntent) {
    return {
      id: uuidv4(),
      sender: 'assistant',
      text: `**Viva AI (Read-Only Mode)**\n\nI am the lightweight search & information assistant. I have full read access across all spaces to answer questions, search tickets, and generate status reports, but I cannot modify tickets or database records.\n\nTo execute **"${refinedGoal.optimizedGoal}"**, please use the **Lira Autonomous Agent**!`,
      timestamp: now,
      refinedPrompt: refinedMetadata,
      actionTaken: {
        type: 'switch_to_agent',
        details: userPrompt,
      },
      suggestedActions: [
        'Show all spaces with number of tickets in each To do, Backlog, In Progress and Done',
        'What is in progress across all spaces?',
        'Show all Epics across spaces',
        'Workspace overview',
      ],
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 3. AUTONOMOUS TASK EXECUTION BASED ON REFINED GOAL
  // ─────────────────────────────────────────────────────────────

  // 3. AUTONOMOUS TASK EXECUTION BASED ON REFINED GOAL
  // The first handler that recognises the goal answers; the order matters (a status move is checked before a status query).
  const ctx: AgentContext = { userPrompt, q, now, mode, activeSpace, allSpaces, allIssues, spacesMap, refinedGoal, refinedMetadata };
  if (options.confirmWrites && isWriteIntent) {
    const preview = buildPreview(ctx);
    if (preview) return preview;
  }
  for (const handle of HANDLERS) {
    const answer = await handle(ctx);
    if (answer) return answer;
  }

  // K. DEFAULT CONVERSATIONAL RESPONSE WITH SMART CONTEXT
  if (mode === 'info') {
    return {
      id: uuidv4(),
      sender: 'assistant',
      text: `I am **Viva AI (Read-Only Assistant)**.\n\nI have active search & analytics visibility into **all ${allSpaces.length} spaces** and **${allIssues.length} tickets**. You can ask me naturally to fetch information:\n\n- *"Show all spaces with number of tickets in each To do, Backlog, In Progress and Done"*\n- *"What tasks are in Atmos?"*\n- *"Tell me about AP-7"*\n- *"What is in progress across all spaces?"*\n- *"Show all Epics across spaces"*\n- *"Search for docker"*\n\n*(To execute write tasks like creating or moving tickets, use the Viva AI Agent in the top bar!)*`,
      timestamp: now,
      refinedPrompt: refinedMetadata,
      suggestedActions: [
        'Show all spaces with number of tickets in each To do, Backlog, In Progress and Done',
        'What tasks are in Atmos?',
        'What is in progress across all spaces?',
        'Workspace overview',
      ],
    };
  }

  return {
    id: uuidv4(),
    sender: 'assistant',
    text: `I am **Viva AI Autonomous Agent**.\n\nI have full autonomous read and write visibility across **all ${allSpaces.length} spaces** and **${allIssues.length} tickets**. You can command or ask me naturally:\n\n- *"Move AP-10 to in progress"*\n- *"Create task 'Configure Helm' in Atmos"*\n- *"Break down AP-10 into subtasks"*\n- *"Show status breakdown of all spaces"*\n- *"Tell me about AP-7"*`,
    timestamp: now,
    refinedPrompt: refinedMetadata,
    suggestedActions: [
      'Show all spaces with number of tickets in each To do, Backlog, In Progress and Done',
      'What is in progress across all spaces?',
      'Show all Epics across spaces',
      'Show all spaces overview',
    ],
  };
}
