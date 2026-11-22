import { useState } from 'react';
import { disconnectGoogle, startGoogleConnect, type GoogleStatus } from '../../services/standupsApi';
import { BUTTON } from '../teams/teamsUi';

/**
 * The Owner connects a Google account here. It then makes the Meet link of each stand-up and sends the invitation emails, from that
 * account. Only the Owner sees this; the server checks it again.
 */
export function GooglePanel({ org, status, reload }: { org: string; status: GoogleStatus; reload: () => void }) {
  const [problem, setProblem] = useState('');

  const connect = async () => {
    setProblem('');
    const r = await startGoogleConnect(org);
    if (r.ok) window.location.assign(r.data.url); else setProblem(r.message);
  };
  const disconnect = async () => {
    setProblem('');
    const r = await disconnectGoogle(org);
    if (r.ok) reload(); else setProblem(r.message);
  };

  if (!status.configured) return <p className="text-ui text-lira-muted border border-lira-border rounded-lg p-3">Google is not set up on this server yet, so paste a Meet or Teams link when you schedule, and no emails are sent.</p>;
  return (
    <section aria-label="Google" className="border border-lira-border rounded-lg p-3 flex flex-wrap items-center gap-3">
      <p className="flex-1 min-w-60 text-ui">
        {status.connected
          ? <>Google is connected as <strong>{status.email}</strong>. Meet links are made and invitation emails are sent from this account.</>
          : 'Connect a Google account so the app can make the Meet link for each stand-up and email everyone invited. You choose which account, and you can disconnect it at any time.'}
      </p>
      {status.connected
        ? <button type="button" onClick={() => { void disconnect(); }} className="rounded px-3 py-1.5 text-ui border border-lira-border">Disconnect Google</button>
        : <button type="button" onClick={() => { void connect(); }} className={BUTTON}>Connect Google</button>}
      {problem && <p role="alert" className="basis-full text-ui text-red-600">{problem}</p>}
    </section>
  );
}
