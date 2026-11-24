import { useEffect, useState, type ReactNode } from 'react';
import { AppSkeleton } from '../common/Skeleton';
import { VerifyEmailNotice } from './VerifyEmailNotice';
import { fetchMe } from '../../services/authApi';
import { startHostedKv } from '../../services/kvMirror';
import { appStorage } from '../../utils/appStorage';
import { WORKSPACE_KEY, chooseOrg } from '../../utils/hostedOrg';
import { applyServerProfile } from '../../utils/hostedProfile';
import { goTo } from '../../utils/navigate';
import { paintTheme } from '../../utils/theme';

type Phase = 'checking' | 'in' | 'out' | 'error';

/**
 * Hosted edition only: shows the app to someone who is signed in, and sends everyone else to the log-in page. The server decides;
 * this only asks it (the UI hiding the app is not a control, every API call is checked again there). Before the app shows, the
 * person's settings-style data is loaded from the server, replacing anything an earlier account left in this browser.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [attempt, setAttempt] = useState(0);
  const [unconfirmed, setUnconfirmed] = useState<string>();

  useEffect(() => {
    let current = true;
    void fetchMe().then(async result => {
      if (!current) return;
      if (result.ok) {
        const orgId = chooseOrg(result.data.organisations, appStorage.get(WORKSPACE_KEY))?.orgId;
        if (orgId && !(await startHostedKv(orgId))) { if (current) setPhase('error'); return; }
        if (!current) return;
        applyServerProfile(result.data);
        setUnconfirmed(result.data.user.emailVerified === false ? result.data.user.email : undefined);
        paintTheme(); // the person's saved look, the same one the public pages showed
        setPhase('in');
        return;
      }
      if (result.status === 401) { setPhase('out'); goTo('/login'); return; }
      setPhase('error');
    });
    return () => { current = false; };
  }, [attempt]);

  if (phase === 'in') return <>{children}{unconfirmed && <VerifyEmailNotice email={unconfirmed} />}</>;
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
