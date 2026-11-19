/**
 * Which edition this build is. The hosted edition (built with `--mode hosted`) shows the public pages at the root and keeps the
 * app under /app. The local edition, which is the default, is the app on its own at the root, exactly as before.
 */
export type Edition = 'hosted' | 'local';

export const APP_BASE = '/app';

export const parseEdition = (mode: unknown): Edition => (mode === 'hosted' ? 'hosted' : 'local');

export const EDITION: Edition = parseEdition(import.meta.env.MODE);

export const isHosted = (edition: Edition = EDITION): boolean => edition === 'hosted';

const isInsideApp = (pathname: string): boolean => pathname === APP_BASE || pathname.startsWith(`${APP_BASE}/`);

/** Whether this address belongs to the public pages (landing, log in, legal) rather than to the app. */
export const showsPublicSite = (edition: Edition, pathname: string): boolean => edition === 'hosted' && !isInsideApp(pathname);

/** The router's base path: the app lives under /app in the hosted edition, so none of its own page paths change. */
export const appBasename = (edition: Edition): string | undefined => (edition === 'hosted' ? APP_BASE : undefined);
