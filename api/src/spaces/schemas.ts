import { z } from 'zod';

const key = z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9]{1,9}$/, 'Use 2 to 10 letters or digits, starting with a letter.');
const name = z.string().trim().min(1, 'Enter a name.').max(100, 'Use at most 100 characters.');
const icon = z.string().min(1).max(32, 'Use at most 32 characters.');
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a colour like #1A2B3C.');
const description = z.string().max(2000, 'Use at most 2000 characters.');
const version = z.number().int().min(1);

/** Unknown fields are refused (mass assignment). The id, the organisation and the version are never taken from a create. */
export const createSpaceSchema = z.strictObject({ key, name, icon, color, description: description.optional() });

/** An update names the version the person saw. At least one field must change. */
export const updateSpaceSchema = z.strictObject({ version, name: name.optional(), icon: icon.optional(), color: color.optional(), description: description.optional() })
  .refine(v => Object.keys(v).some(k => k !== 'version'), { message: 'Nothing to change.' });

export const deleteSpaceSchema = z.strictObject({ version });

export type CreateSpace = z.infer<typeof createSpaceSchema>;
export type UpdateSpace = z.infer<typeof updateSpaceSchema>;
