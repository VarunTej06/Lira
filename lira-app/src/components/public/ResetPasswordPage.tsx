import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../../services/authApi';
import { MIN_PASSWORD, validateAuth } from '../../utils/authForm';
import { AuthCard } from './AuthCard';
import { Field, FormError } from './AuthFields';
import { BTN, LINK } from './styles';

/** The page the reset link opens: choose a new password. The link's token is sent once and never shown or kept. */
export default function ResetPasswordPage() {
  const token = useSearchParams()[0].get('token') ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [serverError, setServerError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setServerError(undefined);
    const problem = validateAuth('signup', { name: 'x', email: 'x@x.xx', password }).password;
    setError(problem);
    if (problem) return;
    setBusy(true);
    const result = await resetPassword(token, password);
    setBusy(false);
    if (result.ok) setDone(true);
    else setServerError(result.message);
  }

  if (done) {
    return (
      <AuthCard title="Password changed">
        <p role="status" className="text-ui">Your password is changed and you were signed out everywhere. Log in with the new one.</p>
        <Link to="/login" className={`${BTN} w-full`}>Log in</Link>
      </AuthCard>
    );
  }
  if (!token) {
    return (
      <AuthCard title="This link is not valid">
        <p className="text-ui">Open the link from the email exactly as it came, or ask for a new one.</p>
        <p className="text-ui text-center"><Link to="/forgot-password" className={LINK}>Ask for a new link</Link></p>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Choose a new password">
      <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
        {serverError && <FormError message={serverError} />}
        {serverError && <p className="text-ui"><Link to="/forgot-password" className={LINK}>Ask for a new link</Link></p>}
        <Field id="password" label="New password" type="password" autoComplete="new-password" value={password} error={error}
          hint={`At least ${MIN_PASSWORD} characters.`} placeholder="Choose a password" onChange={setPassword} />
        <button type="submit" disabled={busy} className={`${BTN} w-full ${busy ? 'opacity-70' : ''}`}>{busy ? 'Saving' : 'Save the new password'}</button>
      </form>
    </AuthCard>
  );
}
