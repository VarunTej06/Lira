import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import type { ChatMessage, RefinedPromptGoal } from './types';

/** Everything a handler needs to answer one prompt. */
export interface AgentContext {
  userPrompt: string;
  /** the prompt, trimmed and lower-cased */
  q: string;
  now: Date;
  mode: 'info' | 'agent';
  activeSpace: Space | undefined;
  allSpaces: Space[];
  allIssues: Issue[];
  spacesMap: Map<number, Space>;
  refinedGoal: RefinedPromptGoal;
  refinedMetadata: NonNullable<ChatMessage['refinedPrompt']>;
}

/** A handler answers the prompt, or returns undefined when the prompt is not for it. */
export type AgentHandler = (c: AgentContext) => Promise<ChatMessage | undefined>;
