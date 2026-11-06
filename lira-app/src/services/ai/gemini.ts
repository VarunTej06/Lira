import { v4 as uuidv4 } from 'uuid';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import type { ChatMessage, RefinedPromptGoal } from './types';
import { getSystemInstruction } from './settings';

/**
 * Optional Google Gemini API integration when user configures an API key
 */
export function buildPromptText(
  userPrompt: string,
  activeSpace: Space | undefined,
  allSpaces: Space[],
  allIssues: Issue[],
  refinedGoal?: RefinedPromptGoal
): string {
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

  return `SYSTEM CONTEXT:
${JSON.stringify(contextPayload)}

REFINED OBJECTIVE & ACTIONABLE GOAL:
${refinedGoal ? refinedGoal.optimizedGoal : userPrompt}
(Intent: ${refinedGoal?.intent || 'general'}, Target Space: ${refinedGoal?.targetSpace?.name || 'All Spaces'})

ORIGINAL USER REQUEST:
${userPrompt}`;
}

export async function callGeminiAPI(
  userPrompt: string,
  apiKey: string,
  activeSpace: Space | undefined,
  allSpaces: Space[],
  allIssues: Issue[],
  refinedGoal?: RefinedPromptGoal
): Promise<ChatMessage | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const promptText = buildPromptText(userPrompt, activeSpace, allSpaces, allIssues, refinedGoal);

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
