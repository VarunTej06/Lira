import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LiraLogo } from '../common/LiraLogo';
import { validateAuth, type AuthErrors, type AuthValues } from '../../utils/authForm';
import { BoardArt, BookArt } from './LoginArt';
import { CONTACT_EMAIL } from './legalText';
import { BTN, BTN_DISABLED, LINK } from './styles';

const INPUT = 'bg-lira-bg border border-lira-border rounded px-3 py-2 text-ui text-lira-text min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lira-blue';
const FOOTER_LINKS = [['/privacy', 'Privacy Policy'], ['/notice', 'User Notice'], ['/terms', 'Terms of Service']] as const;
const REMEMBER_HELP = 'Keeps you signed in on this device for 30 days';

interface FieldProps { id: string; label: string; type: string; value: string; error?: string; autoComplete: string; onChange: (value: string) => void }

function Field({ id, label, type, value, error, autoComplete, onChange }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ui font-medium text-lira-text">{label}</label>
      <input id={id} type={type} value={value} autoComplete={autoComplete} placeholder={`Enter your ${id}`} aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined} onChange={e => onChange(e.target.value)} className={INPUT} />
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-lira-blue-text">{error}</p>}
    </div>
  );
}

/**
 * The log-in page. There is no server yet, so a correct form is not sent anywhere: the page says so instead of pretending
 * to sign anyone in. Nothing typed here is stored or logged.
 */
export default function AuthPage() {
  const [values, setValues] = useState<AuthValues>({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<AuthErrors>({});
  const [sent, setSent] = useState(false);
  const [remember, setRemember] = useState(false);

  const set = (field: keyof AuthValues) => (value: string) => setValues(v => ({ ...v, [field]: value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    const found = validateAuth('login', values);
    setErrors(found);
    setSent(Object.keys(found).length === 0);
  }

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-4rem)] flex justify-center px-4 py-10">
      <BoardArt className="hidden lg:block absolute bottom-0 left-0 w-80 pointer-events-none" />
      <BookArt className="hidden lg:block absolute bottom-0 right-0 w-80 pointer-events-none" />
      <form onSubmit={submit} noValidate className="relative w-full max-w-sm self-start bg-lira-surface border border-lira-border rounded-lg p-6 flex flex-col gap-3.5">
        <span className="inline-flex items-center justify-center gap-2.5 font-bold text-xl text-lira-text"><LiraLogo className="w-8 h-8" motion="none" />Liraspaces</span>
        <h1 className="text-base font-bold text-center mt-1">Log in to continue</h1>
        {sent && (
          <p role="status" className="text-ui bg-lira-blue-light border border-lira-border rounded px-3 py-2.5">
            Signing in opens when the hosted service launches. Nothing you typed was sent or saved.
          </p>
        )}
        <Field id="email" label="Email" type="email" autoComplete="email" value={values.email} error={errors.email} onChange={set('email')} />
        <Field id="password" label="Password" type="password" autoComplete="current-password" value={values.password} error={errors.password} onChange={set('password')} />
        <div className="flex items-center gap-2 text-ui">
          <input id="remember" type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
          <label htmlFor="remember">Remember me</label>
          <span role="img" aria-label={REMEMBER_HELP} title={REMEMBER_HELP} className="w-4 h-4 rounded-full bg-lira-nav text-white text-3xs font-bold flex items-center justify-center cursor-help">i</span>
        </div>
        <button type="submit" className={`${BTN} w-full`}>Log in</button>
        <p className="text-ui text-lira-muted text-center mt-1">Or continue with:</p>
        <button type="button" disabled title="Google sign-in opens with the hosted service" className={`${BTN_DISABLED} w-full`}>Google</button>
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
