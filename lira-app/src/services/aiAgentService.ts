/**
 * Viva AI agent. The code lives in services/ai/:
 *   types.ts      chat messages and the "refined goal" a prompt is turned into
 *   settings.ts   system instruction and Gemini API key
 *   intent.ts     understanding a prompt: which space, which ticket, what to do
 *   agent.ts      answers a prompt (tries the handlers in order, or Gemini when a key is set)
 *   handlersWrite.ts / handlersRead.ts   one handler per kind of request
 *   subtasks.ts   subtask suggestions   gemini.ts   the optional cloud model
 * This file re-exports the public parts so existing imports keep working.
 */
export * from './ai/types';
export * from './ai/settings';
export { findTargetSpace, refineUserPrompt } from './ai/intent';
export { processUserMessage } from './ai/agent';
export { confirmAndRun, undoAction } from './ai/confirm';
export { suggestForTicket } from './ai/suggest';
