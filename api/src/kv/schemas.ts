import { z } from 'zod';

export const MAX_VALUE = 262144;
export const MAX_ENTRIES = 100;

/** A key the app uses: `lira_` and a name. Internal keys (`lira__`) and anything that looks like an AI key are never stored. */
const key = z.string().regex(/^lira_[A-Za-z0-9_:.-]{1,120}$/, 'Not a key the app uses.')
  .refine(k => !k.startsWith('lira__') && !/api_key/i.test(k), 'This key is never stored on the server.');

/** A value is the text the app holds, or null to remove the entry. */
const entries = z.record(key, z.string().max(MAX_VALUE, 'Value is too large.').nullable())
  .refine(e => Object.keys(e).length <= MAX_ENTRIES, `At most ${MAX_ENTRIES} entries at a time.`);

/** `shared` is for the whole organisation, `mine` is the caller's own preferences. Unknown fields are refused. */
export const writeKvSchema = z.strictObject({ shared: entries.optional(), mine: entries.optional() })
  .refine(v => v.shared !== undefined || v.mine !== undefined, { message: 'Nothing to save.' });

export type WriteKv = z.infer<typeof writeKvSchema>;
