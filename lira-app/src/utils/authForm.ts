/** Checks for the log-in and sign-up forms. The server repeats them; these only save a round trip and say what is wrong. */
export type AuthMode = 'login' | 'signup';
export interface AuthValues { name: string; email: string; password: string }
export type AuthErrors = Partial<Record<keyof AuthValues, string>>;

export const MIN_PASSWORD = 10;
const MAX = { name: 100, email: 254, password: 128 } as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function nameError(name: string): string | undefined {
  if (!name.trim()) return 'Enter your name.';
  return name.length > MAX.name ? `Use at most ${MAX.name} characters.` : undefined;
}

export function emailError(email: string): string | undefined {
  if (!email.trim()) return 'Enter your email.';
  return email.length > MAX.email || !EMAIL.test(email.trim()) ? 'Enter an email like you@example.com.' : undefined;
}

function passwordError(password: string, mode: AuthMode): string | undefined {
  if (!password) return 'Enter your password.';
  if (password.length > MAX.password) return `Use at most ${MAX.password} characters.`;
  return mode === 'signup' && password.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters.` : undefined;
}

/** The problem with each field, or an empty object when the form can be sent. Sign-up asks for a name and a longer password. */
export function validateAuth(mode: AuthMode, values: AuthValues): AuthErrors {
  const errors: AuthErrors = {};
  if (mode === 'signup') {
    const name = nameError(values.name);
    if (name) errors.name = name;
  }
  const email = emailError(values.email);
  if (email) errors.email = email;
  const password = passwordError(values.password, mode);
  if (password) errors.password = password;
  return errors;
}
