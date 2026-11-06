import { db } from '../db/db';
import type { Issue, Priority, IssueType } from '../types/issue';
import type { Space } from '../types/space';
import { createIssue, updateIssue, getNextIssueKey } from '../hooks/useIssues';
import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  actionTaken?: {
    type: 'created_issue' | 'updated_status' | 'added_subtasks' | 'summary' | 'switch_to_agent';
    issue?: Issue;
    details?: string;
  };
  suggestedActions?: string[];
  refinedPrompt?: {
    originalInput: string;
    optimizedGoal: string;
    intentType: string;
    targetSpace?: string;
    targetTicketKey?: string;
  };
}

export interface RefinedPromptGoal {
  originalInput: string;
  intent:
    | 'matrix'
    | 'status_transition'
    | 'subtask_breakdown'
    | 'create_issue'
    | 'ticket_detail'
    | 'space_query'
    | 'status_query'
    | 'epics_list'
    | 'priority_breakdown'
    | 'search'
    | 'overview';
  optimizedGoal: string;
  targetSpace?: Space;
  targetTicket?: Issue;
  targetTicketKey?: string;
  targetStatus?: string;
  newIssueType?: string;
  newIssueTitle?: string;
  searchKeyword?: string;
}

export const DEFAULT_SYSTEM_INSTRUCTION = `You are the Viva AI Autonomous Agent & Chief Agile Copilot, an intelligent project manager and engineering assistant embedded directly inside LIRA.

### Core Directives:
1. Cross-Space Omnipresence & Future Scalability:
   - You have 100% full real-time read and write visibility across ALL spaces in the workspace, including any new spaces or tickets created in the future.
   - You dynamically query the live database on every interaction. Even if the user is currently viewing one space, you MUST answer queries, fetch details, search, and manage tickets across ANY or ALL spaces.
2. Natural Language Understanding:
   - Understand conversational requests, synonyms, partial titles, keywords, ticket keys across all spaces (e.g., matching any standard key pattern such as AP-7, LIRA-10, IG-3, or any future key), and ambiguous prompts naturally without requiring strict syntax.
3. Hierarchy & Rules:
   - The hierarchy is: Epic (⚡) ➔ Task (✅) / Bug (🐛) ➔ Subtask (↳).
   - Story has been removed. Epics contain Tasks and Bugs. Tasks contain Subtasks.
4. Action Capabilities:
   - Status transitions (Move/Set tickets to Backlog, To Do, In Progress, Done).
   - Issue creation (Task, Bug, Epic) in the current space or any specified existing or future space.
   - Intelligent domain-specific subtask generation for engineering tasks.
   - Cross-space searches, roadmap analysis, and sprint summaries.
5. Response Style:
   - Always format responses using clean Markdown tables, bold ticket keys, bullet points, and actionable next steps.`;

export function getSystemInstruction(): string {
  return localStorage.getItem('lira_ai_system_instruction') || DEFAULT_SYSTEM_INSTRUCTION;
}

export function setSystemInstruction(val: string): void {
  localStorage.setItem('lira_ai_system_instruction', val);
}

export function getGeminiApiKey(): string {
  return localStorage.getItem('lira_gemini_api_key') || '';
}

export function setGeminiApiKey(key: string): void {
  localStorage.setItem('lira_gemini_api_key', key);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolves a space from user text dynamically (by name, key, significant words, or common aliases).
 * Works automatically for all existing and any future spaces created in Lira.
 */
export function findTargetSpace(text: string, allSpaces: Space[]): Space | undefined {
  const t = text.toLowerCase();

  // 1. Exact match on space key with word boundaries (e.g. "in AP", "AP tasks", "tickets for FIN")
  for (const s of allSpaces) {
    const keyLower = s.key.toLowerCase();
    const keyRegex = new RegExp(`(^|[^a-z0-9])${escapeRegex(keyLower)}([^a-z0-9]|$)`, 'i');
    if (keyRegex.test(t)) {
      return s;
    }
  }

  // 2. Exact match on full space name (e.g. "Atmos - Weather App", "Interview Guide", "Cloud Infrastructure")
  for (const s of allSpaces) {
    const nameLower = s.name.toLowerCase();
    if (t.includes(nameLower)) {
      return s;
    }
  }

  // 3. Significant word token matching for any multi-word space name (present or future):
  const stopWords = new Set([
    'app', 'space', 'project', 'projects', 'hub', 'board', 'team',
    'the', 'and', 'for', 'with', 'task', 'tasks', 'ticket', 'tickets',
    'issue', 'issues', 'item', 'items', 'all', 'show', 'list', 'what', 'give'
  ]);
  for (const s of allSpaces) {
    const words = s.name.toLowerCase().split(/[\s\-_/]+/).filter(w => w.length >= 3 && !stopWords.has(w));
    for (const w of words) {
      const wordRegex = new RegExp(`(^|[^a-z0-9])${escapeRegex(w)}([^a-z0-9]|$)`, 'i');
      if (wordRegex.test(t)) {
        return s;
      }
    }
  }

  // 4. Common shorthand aliases for existing spaces
  for (const s of allSpaces) {
    const keyLower = s.key.toLowerCase();
    if (keyLower === 'ap' && (t.includes('atmos') || t.includes('weather'))) return s;
    if (keyLower === 'ig' && (t.includes('interview') || t.includes('guide'))) return s;
    if (keyLower === 'ai' && (t.includes('ai project') || t.includes('ai-project') || t.includes('machine learning') || t.includes('ai space'))) return s;
    if (keyLower === 'cert' && (t.includes('certification') || t.includes('certs') || t.includes('cert '))) return s;
    if (keyLower === 'crs' && (t.includes('course') || t.includes('courses') || t.includes('class'))) return s;
    if (keyLower === 'cre' && (t.includes('creator') || t.includes('hub'))) return s;
    if (keyLower === 'gen' && (t.includes('general') || t.includes('general tasks'))) return s;
    if (keyLower === 'lira' && t.includes('lira')) return s;
  }

  return undefined;
}

/**
 * Prompt Refinement & Goal Reformulation Engine:
 * Analyzes raw user input, normalizes ticket keys, resolves target spaces,
 * detects the underlying engineering/project intent, and creates an optimized,
 * explicit goal statement to govern autonomous execution.
 */
export function refineUserPrompt(
  rawInput: string,
  allSpaces: Space[],
  allIssues: Issue[],
  activeSpace?: Space
): RefinedPromptGoal {
  const raw = rawInput.trim();
  const q = raw.toLowerCase();

  // 1. Normalize ticket key patterns: "AP-10", "ap10", "ap 10", "LIRA 2", "lira-2"
  let targetTicket: Issue | undefined = undefined;
  let targetTicketKey: string | undefined = undefined;

  const keyPattern = /\b([a-z]{2,10})[- ]?(\d+)\b/i;
  const match = q.match(keyPattern);
  if (match) {
    const prefix = match[1].toUpperCase();
    const num = match[2];
    const candidateKey = `${prefix}-${num}`;
    const found = allIssues.find(i => i.key.toUpperCase() === candidateKey);
    if (found) {
      targetTicket = found;
      targetTicketKey = found.key;
    } else if (allSpaces.some(s => s.key.toUpperCase() === prefix)) {
      targetTicketKey = candidateKey;
    }
  }

  // 2. Resolve target space
  let targetSpace = findTargetSpace(q, allSpaces);
  if (!targetSpace && targetTicket) {
    targetSpace = allSpaces.find(s => s.id === targetTicket!.spaceId);
  }
  if (!targetSpace) {
    targetSpace = activeSpace;
  }

  // 3. Status Transition Intent Check (Evaluate before Matrix check to avoid "to done" matching "to do")
  if (targetTicketKey && (
    q.includes('move') || q.includes('mark') || q.includes('set') || q.includes('change') ||
    q.includes('put') || q.includes('promote') || q.includes('complete') || q.includes('transition') ||
    q.includes('done') || q.includes('in progress') || q.includes('inprogress') ||
    /\b(to do|todo)\b/i.test(q) || /\b(backlog)\b/i.test(q)
  )) {
    let targetStatus: string | undefined = undefined;
    if (q.includes('done') || q.includes('complete') || q.includes('finish') || q.includes('resolve')) targetStatus = 'done';
    else if (q.includes('in progress') || q.includes('inprogress') || q.includes('ongoing') || q.includes('working')) targetStatus = 'inprogress';
    else if (/\b(to do|todo)\b/i.test(q)) targetStatus = 'todo';
    else if (/\b(backlog)\b/i.test(q)) targetStatus = 'backlog';

    if (targetStatus) {
      return {
        originalInput: raw,
        intent: 'status_transition',
        targetTicket,
        targetTicketKey,
        targetStatus,
        targetSpace,
        optimizedGoal: `Transition ticket ${targetTicketKey}${targetTicket ? ` ("${targetTicket.title}")` : ''} in ${targetSpace ? targetSpace.name : 'Workspace'} to ${targetStatus.toUpperCase()}`
      };
    }
  }

  // 4. Priority Breakdown (Check before breakdown to avoid matching 'priority breakdown')
  if (q.includes('priority breakdown') || q.includes('by priority') || q.includes('per priority')) {
    return {
      originalInput: raw,
      intent: 'priority_breakdown',
      optimizedGoal: `Calculate priority distribution (Highest, High, Medium, Low) across all ${allSpaces.length} workspace spaces`
    };
  }

  // 5. Subtask Breakdown Intent Check
  const isSubtaskBreakdown =
    q.includes('generate subtasks') ||
    q.includes('add subtasks') ||
    q.includes('break down') ||
    (targetTicketKey && (q.includes('subtask') || q.includes('subtasks') || q.includes('breakdown') || q.includes('split'))) ||
    (!q.includes('priority') && !q.includes('status') && q.includes('breakdown'));

  if (isSubtaskBreakdown) {
    return {
      originalInput: raw,
      intent: 'subtask_breakdown',
      targetTicket,
      targetTicketKey,
      targetSpace,
      optimizedGoal: `Generate technical domain-specific checklist subtasks for ${targetTicketKey || 'ticket'}${targetTicket ? ` ("${targetTicket.title}")` : ''} in ${targetSpace ? targetSpace.name : 'Workspace'}`
    };
  }

  // 6. Status Matrix Intent Check (Strict word boundary for 'to do' so 'to done' is never mistaken)
  const wantsStatusMatrix =
    (/\b(to do|todo)\b/i.test(q) && (q.includes('backlog') || q.includes('in progress') || q.includes('inprogress') || q.includes('done'))) ||
    q.includes('status breakdown') ||
    q.includes('columns breakdown') ||
    q.includes('number of tickets in each') ||
    q.includes('tickets in each') ||
    q.includes('by status') ||
    q.includes('per status') ||
    q.includes('status of all spaces') ||
    (q.includes('all space') && q.includes('status')) ||
    q.includes('matrix');

  if (wantsStatusMatrix) {
    return {
      originalInput: raw,
      intent: 'matrix',
      optimizedGoal: `Generate 4-column status breakdown matrix (Backlog, To Do, In Progress, Done) across all ${allSpaces.length} spaces with workspace totals`,
      targetSpace: undefined
    };
  }

  // 7. Create Issue Intent Check
  const createMatch = q.match(/(?:create|add|new)\s+(?:an?\s+)?(task|bug|epic)?\s*(?:called|named|titled|for|:)?\s*["']?([^"'\n]+)["']?/i);
  if (createMatch && (q.includes('create') || q.includes('add task') || q.includes('new task') || q.includes('add bug') || q.includes('new bug') || q.includes('add epic'))) {
    const rawType = (createMatch[1] || 'task').toLowerCase();
    let title = createMatch[2]?.trim() || '';
    if (targetSpace) {
      title = title.replace(new RegExp(`\\s+(?:in|for|inside|under)\\s+(?:the\\s+)?(?:${escapeRegex(targetSpace.name)}|${escapeRegex(targetSpace.key)}).*$`, 'i'), '');
      const words = targetSpace.name.split(/[\s\-_/]+/).filter(w => w.length >= 3);
      for (const w of words) {
        title = title.replace(new RegExp(`\\s+(?:in|for|inside|under)\\s+(?:the\\s+)?${escapeRegex(w)}.*$`, 'i'), '');
      }
    }
    title = title.replace(/\s+(?:in|for|inside|under)\s+(?:the\s+)?[a-z0-9\s-]+$/i, '');
    title = title.replace(/^(a|an|the)\s+/i, '').replace(/\s+(with|in|at)\s+(high|highest|medium|low|todo|inprogress|backlog).*$/i, '').trim();

    return {
      originalInput: raw,
      intent: 'create_issue',
      newIssueType: rawType,
      newIssueTitle: title,
      targetSpace,
      optimizedGoal: `Create new ${rawType.toUpperCase()} "${title}" in space "${targetSpace ? targetSpace.name : 'Workspace'}" with standard checklist`
    };
  }

  // 8. Ticket Detail Inspection
  if (targetTicket) {
    return {
      originalInput: raw,
      intent: 'ticket_detail',
      targetTicket,
      targetTicketKey: targetTicket.key,
      targetSpace,
      optimizedGoal: `Inspect and retrieve comprehensive issue details, assignee, parent epic, and subtasks for ${targetTicket.key}`
    };
  }

  // 9. Explicit Space Query Check
  const explicitlyMentionedSpace = findTargetSpace(q, allSpaces);
  if (explicitlyMentionedSpace) {
    let statusFilter: string | undefined = undefined;
    if (q.includes('in progress') || q.includes('working on') || q.includes('ongoing')) statusFilter = 'inprogress';
    else if (q.includes('done') || q.includes('completed') || q.includes('finished')) statusFilter = 'done';
    else if (/\b(to do|todo)\b/i.test(q)) statusFilter = 'todo';
    else if (/\b(backlog)\b/i.test(q)) statusFilter = 'backlog';

    if (statusFilter) {
      return {
        originalInput: raw,
        intent: 'space_query',
        targetSpace: explicitlyMentionedSpace,
        targetStatus: statusFilter,
        optimizedGoal: `Query all ${statusFilter.toUpperCase()} work items in space "${explicitlyMentionedSpace.name}" (${explicitlyMentionedSpace.key})`
      };
    }

    return {
      originalInput: raw,
      intent: 'space_query',
      targetSpace: explicitlyMentionedSpace,
      optimizedGoal: `Fetch all tickets, progress metrics, and column breakdown for space "${explicitlyMentionedSpace.name}" (${explicitlyMentionedSpace.key})`
    };
  }

  // 10. Global Status Query
  if (q.includes('in progress') || q.includes('working on') || q.includes('ongoing')) {
    return {
      originalInput: raw,
      intent: 'status_query',
      targetStatus: 'inprogress',
      optimizedGoal: `Query and list all active tasks currently IN PROGRESS across all ${allSpaces.length} workspace spaces`
    };
  }
  if (q.includes('done') || q.includes('completed') || q.includes('finished')) {
    return {
      originalInput: raw,
      intent: 'status_query',
      targetStatus: 'done',
      optimizedGoal: `Query and list all completed deliverables in DONE across all ${allSpaces.length} workspace spaces`
    };
  }
  if (/\b(to do|todo)\b/i.test(q)) {
    return {
      originalInput: raw,
      intent: 'status_query',
      targetStatus: 'todo',
      optimizedGoal: `Query and list all pending tasks in TO DO across all ${allSpaces.length} workspace spaces`
    };
  }
  if (/\b(backlog)\b/i.test(q)) {
    return {
      originalInput: raw,
      intent: 'status_query',
      targetStatus: 'backlog',
      optimizedGoal: `Query and list all backlog work items across all ${allSpaces.length} workspace spaces`
    };
  }

  // 11. Epics List
  if (q.includes('epic') || q.includes('epics')) {
    return {
      originalInput: raw,
      intent: 'epics_list',
      optimizedGoal: `Fetch all project epics and their progress across all workspace spaces`
    };
  }

  // 12. Keyword Search
  const searchMatch = q.match(/(?:search|find|lookup|about|check for)\s+(.+)/i);
  const searchTerm = searchMatch ? searchMatch[1].trim() : (q.length > 3 ? q : '');
  if (searchTerm && !['what', 'how', 'who', 'help', 'hello', 'hi', 'hey'].includes(searchTerm)) {
    return {
      originalInput: raw,
      intent: 'search',
      searchKeyword: searchTerm,
      optimizedGoal: `Search all tickets, titles, descriptions, and labels across all spaces for keyword "${searchTerm}"`
    };
  }

  // 13. Workspace Overview Fallback
  return {
    originalInput: raw,
    intent: 'overview',
    optimizedGoal: `Provide full workspace directory and operational overview across all ${allSpaces.length} spaces`
  };
}

/**
 * Main AI Agent message processor with cross-space awareness,
 * prompt reformulation layer, natural language understanding,
 * and system instruction governance.
 */
export async function processUserMessage(
  userPrompt: string,
  activeSpace: Space | undefined,
  allSpaces: Space[],
  mode: 'info' | 'agent' = 'agent'
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

  // Optional: Try Gemini API if key is configured (only in agent mode)
  const apiKey = getGeminiApiKey();
  if (apiKey && mode === 'agent') {
    try {
      const geminiResponse = await callGeminiAPI(userPrompt, apiKey, activeSpace, allSpaces, allIssues, refinedGoal);
      if (geminiResponse) return geminiResponse;
    } catch (err) {
      console.warn('[Viva AI Agent] Gemini API call failed, falling back to local NLP engine:', err);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. READ-ONLY RESTRICTION FOR AVATAR INFO CHATBOT (mode === 'info')
  // ─────────────────────────────────────────────────────────────
  const isWriteIntent =
    refinedGoal.intent === 'create_issue' ||
    refinedGoal.intent === 'status_transition' ||
    refinedGoal.intent === 'subtask_breakdown';

  if (mode === 'info' && isWriteIntent) {
    return {
      id: uuidv4(),
      sender: 'assistant',
      text: `ℹ️ **Viva AI (Read-Only Mode)**\n\nI am the lightweight search & information assistant. I have full read access across all spaces to answer questions, search tickets, and generate status reports, but I cannot modify tickets or database records.\n\nTo execute **"${refinedGoal.optimizedGoal}"**, please use the **Lira Autonomous Agent**!`,
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

  // A. STATUS TRANSITION
  if (refinedGoal.intent === 'status_transition' && refinedGoal.targetTicket && refinedGoal.targetStatus) {
    const targetIssue = refinedGoal.targetTicket;
    const targetStatus = refinedGoal.targetStatus;
    if (targetIssue.id) {
      await updateIssue(targetIssue.id, {
        status: targetStatus,
        updatedAt: now,
        resolvedAt: targetStatus === 'done' ? now : undefined,
      });

      const updated = { ...targetIssue, status: targetStatus };
      const space = spacesMap.get(targetIssue.spaceId) || refinedGoal.targetSpace;

      return {
        id: uuidv4(),
        sender: 'assistant',
        text: `✅ **Updated Status**: Moved **${updated.key}** (*${updated.title}*) in **${space ? space.name : 'Workspace'}** to **${targetStatus.toUpperCase()}**.`,
        timestamp: now,
        refinedPrompt: refinedMetadata,
        actionTaken: {
          type: 'updated_status',
          issue: updated,
          details: `Moved to ${targetStatus} in ${space?.name || 'Workspace'}`,
        },
        suggestedActions: [
          `Show tasks in ${space?.name || 'this space'}`,
          `What else is in progress?`,
          `Break down ${updated.key} into subtasks`,
        ],
      };
    }
  }

  // B. SUBTASK BREAKDOWN
  if (refinedGoal.intent === 'subtask_breakdown' && refinedGoal.targetTicket) {
    const targetIssue = refinedGoal.targetTicket;
    if (targetIssue.id) {
      const generatedSubtasks = generateDomainSubtasks(targetIssue.title);
      const existingSubtasks = Array.isArray(targetIssue.subtasks) ? targetIssue.subtasks : [];
      const updatedSubtasks = [...existingSubtasks, ...generatedSubtasks];

      await updateIssue(targetIssue.id, {
        subtasks: updatedSubtasks,
        updatedAt: now,
      });

      const updated = { ...targetIssue, subtasks: updatedSubtasks };
      const subtasksList = generatedSubtasks.map(s => `- [ ] ${s.title}`).join('\n');
      const space = spacesMap.get(targetIssue.spaceId) || refinedGoal.targetSpace;

      return {
        id: uuidv4(),
        sender: 'assistant',
        text: `🤖 **Autonomous Breakdown Complete** for **${targetIssue.key}** (*${targetIssue.title}*) in **${space?.name || 'Workspace'}**:\n\nAdded **${generatedSubtasks.length} new subtasks** directly to the ticket:\n\n${subtasksList}`,
        timestamp: now,
        refinedPrompt: refinedMetadata,
        actionTaken: {
          type: 'added_subtasks',
          issue: updated,
          details: `Added ${generatedSubtasks.length} subtasks to ${updated.key}`,
        },
        suggestedActions: [
          `Move ${targetIssue.key} to inprogress`,
          `Show all tasks in ${space?.name || 'this space'}`,
          `What is in progress?`,
        ],
      };
    }
  }

  // C. TICKET DETAIL INSPECTION
  if (refinedGoal.intent === 'ticket_detail' && refinedGoal.targetTicket) {
    const targetIssue = refinedGoal.targetTicket;
    const space = spacesMap.get(targetIssue.spaceId) || refinedGoal.targetSpace;
    const sub = targetIssue.subtasks || [];
    const completedSub = sub.filter(s => s.completed).length;

    let responseText = `### 📋 Ticket Details: **${targetIssue.key}**\n\n`;
    responseText += `- **Title**: ${targetIssue.title}\n`;
    responseText += `- **Space**: ${space?.icon || '📁'} **${space?.name || 'Unknown'}** (\`${space?.key || '?'}\`)\n`;
    responseText += `- **Type**: \`${targetIssue.type.toUpperCase()}\` | **Priority**: \`${targetIssue.priority.toUpperCase()}\`\n`;
    responseText += `- **Status**: **${targetIssue.status.toUpperCase()}**\n`;
    responseText += `- **Assignee**: ${targetIssue.assignee || 'Unassigned'} | **Reporter**: ${targetIssue.reporter || 'VY'}\n`;
    if (targetIssue.dueDate) responseText += `- **Due Date**: ${new Date(targetIssue.dueDate).toLocaleDateString()}\n`;
    if (targetIssue.epicLink) responseText += `- **Parent Epic**: ⚡ **${targetIssue.epicLink}**\n`;
    if (sub.length > 0) responseText += `- **Subtasks**: ${completedSub}/${sub.length} completed (${Math.round((completedSub / sub.length) * 100)}%)\n`;
    if (targetIssue.description) {
      const descPreview = targetIssue.description.split('\n').slice(0, 4).join('\n').trim();
      responseText += `\n**Description Preview:**\n> ${descPreview.replace(/\n/g, '\n> ')}\n`;
    }

    return {
      id: uuidv4(),
      sender: 'assistant',
      text: responseText,
      timestamp: now,
      refinedPrompt: refinedMetadata,
      actionTaken: {
        type: 'summary',
        issue: targetIssue,
        details: `Viewed details of ${targetIssue.key}`,
      },
      suggestedActions: [
        `Move ${targetIssue.key} to ${targetIssue.status === 'done' ? 'inprogress' : 'done'}`,
        `Break down ${targetIssue.key} into subtasks`,
        `Show other tasks in ${space?.name || 'this space'}`,
      ],
    };
  }

  // D. CREATE NEW ISSUE WITH TARGET SPACE AWARENESS
  if (refinedGoal.intent === 'create_issue' && refinedGoal.newIssueTitle) {
    const rawType = (refinedGoal.newIssueType || 'task').toLowerCase() as IssueType;
    const title = refinedGoal.newIssueTitle;
    const spaceToUse = refinedGoal.targetSpace || activeSpace || allSpaces[0];

    if (spaceToUse && spaceToUse.id) {
      const key = await getNextIssueKey(spaceToUse.key);
      let priority: Priority = 'medium';
      if (q.includes('highest priority') || q.includes('critical') || q.includes('urgent')) priority = 'highest';
      else if (q.includes('high priority') || q.includes('important')) priority = 'high';
      else if (q.includes('low priority')) priority = 'low';

      let status = 'todo';
      if (q.includes('in progress') || q.includes('inprogress')) status = 'inprogress';
      else if (q.includes('in backlog') || q.includes('backlog')) status = 'backlog';
      else if (q.includes('done')) status = 'done';

      const newIssue: Omit<Issue, 'id'> = {
        spaceId: spaceToUse.id,
        key,
        title: title.charAt(0).toUpperCase() + title.slice(1),
        description: `## Overview\nCreated autonomously by Viva AI Agent based on prompt:\n> "${userPrompt}"\n\n## Refined Goal\n- ${refinedGoal.optimizedGoal}\n\n## Acceptance Criteria\n- Implemented according to project specification in ${spaceToUse.name}\n- Verified on board and local storage`,
        type: rawType,
        status,
        priority,
        assignee: 'VY',
        assigneeInitials: 'VY',
        reporter: 'AI Agent',
        reporterInitials: 'AI',
        labels: ['ai-created', spaceToUse.key.toLowerCase()],
        subtasks: [
          { id: uuidv4(), title: 'Initial setup & requirements verification', completed: false, createdAt: now },
          { id: uuidv4(), title: 'Implementation & local testing', completed: false, createdAt: now },
          { id: uuidv4(), title: 'Review and promote on Kanban board', completed: false, createdAt: now },
        ],
        comments: [],
        activity: [{
          id: uuidv4(),
          type: 'created',
          author: 'AI Agent',
          authorInitials: 'AI',
          description: `created this ${rawType} in ${spaceToUse.name} via conversational AI agent command`,
          createdAt: now,
        }],
        attachments: [],
        linkedIssues: [],
        rank: Date.now(),
        storyPoints: rawType === 'epic' ? 13 : rawType === 'bug' ? 2 : 5,
        watchers: ['VY'],
        createdAt: now,
        updatedAt: now,
      };

      const id = await createIssue(newIssue);
      const created = { ...newIssue, id };

      return {
        id: uuidv4(),
        sender: 'assistant',
        text: `🎉 **Created Issue**: **${created.key}** (*${created.title}*)\n- **Space**: ${spaceToUse.icon} **${spaceToUse.name}** (\`${spaceToUse.key}\`)\n- **Type**: \`${rawType.toUpperCase()}\` | **Status**: **${status.toUpperCase()}** | **Priority**: \`${priority.toUpperCase()}\`\n- Added 3 initial subtasks automatically.`,
        timestamp: now,
        refinedPrompt: refinedMetadata,
        actionTaken: {
          type: 'created_issue',
          issue: created,
          details: `Created in ${spaceToUse.name}`,
        },
        suggestedActions: [
          `Break down ${created.key} into subtasks`,
          `Move ${created.key} to inprogress`,
          `Show all tasks in ${spaceToUse.name}`,
        ],
      };
    }
  }

  // E. CROSS-SPACE STATUS BREAKDOWN MATRIX
  if (refinedGoal.intent === 'matrix') {
    let text = `### 📊 **Workspace Status Breakdown Across All Spaces** (${allSpaces.length} Spaces, ${allIssues.length} Tickets)\n\n`;
    text += `| Space | Key | 📥 Backlog | 📝 To Do | ⚡ In Progress | ✅ Done | Total |\n|---|:---:|:---:|:---:|:---:|:---:|:---:|\n`;

    let totalBacklog = 0;
    let totalTodo = 0;
    let totalInprogress = 0;
    let totalDone = 0;

    allSpaces.forEach(s => {
      const issues = allIssues.filter(i => i.spaceId === s.id);
      const b = issues.filter(i => i.status === 'backlog').length;
      const td = issues.filter(i => i.status === 'todo').length;
      const ip = issues.filter(i => i.status === 'inprogress').length;
      const d = issues.filter(i => i.status === 'done').length;

      totalBacklog += b;
      totalTodo += td;
      totalInprogress += ip;
      totalDone += d;

      text += `| ${s.icon} **${s.name}** | \`${s.key}\` | ${b} | ${td} | ${ip} | ${d} | **${issues.length}** |\n`;
    });

    text += `| **Workspace Total** | — | **${totalBacklog}** | **${totalTodo}** | **${totalInprogress}** | **${totalDone}** | **${allIssues.length}** |\n`;

    return {
      id: uuidv4(),
      sender: 'assistant',
      text,
      timestamp: now,
      refinedPrompt: refinedMetadata,
      actionTaken: {
        type: 'summary',
        details: 'Cross-space status breakdown matrix',
      },
      suggestedActions: [
        'What is in progress across all spaces?',
        'Show all Epics across spaces',
        'Show tickets in Atmos',
      ],
    };
  }

  // F. PRIORITY DISTRIBUTION BREAKDOWN
  if (refinedGoal.intent === 'priority_breakdown') {
    let text = `### 🎯 **Priority Distribution Across All Spaces** (${allIssues.length} Tickets)\n\n`;
    text += `| Space | Key | ⏫ Highest | 🔺 High | ▬ Medium | 🔻 Low | Total |\n|---|:---:|:---:|:---:|:---:|:---:|:---:|\n`;

    allSpaces.forEach(s => {
      const issues = allIssues.filter(i => i.spaceId === s.id);
      const highest = issues.filter(i => i.priority === 'highest').length;
      const high = issues.filter(i => i.priority === 'high').length;
      const medium = issues.filter(i => i.priority === 'medium').length;
      const low = issues.filter(i => i.priority === 'low' || i.priority === 'lowest').length;
      text += `| ${s.icon} **${s.name}** | \`${s.key}\` | ${highest} | ${high} | ${medium} | ${low} | **${issues.length}** |\n`;
    });

    return {
      id: uuidv4(),
      sender: 'assistant',
      text,
      timestamp: now,
      refinedPrompt: refinedMetadata,
      suggestedActions: ['Show status breakdown of all spaces', 'What is in progress across all spaces?'],
    };
  }

  // G. SPECIFIC SPACE QUERY
  if (refinedGoal.intent === 'space_query' && refinedGoal.targetSpace) {
    const spaceToQuery = refinedGoal.targetSpace;
    const spaceIssues = allIssues.filter(i => i.spaceId === spaceToQuery.id);

    if (refinedGoal.targetStatus) {
      const statusFilter = refinedGoal.targetStatus;
      const filtered = spaceIssues.filter(i => i.status === statusFilter);
      if (filtered.length === 0) {
        return {
          id: uuidv4(),
          sender: 'assistant',
          text: `In **${spaceToQuery.icon} ${spaceToQuery.name}**, there are currently **0 tickets** in **${statusFilter.toUpperCase()}**.\n\nTotal tickets in this space: **${spaceIssues.length}**.`,
          timestamp: now,
          refinedPrompt: refinedMetadata,
          suggestedActions: [
            `Show all tickets in ${spaceToQuery.name}`,
            `What is in progress in ${spaceToQuery.name}?`,
            `Workspace overview`,
          ],
        };
      }

      const list = filtered.map(i => `- **${i.key}** [${i.type}]: **${i.title}** (Priority: \`${i.priority}\` | Assignee: ${i.assignee || 'Unassigned'})`).join('\n');
      return {
        id: uuidv4(),
        sender: 'assistant',
        text: `### ${spaceToQuery.icon} **${spaceToQuery.name}** — ${statusFilter.toUpperCase()} (${filtered.length} items):\n\n${list}`,
        timestamp: now,
        refinedPrompt: refinedMetadata,
        suggestedActions: [
          `Show all tickets in ${spaceToQuery.name}`,
          filtered.length > 0 ? `Tell me about ${filtered[0].key}` : 'Workspace overview',
          'What is in progress across all spaces?',
        ],
      };
    }

    // Full Space Overview
    const byStatus = {
      backlog: spaceIssues.filter(i => i.status === 'backlog'),
      todo: spaceIssues.filter(i => i.status === 'todo'),
      inprogress: spaceIssues.filter(i => i.status === 'inprogress'),
      done: spaceIssues.filter(i => i.status === 'done'),
    };

    let text = `### ${spaceToQuery.icon} **${spaceToQuery.name}** (\`${spaceToQuery.key}\`) — ${spaceIssues.length} Total Tickets:\n\n`;
    text += `| Column | Count | Tickets |\n|---|:---:|---|\n`;
    text += `| 📥 **Backlog** | ${byStatus.backlog.length} | ${byStatus.backlog.map(i => `\`${i.key}\``).join(', ') || '—'} |\n`;
    text += `| 📝 **To Do** | ${byStatus.todo.length} | ${byStatus.todo.map(i => `\`${i.key}\``).join(', ') || '—'} |\n`;
    text += `| ⚡ **In Progress** | ${byStatus.inprogress.length} | ${byStatus.inprogress.map(i => `\`${i.key}\``).join(', ') || '—'} |\n`;
    text += `| ✅ **Done** | ${byStatus.done.length} | ${byStatus.done.map(i => `\`${i.key}\``).join(', ') || '—'} |\n\n`;

    if (spaceIssues.length > 0) {
      text += `**Sample tickets in this space:**\n`;
      spaceIssues.slice(0, 5).forEach(i => {
        text += `- **${i.key}** [${i.status.toUpperCase()}]: ${i.title}\n`;
      });
    }

    return {
      id: uuidv4(),
      sender: 'assistant',
      text,
      timestamp: now,
      refinedPrompt: refinedMetadata,
      actionTaken: {
        type: 'summary',
        details: `${spaceToQuery.name} summary`,
      },
      suggestedActions: [
        `What is in progress in ${spaceToQuery.name}?`,
        `Create task in ${spaceToQuery.name}`,
        'Show all spaces overview',
      ],
    };
  }

  // H. EPICS LIST ACROSS ALL SPACES
  if (refinedGoal.intent === 'epics_list') {
    const allEpics = allIssues.filter(i => i.type === 'epic');
    if (allEpics.length > 0) {
      let text = `### ⚡ **All Epics Across Workspace (${allEpics.length} Epics):**\n\n`;
      allEpics.forEach(e => {
        const space = spacesMap.get(e.spaceId);
        const children = allIssues.filter(i => i.parentId === e.id || i.epicId === e.id);
        const doneChildren = children.filter(c => c.status === 'done').length;
        text += `- **${e.key}**: **${e.title}**\n`;
        text += `  - Space: ${space?.icon} **${space?.name}** | Status: **${e.status.toUpperCase()}** | Priority: \`${e.priority}\`\n`;
        text += `  - Progress: ${doneChildren}/${children.length} tasks completed\n`;
      });

      return {
        id: uuidv4(),
        sender: 'assistant',
        text,
        timestamp: now,
        refinedPrompt: refinedMetadata,
        suggestedActions: allEpics.map(e => `Tell me about ${e.key}`),
      };
    }
  }

  // I. STATUS QUERY ACROSS ALL SPACES (In Progress, Done, To Do, Backlog)
  if (refinedGoal.intent === 'status_query') {
    const targetStatus = refinedGoal.targetStatus || 'inprogress';

    if (targetStatus === 'inprogress') {
      const inProgress = allIssues.filter(i => i.status === 'inprogress');
      if (inProgress.length === 0) {
        return {
          id: uuidv4(),
          sender: 'assistant',
          text: `Currently, there are **0 tasks in progress** across the entire workspace.\n\nReady to pull work from **To Do**!`,
          timestamp: now,
          refinedPrompt: refinedMetadata,
          suggestedActions: ['Show tasks in To Do', 'Workspace overview'],
        };
      }

      const items = inProgress.map(i => {
        const space = spacesMap.get(i.spaceId);
        return `- **${i.key}** [${space?.name || 'Workspace'}]: **${i.title}** (Priority: \`${i.priority}\` | Assignee: ${i.assignee || 'Unassigned'})`;
      }).join('\n');

      return {
        id: uuidv4(),
        sender: 'assistant',
        text: `### ⚡ **Currently In Progress Across All Spaces (${inProgress.length} items):**\n\n${items}`,
        timestamp: now,
        refinedPrompt: refinedMetadata,
        suggestedActions: inProgress.slice(0, 3).map(i => `Tell me about ${i.key}`),
      };
    }

    if (targetStatus === 'done') {
      const doneItems = allIssues.filter(i => i.status === 'done');
      const items = doneItems.slice(0, 10).map(i => {
        const space = spacesMap.get(i.spaceId);
        return `- ✅ **${i.key}** [${space?.name || 'Workspace'}]: **${i.title}**`;
      }).join('\n');

      return {
        id: uuidv4(),
        sender: 'assistant',
        text: `### 🏆 **Completed Deliverables (${doneItems.length} items in Done):**\n\n${items}${doneItems.length > 10 ? `\n- *...and ${doneItems.length - 10} more completed items across spaces.*` : ''}`,
        timestamp: now,
        refinedPrompt: refinedMetadata,
        suggestedActions: ['What is in progress?', 'Show status breakdown of all spaces'],
      };
    }

    if (targetStatus === 'todo') {
      const todoItems = allIssues.filter(i => i.status === 'todo');
      const items = todoItems.slice(0, 10).map(i => {
        const space = spacesMap.get(i.spaceId);
        return `- 📝 **${i.key}** [${space?.name || 'Workspace'}]: **${i.title}** (Priority: \`${i.priority}\` | Assignee: ${i.assignee || 'Unassigned'})`;
      }).join('\n');

      return {
        id: uuidv4(),
        sender: 'assistant',
        text: `### 📝 **Items in To Do Across All Spaces (${todoItems.length} items):**\n\n${items}${todoItems.length > 10 ? `\n- *...and ${todoItems.length - 10} more items in To Do.*` : ''}`,
        timestamp: now,
        refinedPrompt: refinedMetadata,
        suggestedActions: ['What is in progress?', 'Show status breakdown of all spaces'],
      };
    }

    if (targetStatus === 'backlog') {
      const backlogItems = allIssues.filter(i => i.status === 'backlog');
      const items = backlogItems.slice(0, 10).map(i => {
        const space = spacesMap.get(i.spaceId);
        return `- 📥 **${i.key}** [${space?.name || 'Workspace'}]: **${i.title}** (Priority: \`${i.priority}\`)`;
      }).join('\n');

      return {
        id: uuidv4(),
        sender: 'assistant',
        text: `### 📥 **Items in Backlog Across All Spaces (${backlogItems.length} items):**\n\n${items}${backlogItems.length > 10 ? `\n- *...and ${backlogItems.length - 10} more items in Backlog.*` : ''}`,
        timestamp: now,
        refinedPrompt: refinedMetadata,
        suggestedActions: ['What is in To Do?', 'What is in progress?'],
      };
    }
  }

  // J. KEYWORD SEARCH ACROSS ALL SPACES
  if (refinedGoal.intent === 'search' && refinedGoal.searchKeyword) {
    const searchTerm = refinedGoal.searchKeyword.toLowerCase();
    const matches = allIssues.filter(i =>
      i.title.toLowerCase().includes(searchTerm) ||
      i.description.toLowerCase().includes(searchTerm) ||
      (i.labels && i.labels.some(l => l.toLowerCase().includes(searchTerm)))
    );

    if (matches.length > 0) {
      let text = `### 🔍 **Search Results for "${refinedGoal.searchKeyword}" (${matches.length} matches across spaces):**\n\n`;
      matches.forEach(i => {
        const space = spacesMap.get(i.spaceId);
        text += `- **${i.key}** [${space?.icon} ${space?.name}]: **${i.title}** (${i.status.toUpperCase()} | \`${i.priority}\`)\n`;
      });

      return {
        id: uuidv4(),
        sender: 'assistant',
        text,
        timestamp: now,
        refinedPrompt: refinedMetadata,
        suggestedActions: matches.slice(0, 3).map(i => `Tell me about ${i.key}`),
      };
    }
  }

  // K. DEFAULT CONVERSATIONAL RESPONSE WITH SMART CONTEXT
  if (mode === 'info') {
    return {
      id: uuidv4(),
      sender: 'assistant',
      text: `👋 I am **Viva AI (Read-Only Assistant)**.\n\nI have active search & analytics visibility into **all ${allSpaces.length} spaces** and **${allIssues.length} tickets**. You can ask me naturally to fetch information:\n\n- *"Show all spaces with number of tickets in each To do, Backlog, In Progress and Done"*\n- *"What tasks are in Atmos?"*\n- *"Tell me about AP-7"*\n- *"What is in progress across all spaces?"*\n- *"Show all Epics across spaces"*\n- *"Search for docker"*\n\n*(To execute write tasks like creating or moving tickets, use the Viva AI Agent in the top bar!)*`,
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
    text: `👋 I am **Viva AI Autonomous Agent**.\n\nI have full autonomous read and write visibility across **all ${allSpaces.length} spaces** and **${allIssues.length} tickets**. You can command or ask me naturally:\n\n- *"Move AP-10 to in progress"*\n- *"Create task 'Configure Helm' in Atmos"*\n- *"Break down AP-10 into subtasks"*\n- *"Show status breakdown of all spaces"*\n- *"Tell me about AP-7"*`,
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

/**
 * Domain-specific subtask generator for intelligent task breakdowns
 */
function generateDomainSubtasks(title: string): { id: string; title: string; completed: boolean; createdAt: Date }[] {
  const t = title.toLowerCase();
  const now = new Date();

  if (t.includes('docker') || t.includes('container')) {
    return [
      { id: uuidv4(), title: 'Write multi-stage Dockerfile (Alpine runtime + caching)', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Configure .dockerignore to exclude node_modules & temp files', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Build Docker image and verify image size under 40MB', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Test container locally with healthcheck endpoint', completed: false, createdAt: now },
    ];
  }

  if (t.includes('kubernetes') || t.includes('aks') || t.includes('helm')) {
    return [
      { id: uuidv4(), title: 'Create Deployment manifest with resource requests & limits', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Configure ClusterIP Service and Ingress routing rules', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Set up Horizontal Pod Autoscaler (HPA) CPU/memory threshold', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Package Helm chart values.yaml and test with dry-run', completed: false, createdAt: now },
    ];
  }

  if (t.includes('ci/cd') || t.includes('pipeline') || t.includes('azure devops') || t.includes('action')) {
    return [
      { id: uuidv4(), title: 'Define workflow YAML triggers on main push and pull requests', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Add dependency cache and automated Vitest execution step', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Configure service principal / secret tokens for registry push', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Add automated container push to container registry (ACR)', completed: false, createdAt: now },
    ];
  }

  if (t.includes('interview') || t.includes('resume') || t.includes('system design') || t.includes('leetcode')) {
    return [
      { id: uuidv4(), title: 'Review core architectural principles and trade-offs', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Practice timed mock problem solving and edge cases', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Document key talking points and STAR methodology stories', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Refine resume bullet points with quantified engineering metrics', completed: false, createdAt: now },
    ];
  }

  if (t.includes('certification') || t.includes('exam') || t.includes('aws') || t.includes('terraform') || t.includes('kcna')) {
    return [
      { id: uuidv4(), title: 'Complete domain video modules and study notes', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Conduct hands-on terminal labs and architecture drills', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Take timed practice exam and analyze question review notes', completed: false, createdAt: now },
      { id: uuidv4(), title: 'Schedule official exam appointment and review cheat sheet', completed: false, createdAt: now },
    ];
  }

  // Default smart engineering breakdown
  return [
    { id: uuidv4(), title: 'Define technical specification & acceptance criteria', completed: false, createdAt: now },
    { id: uuidv4(), title: 'Implement core functionality and data models', completed: false, createdAt: now },
    { id: uuidv4(), title: 'Write unit tests and verify edge cases', completed: false, createdAt: now },
    { id: uuidv4(), title: 'Review changes and verify on Kanban board', completed: false, createdAt: now },
  ];
}

/**
 * Optional Google Gemini API integration when user configures an API key
 */
async function callGeminiAPI(
  userPrompt: string,
  apiKey: string,
  activeSpace: Space | undefined,
  allSpaces: Space[],
  allIssues: Issue[],
  refinedGoal?: RefinedPromptGoal
): Promise<ChatMessage | null> {
  const systemInstruction = getSystemInstruction();

  // Create condensed context of spaces and issues for token efficiency
  const spacesContext = allSpaces.map(s => ({
    id: s.id,
    key: s.key,
    name: s.name,
    issueCount: allIssues.filter(i => i.spaceId === s.id).length,
  }));

  const issuesContext = allIssues.slice(0, 75).map(i => ({
    key: i.key,
    spaceId: i.spaceId,
    title: i.title,
    type: i.type,
    status: i.status,
    priority: i.priority,
    assignee: i.assignee,
    parent: i.epicLink,
  }));

  const contextPayload = {
    system: systemInstruction,
    activeSpace: activeSpace ? { key: activeSpace.key, name: activeSpace.name } : 'All Spaces',
    allSpaces: spacesContext,
    issues: issuesContext,
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const promptText = `SYSTEM CONTEXT:
${JSON.stringify(contextPayload)}

REFINED OBJECTIVE & ACTIONABLE GOAL:
${refinedGoal ? refinedGoal.optimizedGoal : userPrompt}
(Intent: ${refinedGoal?.intent || 'general'}, Target Space: ${refinedGoal?.targetSpace?.name || 'All Spaces'})

ORIGINAL USER REQUEST:
${userPrompt}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: promptText }
        ]
      }
    ]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`Gemini API HTTP ${res.status}`);
  }

  const json = await res.json();
  const replyText = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!replyText) return null;

  return {
    id: uuidv4(),
    sender: 'assistant',
    text: replyText,
    timestamp: new Date(),
    refinedPrompt: refinedGoal ? {
      originalInput: userPrompt,
      optimizedGoal: refinedGoal.optimizedGoal,
      intentType: refinedGoal.intent,
      targetSpace: refinedGoal.targetSpace?.name,
      targetTicketKey: refinedGoal.targetTicketKey,
    } : undefined,
    suggestedActions: [
      'What is in progress?',
      'Show all spaces overview',
      'Plan sprint',
    ],
  };
}
