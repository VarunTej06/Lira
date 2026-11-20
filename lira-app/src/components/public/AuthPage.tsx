import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LiraLogo } from '../common/LiraLogo';
import { login } from '../../services/authApi';
import { validateAuth, type AuthErrors } from '../../utils/authForm';
import { goTo } from '../../utils/navigate';
import { Field, FormError } from './AuthFields';
import { BoardArt, BookArt } from './LoginArt';
import { CONTACT_EMAIL } from './legalText';
import { BTN, BTN_DISABLED, LINK } from './styles';

const FOOTER_LINKS = [['/privacy', 'Privacy Policy'], ['/notice', 'User Notice'], ['/terms', 'Terms of Service']] as const;
const REMEMBER_HELP = 'Keeps you signed in on this device for 30 days';

/** The log-in page. A correct form goes to the server; on success the app opens. The password is sent once and never kept here. */
export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<AuthErrors>({});
  const [serverError, setServerError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setServerError(undefined);
    const found = validateAuth('login', { name: '', email, password });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    const result = await login({ email: email.trim(), password, remember });
    setBusy(false);
    if (result.ok) goTo('/app');
    else setServerError(result.message);
  }

  return (
    <div className="relative overflow-hidden min-h-screen flex items-center justify-center px-4 py-10">
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-5 bg-lira-border" />
      <BoardArt className="hidden lg:block absolute bottom-5 left-0 lg:w-72 xl:w-96 pointer-events-none" />
      <BookArt className="hidden lg:block absolute bottom-5 right-0 lg:w-72 xl:w-96 pointer-events-none" />
      <form onSubmit={submit} noValidate className="relative w-full max-w-sm bg-lira-surface border border-lira-border rounded-lg p-6 flex flex-col gap-3.5">
        <span className="inline-flex items-center justify-center gap-2.5 font-bold text-xl text-lira-text"><LiraLogo className="w-8 h-8" motion="none" />Liraspaces</span>
        <h1 className="text-base font-bold text-center mt-1">Log in to continue</h1>
        {serverError && <FormError message={serverError} />}
        <Field id="email" label="Email" type="email" autoComplete="email" value={email} error={errors.email} onChange={setEmail} />
        <Field id="password" label="Password" type="password" autoComplete="current-password" value={password} error={errors.password} onChange={setPassword} />
        <div className="flex items-center gap-2 text-ui">
          <input id="remember" type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
          <label htmlFor="remember">Remember me</label>
          <span role="img" aria-label={REMEMBER_HELP} title={REMEMBER_HELP} className="w-4 h-4 rounded-full bg-lira-nav text-white text-3xs font-bold flex items-center justify-center cursor-help">i</span>
        </div>
        <button type="submit" disabled={busy} className={`${BTN} w-full ${busy ? 'opacity-70' : ''}`}>{busy ? 'Signing in' : 'Log in'}</button>
        <p className="text-ui text-lira-muted text-center mt-1">Or continue with:</p>
        <button type="button" disabled title="Google sign-in is not available yet" className={`${BTN_DISABLED} w-full`}>Google</button>
        <p className="text-ui text-center">
          <a href={`mailto:${CONTACT_EMAIL}?subject=Cannot%20log%20in`} className={LINK}>Can't log in?</a>
          <span aria-hidden="true" className="mx-2 text-lira-muted">•</span>
          <Link to="/signup" className={LINK}>Create an account</Link>
        </p>
        <div className="border-t border-lira-border pt-4 flex flex-col items-center gap-2 text-center">
          <span className="font-bold text-lira-text">Liraspaces</span>
          <p className="text-xs text-lira-muted">One account for your learning and work.</p>
          <p className="text-xs flex flex-wrap justify-center gap-x-3">
            {FOOTER_LINKS.map(([to, label]) => <Link key={to} to={to} className={LINK}>{label}</Link>)}
          </p>
        </div>
      </form>
    </div>
  );
}
