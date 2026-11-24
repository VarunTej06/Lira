import { z } from 'zod';

/** A model name goes into a web address for one provider, so only plain characters are allowed. */
const MODEL_NAME = /^[A-Za-z0-9._-]{1,64}$/;

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_SSL: z.enum(['require', 'disable']).default('require'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  ALLOWED_ORIGINS: z.string().min(1, 'ALLOWED_ORIGINS is required'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('true'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  SESSION_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  REMEMBER_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  // Blob Storage for ticket attachments (ADR-0011). Both or neither: without them the attachment routes answer 503.
  STORAGE_ACCOUNT: z.string().regex(/^[a-z0-9]{3,24}$/, 'STORAGE_ACCOUNT must be 3 to 24 lower-case letters or digits').optional(),
  STORAGE_KEY: z.string().min(20).optional(),
  STORAGE_CONTAINER: z.string().regex(/^[a-z0-9-]{3,63}$/).default('attachments'),
  // Google (Meet links and invitation emails). All four together, or none: without them the app asks people to paste a link and sends no email.
  GOOGLE_CLIENT_ID: z.string().min(10).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(10).optional(),
  GOOGLE_REDIRECT_URI: z.url().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().min(40).optional(),
  // Azure Communication Services Email, for the product's own emails (confirm an address, reset a password). Both or neither.
  MAIL_CONNECTION_STRING: z.string().min(20).optional(),
  MAIL_FROM: z.email().optional(),
  // Reminders by email need the email service above. Set to false to keep them off.
  REMINDERS: z.enum(['true', 'false']).default('true'),
  // Refuse a password found in a list of leaked passwords (asks api.pwnedpasswords.com with five characters of its hash, never the password).
  BREACH_CHECK: z.enum(['true', 'false']).default('false'),
  // Viva on the server. The administrator lists which model providers may be used; each listed one needs its key. Keys come from the secret store, never from the repository.
  AI_PROVIDERS: z.string().default(''),
  AI_PER_USER_PER_HOUR: z.coerce.number().int().min(1).max(1000).default(30),
  OPENAI_API_KEY: z.string().min(10).optional(),
  ANTHROPIC_API_KEY: z.string().min(10).optional(),
  GEMINI_API_KEY: z.string().min(10).optional(),
  OPENAI_MODEL: z.string().regex(MODEL_NAME, 'a model name').default('gpt-4o-mini'),
  ANTHROPIC_MODEL: z.string().regex(MODEL_NAME, 'a model name').default('claude-sonnet-5-5'),
  GEMINI_MODEL: z.string().regex(MODEL_NAME, 'a model name').default('gemini-2.0-flash'),
}).refine(v => (v.MAIL_CONNECTION_STRING === undefined) === (v.MAIL_FROM === undefined), { message: 'MAIL_CONNECTION_STRING and MAIL_FROM must be set together', path: ['MAIL_FROM'] })
  .refine(v => (v.STORAGE_ACCOUNT === undefined) === (v.STORAGE_KEY === undefined), { message: 'STORAGE_ACCOUNT and STORAGE_KEY must be set together', path: ['STORAGE_KEY'] })
  .refine(v => [v.GOOGLE_CLIENT_ID, v.GOOGLE_CLIENT_SECRET, v.GOOGLE_REDIRECT_URI, v.TOKEN_ENCRYPTION_KEY].every(x => x === undefined) || [v.GOOGLE_CLIENT_ID, v.GOOGLE_CLIENT_SECRET, v.GOOGLE_REDIRECT_URI, v.TOKEN_ENCRYPTION_KEY].every(x => x !== undefined),
    { message: 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI and TOKEN_ENCRYPTION_KEY must be set together', path: ['GOOGLE_CLIENT_ID'] });

export type AiProviderId = 'openai' | 'anthropic' | 'gemini';
export const AI_PROVIDER_IDS: readonly AiProviderId[] = ['openai', 'anthropic', 'gemini'];
export interface AiProviderConfig { id: AiProviderId; key: string; model: string }

export interface Config {
  databaseUrl: string;
  databaseSsl: boolean;
  port: number;
  /** The browser origins allowed to call the API, each exactly `scheme://host[:port]`. */
  allowedOrigins: readonly string[];
  cookieSecure: boolean;
  /** How many proxies sit in front of the API, so the client address is read from the right place in X-Forwarded-For. */
  trustProxyHops: number;
  sessionHours: number;
  rememberDays: number;
  /** Where attachments are kept; absent when no storage account is configured. */
  storage?: { account: string; key: string; container: string };
  /** The Google client of this product and the key that protects the tokens it is given; absent when Google is not set up. */
  google?: { clientId: string; clientSecret: string; redirectUri: string; tokenKey: string };
  /** The email service for the product's own emails; absent when none is set up. */
  mail?: { connectionString: string; from: string };
  /** Whether the clock that sends reminders runs (only with the email service set up). */
  reminders: boolean;
  /** Whether a new password is checked against the list of leaked passwords. */
  breachCheck: boolean;
  /** The model providers the administrator allowed, each with its key; empty when Viva on the server is not set up. */
  ai: { providers: readonly AiProviderConfig[]; perUserPerHour: number };
}

export const CONFIG = Symbol('CONFIG');

function parseOrigins(list: string): string[] {
  return list.split(',').map(s => s.trim()).filter(Boolean).map(value => {
    let origin: string;
    try { origin = new URL(value).origin; } catch { throw new Error(`ALLOWED_ORIGINS: "${value}" is not a web address`); }
    if (origin !== value) throw new Error(`ALLOWED_ORIGINS: use only scheme, host and port, like ${origin}`);
    return origin;
  });
}

type Parsed = z.infer<typeof schema>;

/** The allow-list: only a provider named in AI_PROVIDERS is used, and naming one without its key (or an unknown one) stops the start-up. */
function parseAiProviders(v: Parsed): AiProviderConfig[] {
  const keys: Record<AiProviderId, [string | undefined, string]> = { openai: [v.OPENAI_API_KEY, v.OPENAI_MODEL], anthropic: [v.ANTHROPIC_API_KEY, v.ANTHROPIC_MODEL], gemini: [v.GEMINI_API_KEY, v.GEMINI_MODEL] };
  const listed = [...new Set(v.AI_PROVIDERS.split(',').map(s => s.trim().toLowerCase()).filter(Boolean))];
  return listed.map(name => {
    if (!(AI_PROVIDER_IDS as readonly string[]).includes(name)) throw new Error(`Invalid settings: AI_PROVIDERS: "${name}" is not one of ${AI_PROVIDER_IDS.join(', ')}`);
    const [key, model] = keys[name as AiProviderId];
    if (!key) throw new Error(`Invalid settings: AI_PROVIDERS lists ${name} but its key is not set`);
    return { id: name as AiProviderId, key, model };
  });
}

/** Reads the settings from the environment and fails at start-up, with a plain message, when one is missing or wrong. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid settings: ${parsed.error.issues.map(i => `${i.path.join('.') || 'settings'}: ${i.message}`).join('; ')}`);
  }
  const v = parsed.data;
  return {
    databaseUrl: v.DATABASE_URL,
    databaseSsl: v.DATABASE_SSL === 'require',
    port: v.PORT,
    allowedOrigins: parseOrigins(v.ALLOWED_ORIGINS),
    cookieSecure: v.COOKIE_SECURE === 'true',
    trustProxyHops: v.TRUST_PROXY_HOPS,
    sessionHours: v.SESSION_HOURS,
    rememberDays: v.REMEMBER_DAYS,
    ...(v.GOOGLE_CLIENT_ID && v.GOOGLE_CLIENT_SECRET && v.GOOGLE_REDIRECT_URI && v.TOKEN_ENCRYPTION_KEY
      ? { google: { clientId: v.GOOGLE_CLIENT_ID, clientSecret: v.GOOGLE_CLIENT_SECRET, redirectUri: v.GOOGLE_REDIRECT_URI, tokenKey: v.TOKEN_ENCRYPTION_KEY } } : {}),
    reminders: v.REMINDERS === 'true',
    breachCheck: v.BREACH_CHECK === 'true',
    ai: { providers: parseAiProviders(v), perUserPerHour: v.AI_PER_USER_PER_HOUR },
    ...(v.MAIL_CONNECTION_STRING && v.MAIL_FROM ? { mail: { connectionString: v.MAIL_CONNECTION_STRING, from: v.MAIL_FROM } } : {}),
    ...(v.STORAGE_ACCOUNT && v.STORAGE_KEY ? { storage: { account: v.STORAGE_ACCOUNT, key: v.STORAGE_KEY, container: v.STORAGE_CONTAINER } } : {}),
  };
}
