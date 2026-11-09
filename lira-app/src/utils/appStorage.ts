/**
 * The one door to the browser's saved settings (localStorage). Screens and hooks use this instead of touching
 * `localStorage` directly, so there is a single place to prefix keys per signed-in user and to clear everything on sign-out
 * (multi-user stage). It adds no error handling of its own: callers that must survive a blocked or full store keep their
 * own try/catch, exactly as before.
 */
export const appStorage = {
  get: (key: string): string | null => localStorage.getItem(key),
  set: (key: string, value: string): void => localStorage.setItem(key, value),
  remove: (key: string): void => localStorage.removeItem(key),
};
