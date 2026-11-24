import { z } from 'zod';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 128;

const email = z.string().trim().max(254, 'Use at most 254 characters.').regex(EMAIL, 'Enter an email like you@example.com.').transform(s => s.toLowerCase());

/** Unknown fields are refused, so a request can never carry a field the code did not ask for (mass assignment). */
export const signupSchema = z.strictObject({
  name: z.string().trim().min(1, 'Enter your name.').max(100, 'Use at most 100 characters.'),
  email,
  password: z.string().min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters.`).max(MAX_PASSWORD, `Use at most ${MAX_PASSWORD} characters.`),
  remember: z.boolean().optional(),
});

export const loginSchema = z.strictObject({
  email,
  password: z.string().min(1, 'Enter your password.').max(MAX_PASSWORD, `Use at most ${MAX_PASSWORD} characters.`),
  remember: z.boolean().optional(),
});

const linkToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'This link is not valid.');

export const verifyEmailSchema = z.strictObject({ token: linkToken });
export const forgotPasswordSchema = z.strictObject({ email });
export const resetPasswordSchema = z.strictObject({
  token: linkToken,
  password: z.string().min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters.`).max(MAX_PASSWORD, `Use at most ${MAX_PASSWORD} characters.`),
});

export const twoStepLoginSchema = z.strictObject({ challenge: linkToken, code: z.string().trim().min(6, 'Enter the code.').max(12, 'That code is too long.') });
export const twoStepCodeSchema = z.strictObject({ code: z.string().trim().min(6, 'Enter the code.').max(12, 'That code is too long.') });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** The first message for each field that failed, keyed by field name. An unknown field is named by its own key. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  const add = (field: string, message: string) => { if (!(field in out)) out[field] = message; };
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') issue.keys.forEach(key => add(key, 'This field is not accepted.'));
    else add(String(issue.path[0] ?? 'body'), issue.message);
  }
  return out;
}
