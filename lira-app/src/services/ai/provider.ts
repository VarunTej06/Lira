import { v4 as uuidv4 } from 'uuid';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import type { ChatMessage, RefinedPromptGoal } from './types';
import { getAiProvider, getGeminiApiKey, getOpenAiConfig, getSystemInstruction } from './settings';
import { buildPromptText, callGeminiAPI } from './gemini';

/** Everything a model needs to answer one chat message. */
interface ModelRequest {
  userPrompt: string;
  activeSpace: Space | undefined;
  allSpaces: Space[];
  allIssues: Issue[];
  refinedGoal?: RefinedPromptGoal;
}

/** Asks an OpenAI-compatible server (Ollama, LM Studio, vLLM, OpenAI ...) using /chat/completions. */
async function callOpenAiCompatible({ userPrompt, activeSpace, allSpaces, allIssues, refinedGoal }: ModelRequest, signal?: AbortSignal): Promise<ChatMessage | null> {
  const cfg = getOpenAiConfig();
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: getSystemInstruction() },
        { role: 'user', content: buildPromptText(userPrompt, activeSpace, allSpaces, allIssues, refinedGoal) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Model server HTTP ${res.status}`);
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content;
  if (!text || typeof text !== 'string') return null;
  return {
    id: uuidv4(),
    sender: 'assistant',
    text,
    timestamp: new Date(),
    refinedPrompt: refinedGoal && {
      originalInput: userPrompt, optimizedGoal: refinedGoal.optimizedGoal, intentType: refinedGoal.intent,
      targetSpace: refinedGoal.targetSpace?.name, targetTicketKey: refinedGoal.targetTicketKey,
    },
    suggestedActions: ['What is in progress?', 'Show all spaces overview', 'Plan next sprint from my backlog'],
  };
}

/** Uses the chosen provider. Returns null for the built-in engine, or when the model gave no answer (the caller then falls back). */
export async function askConfiguredModel(req: ModelRequest): Promise<ChatMessage | null> {
  const { userPrompt, activeSpace, allSpaces, allIssues, refinedGoal } = req;
  const provider = getAiProvider();
  if (provider === 'gemini') {
    const key = getGeminiApiKey();
    return key ? callGeminiAPI(userPrompt, key, activeSpace, allSpaces, allIssues, refinedGoal) : null;
  }
  if (provider === 'openai') return callOpenAiCompatible(req);
  return null;
}
