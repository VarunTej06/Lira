/**
 * Calls to the hosted edition's API (api/): sign-up, log-in, log-out and "who am I". The session lives in an HttpOnly cookie the
 * browser keeps and sends by itself, so nothing here reads, stores or logs a token or a password.
 */
export interface AuthUser { id: string; email: string; name: string }
export interface Organisation { orgId: string; orgName: string; role: string }
export interface Me { user: AuthUser; organisations: Organisation[] }

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string; fields?: Record<string, string> };

const NO_ANSWER = 'Could not reach the server. Check your connection and try again.';
const HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'liraspaces' }; // the API refuses a change without this header

interface ErrorBody { error?: { message?: unknown; fields?: unknown } }

function fieldsOf(value: unknown): Record<string, string> | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const entries = Object.entries(value).filter((e): e is [string, string] => typeof e[1] === 'string');
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/** The API's answer as a result: the data on success, or the message (and any field messages) on failure. */
export async function readResponse<T>(res: Response): Promise<AuthResult<T>> {
  if (res.status === 204) return { ok: true, data: undefined as T };
  const body: unknown = await res.json().catch(() => null);
  if (res.ok) return { ok: true, data: body as T };
  const error = (body as ErrorBody | null)?.error;
  return {
    ok: false,
    status: res.status,
    message: typeof error?.message === 'string' ? error.message : 'Something went wrong. Try again in a moment.',
    fields: fieldsOf(error?.fields),
  };
}

export async function send<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<AuthResult<T>> {
  try {
    const res = await fetch(path, { method, headers: HEADERS, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) });
    return await readResponse<T>(res);
  } catch {
    return { ok: false, status: 0, message: NO_ANSWER };
  }
}

export interface SignupValues { name: string; email: string; password: string; remember?: boolean }
export interface LoginValues { email: string; password: string; remember?: boolean }

export const signup = (values: SignupValues) => send<Me>('POST', '/api/auth/signup', values);
export const login = (values: LoginValues) => send<Me>('POST', '/api/auth/login', values);
export const logout = () => send<void>('POST', '/api/auth/logout');
export const fetchMe = () => send<Me>('GET', '/api/me');
