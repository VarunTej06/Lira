const INVITE = /^\/invite\?token=[A-Za-z0-9_-]{43}$/;

/**
 * Where to go after signing in or signing up: back to the invitation the person came from, or the app. Only an invitation address is
 * accepted, so a crafted link cannot send anyone to another page or site after they log in.
 */
export function nextAfterSignIn(next: string | null): string {
  return next !== null && INVITE.test(next) ? next : '/app';
}

/** The log-in and sign-up addresses that bring the person back to an invitation. */
export const withNext = (path: '/login' | '/signup', next: string): string => `${path}?next=${encodeURIComponent(next)}`;
