import { useCallback } from 'react';
import { useNavigate, type NavigateOptions, type To } from 'react-router-dom';
import { hasLeaveGuard, mayLeave } from '../utils/leaveGuard';

/** `useNavigate`, except that a page holding a leave guard is asked first. With no guard it goes at once, exactly as before. */
export function useGuardedNavigate(): (to: To | number, options?: NavigateOptions) => void {
  const navigate = useNavigate();
  return useCallback((to, options) => {
    const go = () => (typeof to === 'number' ? navigate(to) : navigate(to, options));
    if (!hasLeaveGuard()) { go(); return; }
    void mayLeave().then(ok => { if (ok) go(); });
  }, [navigate]);
}
