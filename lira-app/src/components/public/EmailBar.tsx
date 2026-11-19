import { useState, type FormEvent } from 'react';
import { emailError } from '../../utils/authForm';
import { BTN, BTN_DISABLED } from './styles';

const INPUT = 'flex-1 min-w-0 bg-transparent px-3 py-2 text-base text-lira-text placeholder:text-lira-muted outline-none';

/** The email field with its Sign up button, and the Google option beside it. It checks the email and then hands it on. */
export function EmailBar({ id, initial = '', onValid }: { id: string; initial?: string; onValid: (email: string) => void }) {
  const [email, setEmail] = useState(initial);
  const [error, setError] = useState<string>();

  function submit(e: FormEvent) {
    e.preventDefault();
    const problem = emailError(email);
    setError(problem);
    if (!problem) onValid(email.trim());
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col items-center gap-2 w-full max-w-2xl">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
        <div className="flex w-full sm:w-auto sm:flex-1 items-center gap-2 bg-lira-surface border border-lira-border rounded-xl p-1.5 focus-within:outline focus-within:outline-2 focus-within:outline-lira-blue focus-within:outline-offset-2">
          <label htmlFor={id} className="sr-only">Email</label>
          <input id={id} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" autoComplete="email"
            aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} className={INPUT} />
          <button type="submit" className={`${BTN} rounded-lg`}>Sign up</button>
        </div>
        <span className="text-ui text-lira-muted">or</span>
        <button type="button" disabled title="Google sign-in opens with the hosted service" className={`${BTN_DISABLED} rounded-xl`}>Google</button>
      </div>
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-lira-blue-text self-start">{error}</p>}
    </form>
  );
}
