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

// ─── Which model answers ─────────────────────────────────────────────────────
// 'local'  built-in rules, no network (the default)
// 'gemini' Google Gemini with an API key
// 'openai' any OpenAI-compatible server: Ollama, LM Studio, vLLM or a hosted one (set the base URL)
export type AiProvider = 'local' | 'gemini' | 'openai';

export interface OpenAiConfig { baseUrl: string; model: string; apiKey: string }

export const DEFAULT_OPENAI_URL = 'http://localhost:11434/v1'; // Ollama
export const DEFAULT_OPENAI_MODEL = 'llama3.1';

export function getAiProvider(): AiProvider {
  const v = localStorage.getItem('lira_ai_provider');
  if (v === 'local' || v === 'gemini' || v === 'openai') return v;
  return getGeminiApiKey() ? 'gemini' : 'local'; // before this setting existed, a key meant Gemini
}

export function setAiProvider(p: AiProvider): void {
  localStorage.setItem('lira_ai_provider', p);
}

export function getOpenAiConfig(): OpenAiConfig {
  return {
    baseUrl: (localStorage.getItem('lira_ai_base_url') || DEFAULT_OPENAI_URL).replace(/\/+$/, ''),
    model: localStorage.getItem('lira_ai_model') || DEFAULT_OPENAI_MODEL,
    apiKey: localStorage.getItem('lira_ai_api_key') || '',
  };
}

export function setOpenAiConfig(c: Partial<OpenAiConfig>): void {
  if (c.baseUrl !== undefined) localStorage.setItem('lira_ai_base_url', c.baseUrl.trim());
  if (c.model !== undefined) localStorage.setItem('lira_ai_model', c.model.trim());
  if (c.apiKey !== undefined) localStorage.setItem('lira_ai_api_key', c.apiKey.trim());
}

/** Writes are explained and need a click on Confirm before they run. On by default. */
export function getConfirmWrites(): boolean {
  return localStorage.getItem('lira_ai_confirm_writes') !== '0';
}

export function setConfirmWrites(on: boolean): void {
  localStorage.setItem('lira_ai_confirm_writes', on ? '1' : '0');
}
