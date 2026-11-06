import type { Space } from '../../types/space';
import type { ChatMessage } from './types';
import { processUserMessage } from './agent';
import { runWithUndo, undoAction } from './undo';

/** Runs a prompt that was previewed, and attaches an Undo to the answer when it changed anything. */
export async function confirmAndRun(prompt: string, activeSpace: Space | undefined, allSpaces: Space[]): Promise<ChatMessage> {
  const { result, undoId, changed } = await runWithUndo(prompt, () => processUserMessage(prompt, activeSpace, allSpaces, 'agent', { confirmWrites: false }));
  return undoId ? { ...result, undo: { id: undoId, changed, state: 'available' } } : result;
}

export { undoAction };
