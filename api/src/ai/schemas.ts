import { z } from 'zod';
import { AI_PROVIDER_IDS } from '../config';

export const MAX_QUESTION = 2000;

/** One question to Viva. The space is optional: without it Viva looks at every space the person may see. */
export const askSchema = z.strictObject({
  question: z.string().trim().min(1, 'Ask a question.').max(MAX_QUESTION, `Use at most ${MAX_QUESTION} characters.`),
  spaceId: z.number().int().positive().optional(),
  provider: z.enum(AI_PROVIDER_IDS).optional(),
});

export type AskInput = z.infer<typeof askSchema>;
