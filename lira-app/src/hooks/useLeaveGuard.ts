import { useEffect } from 'react';
import { setLeaveGuard } from '../utils/leaveGuard';

/**
 * While `message` is set, going to another page of the app asks first (see `useGuardedNavigate`), and closing or reloading the tab
 * shows the browser's own question. Pass null when there is nothing to lose.
 */
export function useLeaveGuard(message: string | null): void {
  useEffect(() => {
    setLeaveGuard(message);
    if (message === null) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); setLeaveGuard(null); };
  }, [message]);
}
