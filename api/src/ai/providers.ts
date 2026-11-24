import type { AiProviderConfig, AiProviderId } from '../config';

/** How the API reaches a model provider. A test supplies its own, so nothing real is called and no key is used. */
export type AiHttp = (url: string, init?: RequestInit) => Promise<Response>;
export const AI_HTTP = Symbol('AI_HTTP');

export interface ModelAnswer { text: string; inputTokens: number | null; outputTokens: number | null }

/** The provider failed, was slow, or answered with something unreadable. The message is safe to log: it never holds a key or the provider's own text. */
export class ProviderError extends Error {}

const TIMEOUT_MS = 30_000;
/** Longest answer kept; a model that rambles is cut here. */
export const MAX_ANSWER_CHARS = 8000;
const MAX_OUTPUT_TOKENS = 1024;
/** Largest provider reply read, so a hostile or broken server cannot make the API hold a huge body. */
const MAX_REPLY_BYTES = 1_000_000;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

async function post(http: AiHttp, url: string, headers: Record<string, string>, body: unknown): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await http(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch { throw new ProviderError('The model provider could not be reached.'); }
  if (!res.ok) throw new ProviderError(`The model provider answered ${res.status}.`);
  const text = await res.text();
  if (text.length > MAX_REPLY_BYTES) throw new ProviderError('The model provider sent too much.');
  try {
    const json: unknown = JSON.parse(text);
    if (isObj(json)) return json;
  } catch { /* fall through */ }
  throw new ProviderError('The model provider sent something unreadable.');
}

const answer = (text: unknown, inputTokens: unknown, outputTokens: unknown): ModelAnswer => {
  if (typeof text !== 'string' || !text.trim()) throw new ProviderError('The model gave no answer.');
  return { text: text.trim().slice(0, MAX_ANSWER_CHARS), inputTokens: count(inputTokens), outputTokens: count(outputTokens) };
};

/** One function per provider. Each calls a fixed address (never one from a request) and keeps the key in a header, never in the address. */
type Ask = (http: AiHttp, cfg: AiProviderConfig, system: string, user: string) => Promise<ModelAnswer>;

const openai: Ask = async (http, cfg, system, user) => {
  const json = await post(http, 'https://api.openai.com/v1/chat/completions', { Authorization: `Bearer ${cfg.key}` }, {
    model: cfg.model, max_completion_tokens: MAX_OUTPUT_TOKENS, messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  });
  const choice = Array.isArray(json.choices) ? json.choices[0] : undefined;
  const usage = isObj(json.usage) ? json.usage : {};
  return answer(isObj(choice) && isObj(choice.message) ? choice.message.content : undefined, usage.prompt_tokens, usage.completion_tokens);
};

const anthropic: Ask = async (http, cfg, system, user) => {
  const json = await post(http, 'https://api.anthropic.com/v1/messages', { 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01' }, {
    model: cfg.model, max_tokens: MAX_OUTPUT_TOKENS, system, messages: [{ role: 'user', content: user }],
  });
  const text = (Array.isArray(json.content) ? json.content : []).map(b => (isObj(b) && b.type === 'text' ? b.text : '')).filter(t => typeof t === 'string').join('');
  const usage = isObj(json.usage) ? json.usage : {};
  return answer(text, usage.input_tokens, usage.output_tokens);
};

const gemini: Ask = async (http, cfg, system, user) => {
  const json = await post(http, `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent`, { 'x-goog-api-key': cfg.key }, {
    systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
  });
  const candidate = Array.isArray(json.candidates) ? json.candidates[0] : undefined;
  const parts = isObj(candidate) && isObj(candidate.content) && Array.isArray(candidate.content.parts) ? candidate.content.parts : [];
  const text = parts.map(p => (isObj(p) && typeof p.text === 'string' ? p.text : '')).join('');
  const usage = isObj(json.usageMetadata) ? json.usageMetadata : {};
  return answer(text, usage.promptTokenCount, usage.candidatesTokenCount);
};

const ASK: Record<AiProviderId, Ask> = { openai, anthropic, gemini };

export const askProvider = (http: AiHttp, cfg: AiProviderConfig, system: string, user: string): Promise<ModelAnswer> => ASK[cfg.id](http, cfg, system, user);
