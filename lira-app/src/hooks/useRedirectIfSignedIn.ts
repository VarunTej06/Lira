import { useEffect } from 'react';
import { fetchMe } from '../services/authApi';
import { goTo } from '../utils/navigate';

/**
 * On the landing and log-in pages: when the browser still holds a valid session (the tab or the browser was closed without logging out),
 * go straight to the app instead of showing the public page and asking for the password again. Any other answer leaves the page as it is.
 */
export function useRedirectIfSignedIn(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let current = true;
    void fetchMe().then(result => { if (current && result.ok) goTo('/app'); });
    return () => { current = false; };
  }, [active]);
}
