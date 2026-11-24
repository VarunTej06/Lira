import { useEffect, useState } from 'react';
import { fetchProviders, resendVerification } from '../../services/authApi';

/**
 * Hosted edition: a small reminder, shown only to someone whose address is not confirmed yet and only when the server can send email.
 * It floats over the corner instead of pushing the app down, and can be closed until the next visit.
 */
export function VerifyEmailNotice({ email }: { email: string }) {
  const [canSend, setCanSend] = useState(false);
  const [closed, setClosed] = useState(false);
  const [note, setNote] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    void fetchProviders().then(r => { if (current && r.ok && r.data.email === true) setCanSend(true); });
    return () => { current = false; };
  }, []);

  async function again() {
    setBusy(true);
    const result = await resendVerification();
    setBusy(false);
    setNote(result.ok ? 'Sent. Check your inbox.' : result.message);
  }

  if (!canSend || closed) return null;
  return (
    <div role="status" className="fixed bottom-4 left-4 z-50 max-w-xs bg-lira-surface text-lira-text border border-lira-border rounded-lg p-3.5 flex flex-col gap-2 text-ui">
      <p className="font-bold">Confirm your email address</p>
      <p className="text-lira-muted">We sent a link to {email}. Open it to finish setting up your account.</p>
      {note && <p>{note}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => void again()} className="rounded px-3 py-1.5 bg-lira-blue text-lira-on-blue font-bold disabled:opacity-70">Send it again</button>
        <button type="button" onClick={() => setClosed(true)} className="rounded px-3 py-1.5 border border-lira-border">Not now</button>
      </div>
    </div>
  );
}
