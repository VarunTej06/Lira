import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../../services/authApi';
import { emailError } from '../../utils/authForm';
import { AuthCard } from './AuthCard';
import { Field, FormError } from './AuthFields';
import { BTN, LINK } from './styles';

/** Asks for a reset link. The answer is the same whether or not the address has an account, so nobody can use this page to find out who has one. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [serverError, setServerError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setServerError(undefined);
    const problem = emailError(email);
    setError(problem);
    if (problem) return;
    setBusy(true);
    const result = await forgotPassword(email.trim());
    setBusy(false);
    if (result.ok) setSentTo(email.trim());
    else setServerError(result.message);
  }

  if (sentTo) {
    return (
      <AuthCard title="Check your email">
        <p role="status" className="text-ui">If there is an account for <b>{sentTo}</b>, we have sent a link to choose a new password. It works once, for one hour.</p>
        <p className="text-ui text-lira-muted">Nothing in your inbox after a few minutes? Check the spam folder, or ask again.</p>
        <p className="text-ui text-center"><Link to="/login" className={LINK}>Back to log in</Link></p>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Reset your password">
      <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
        <p className="text-ui text-lira-muted">Enter the email of your account and we will send you a link to choose a new password.</p>
        {serverError && <FormError message={serverError} />}
        <Field id="email" label="Email" type="email" autoComplete="email" value={email} error={error} onChange={setEmail} />
        <button type="submit" disabled={busy} className={`${BTN} w-full ${busy ? 'opacity-70' : ''}`}>{busy ? 'Sending' : 'Send the link'}</button>
        <p className="text-ui text-center"><Link to="/login" className={LINK}>Back to log in</Link></p>
      </form>
    </AuthCard>
  );
}
