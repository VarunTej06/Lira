import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { acceptInvitation } from '../../services/accessApi';
import { appStorage } from '../../utils/appStorage';
import { WORKSPACE_KEY } from '../../utils/hostedOrg';
import { goTo } from '../../utils/navigate';
import { withNext } from '../../utils/nextPath';
import { BTN, BTN_GHOST, PAGE_WIDTH } from './styles';

type Outcome = { state: 'idle' } | { state: 'busy' } | { state: 'joined'; orgName: string; orgId: string } | { state: 'failed'; status: number; message: string };

/**
 * Where the link in an invitation lands. The person must be signed in (or sign up) with the email the invitation was sent to; the
 * server checks that, and checks the link has not been used or expired. Nothing happens until they press the button.
 */
export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const back = `/invite?token=${token}`; // after logging in or signing up, the person comes back here to accept
  const [outcome, setOutcome] = useState<Outcome>({ state: 'idle' });

  const accept = async () => {
    setOutcome({ state: 'busy' });
    const r = await acceptInvitation(token);
    setOutcome(r.ok ? { state: 'joined', orgName: r.data.orgName, orgId: r.data.orgId } : { state: 'failed', status: r.status, message: r.message });
  };

  return (
    <section className={`${PAGE_WIDTH} max-w-xl py-20 flex flex-col items-center gap-4 text-center`}>
      <h1 className="text-3xl font-bold tracking-tight">Join an organisation</h1>
      {!token && <p role="alert">This invitation link is not complete. Ask the person who invited you to send it again.</p>}
      {token && outcome.state !== 'joined' && (
        <>
          <p className="text-lira-muted">Sign in, or sign up, with the email address this invitation was sent to. Then accept it here.</p>
          <button type="button" disabled={outcome.state === 'busy'} onClick={() => { void accept(); }} className={BTN}>{outcome.state === 'busy' ? 'Joining' : 'Accept invitation'}</button>
        </>
      )}
      {outcome.state === 'failed' && (
        <div role="alert" className="flex flex-col items-center gap-3">
          <p>{outcome.status === 401 ? 'You are not signed in yet.' : outcome.message}</p>
          {outcome.status === 401 && <div className="flex gap-3"><Link to={withNext('/login', back)} className={BTN_GHOST}>Log in</Link><Link to={withNext('/signup', back)} className={BTN_GHOST}>Create an account</Link></div>}
        </div>
      )}
      {outcome.state === 'joined' && (
        <div role="status" className="flex flex-col items-center gap-3">
          <p>You have joined <strong>{outcome.orgName}</strong>.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => { appStorage.set(WORKSPACE_KEY, outcome.orgId); goTo('/app'); }} className={BTN}>Open the shared workspace</button>
            <button type="button" onClick={() => goTo('/app')} className={BTN_GHOST}>Open my workspace</button>
          </div>
          <p className="text-ui text-lira-muted">You can switch between them any time from your account menu.</p>
        </div>
      )}
    </section>
  );
}
