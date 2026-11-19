import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppSkeleton } from '../common/Skeleton';
import { signup } from '../../services/authApi';
import { MIN_PASSWORD, validateAuth, type AuthErrors } from '../../utils/authForm';
import { goTo } from '../../utils/navigate';
import { Field, FormError } from './AuthFields';
import { EmailBar } from './EmailBar';
import { BTN, LINK } from './styles';

const MAX_EMAIL = 254;

/** A hand-drawn gold line under a word of the title. */
function Underline() {
  return (
    <svg viewBox="0 0 120 12" aria-hidden="true" className="absolute left-0 -bottom-2 w-full h-3 stroke-logo-gold" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8C16 2 22 11 36 6S58 3 72 7 100 5 117 6" />
    </svg>
  );
}

/** Step two of sign-up: the name and a password for the email already given. */
function DetailsForm({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<AuthErrors>({});
  const [serverError, setServerError] = useState<string>();
  const [exists, setExists] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setServerError(undefined);
    setExists(false);
    const found = validateAuth('signup', { name, email, password });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    const result = await signup({ name: name.trim(), email, password });
    setBusy(false);
    if (result.ok) { goTo('/app'); return; }
    setErrors(result.fields ?? {});
    setExists(result.status === 409);
    setServerError(result.message);
  }

  return (
    <form onSubmit={submit} noValidate className="w-full flex flex-col gap-3.5 text-left">
      <p className="text-ui text-lira-muted">Creating an account for <b className="text-lira-text">{email}</b>. <button type="button" onClick={onChangeEmail} className={LINK}>Use a different email</button></p>
      {serverError && <FormError message={serverError} />}
      {exists && <p className="text-ui">Already have an account? <Link to="/login" className={LINK}>Log in</Link></p>}
      <Field id="name" label="Name" type="text" autoComplete="name" value={name} error={errors.name} placeholder="Your name" onChange={setName} />
      <Field id="password" label="Password" type="password" autoComplete="new-password" value={password} error={errors.password}
        hint={`At least ${MIN_PASSWORD} characters.`} placeholder="Choose a password" onChange={setPassword} />
      <button type="submit" disabled={busy} className={`${BTN} w-full ${busy ? 'opacity-70' : ''}`}>{busy ? 'Creating your account' : 'Create account'}</button>
      <p className="text-xs text-lira-muted">By creating an account you accept the <Link to="/terms" className={LINK}>Terms of Service</Link> and the <Link to="/privacy" className={LINK}>Privacy Policy</Link>.</p>
    </form>
  );
}

/**
 * The sign-up page: a small window over the app drawn as grey placeholder shapes. Step one asks for the email (the one typed on
 * the landing page arrives in the address); step two asks for a name and a password, and the account is created on the server.
 */
export default function GetStartedPage() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState<string>();
  const initial = (params.get('email') ?? '').slice(0, MAX_EMAIL);
  return (
    <div className="fixed inset-0 z-50">
      <AppSkeleton label="Liraspaces" />
      <div className="absolute inset-0 bg-black/45 flex items-center justify-center px-4 overflow-y-auto">
        <div role="dialog" aria-modal="true" aria-labelledby="get-started-title" className="relative w-full max-w-xl bg-lira-surface text-lira-text border border-lira-border rounded-xl px-6 sm:px-12 py-12 flex flex-col items-center gap-5 text-center">
          <Link to="/" aria-label="Close" className="absolute top-3 right-4 text-2xl leading-none text-lira-muted hover:text-lira-text">×</Link>
          <h1 id="get-started-title" className="text-3xl sm:text-4xl font-bold tracking-tight">
            Get <span className="relative inline-block">started<Underline /></span> with Liraspaces
          </h1>
          <p className="text-lira-muted">Free while we build it. No credit card needed.</p>
          {email === undefined ? (
            <div className="w-full flex flex-col items-start gap-1.5 mt-2">
              <span className="text-ui font-medium">Email</span>
              <EmailBar id="start-email" initial={initial} onValid={setEmail} />
            </div>
          ) : <DetailsForm email={email} onChangeEmail={() => setEmail(undefined)} />}
          <p className="text-ui text-lira-muted">Already have an account? <Link to="/login" className={LINK}>Log in</Link></p>
        </div>
      </div>
    </div>
  );
}
