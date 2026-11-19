import { useEffect, useState, type ReactNode } from 'react';
import { AppSkeleton } from '../common/Skeleton';
import { fetchMe } from '../../services/authApi';
import { goTo } from '../../utils/navigate';

type Phase = 'checking' | 'in' | 'out' | 'error';

/**
 * Hosted edition only: shows the app to someone who is signed in, and sends everyone else to the log-in page. The server decides;
 * this only asks it (the UI hiding the app is not a control, every API call is checked again there).
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    void fetchMe().then(result => {
      if (!current) return;
      if (result.ok) { setPhase('in'); return; }
      if (result.status === 401) { setPhase('out'); goTo('/login'); return; }
      setPhase('error');
    });
    return () => { current = false; };
  }, [attempt]);

  if (phase === 'in') return <>{children}</>;
  if (phase === 'error') {
    return (
      <div role="alert" className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center bg-lira-bg text-lira-text">
        <p className="font-bold">Liraspaces could not check your session.</p>
        <p className="text-lira-muted text-ui">The server did not answer. Check your connection and try again.</p>
        <button type="button" onClick={() => { setPhase('checking'); setAttempt(n => n + 1); }} className="rounded px-4 py-2 bg-lira-blue text-lira-on-blue font-bold">Try again</button>
      </div>
    );
  }
  return <AppSkeleton label="Checking your session" />;
}
