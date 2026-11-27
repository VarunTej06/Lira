import { useState, type FormEvent } from 'react';
import { loginTwoStep } from '../../services/authApi';
import { goTo } from '../../utils/navigate';
import { Field, FormError } from './AuthFields';
import { BTN, LINK } from './styles';

/** The second step of logging in when two-step sign-in is on: the six digits from the authenticator app, or a recovery code. */
export function TwoStepForm({ challenge, next, onBack }: { challenge: string; next: string; onBack: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (!code.trim()) { setError('Enter the code.'); return; }
    setBusy(true);
    const result = await loginTwoStep(challenge, code.trim());
    setBusy(false);
    if (result.ok) goTo(next); else setError(result.message);
  }

  return (
    <form onSubmit={submit} noValidate className="relative w-full max-w-sm bg-lira-surface border border-lira-border rounded-lg p-6 flex flex-col gap-3.5">
      <h1 className="text-base font-bold text-center">Enter your code</h1>
      <p className="text-ui text-lira-muted">Open your authenticator app and type the six digits it shows for Liraspaces. If you lost your phone, type one of your recovery codes.</p>
      {error && <FormError message={error} />}
      <Field id="code" label="Code" type="text" autoComplete="one-time-code" value={code} onChange={setCode} placeholder="123456" />
      <button type="submit" disabled={busy} className={`${BTN} w-full ${busy ? 'opacity-70' : ''}`}>{busy ? 'Checking' : 'Continue'}</button>
      <p className="text-ui text-center"><button type="button" onClick={onBack} className={LINK}>Back to log in</button></p>
    </form>
  );
}
