import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppSkeleton } from '../common/Skeleton';
import { EmailBar } from './EmailBar';
import { LINK } from './styles';

const MAX_EMAIL = 254;

/** A hand-drawn gold line under a word of the title. */
function Underline() {
  return (
    <svg viewBox="0 0 120 12" aria-hidden="true" className="absolute left-0 -bottom-2 w-full h-3 stroke-logo-gold" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8C16 2 22 11 36 6S58 3 72 7 100 5 117 6" />
    </svg>
  );
}

/**
 * The sign-up page: a small window over the app drawn as grey placeholder shapes. There is no server yet, so a valid email is
 * not sent anywhere and the page says so. The email typed on the landing page arrives here in the address.
 */
export default function GetStartedPage() {
  const [params] = useSearchParams();
  const [sent, setSent] = useState(false);
  const initial = (params.get('email') ?? '').slice(0, MAX_EMAIL);
  return (
    <div className="fixed inset-0 z-50">
      <AppSkeleton label="Liraspaces" />
      <div className="absolute inset-0 bg-black/45 flex items-center justify-center px-4">
        <div role="dialog" aria-modal="true" aria-labelledby="get-started-title" className="relative w-full max-w-xl bg-lira-surface text-lira-text border border-lira-border rounded-xl px-6 sm:px-12 py-12 flex flex-col items-center gap-5 text-center">
          <Link to="/" aria-label="Close" className="absolute top-3 right-4 text-2xl leading-none text-lira-muted hover:text-lira-text">×</Link>
          <h1 id="get-started-title" className="text-3xl sm:text-4xl font-bold tracking-tight">
            Get <span className="relative inline-block">started<Underline /></span> with Liraspaces
          </h1>
          <p className="text-lira-muted">Free while we build it. No credit card needed.</p>
          <div className="w-full flex flex-col items-start gap-1.5 mt-2">
            <span className="text-ui font-medium">Email</span>
            <EmailBar id="start-email" initial={initial} onValid={() => setSent(true)} />
          </div>
          {sent && (
            <p role="status" className="text-ui bg-lira-blue-light border border-lira-border rounded px-3 py-2.5">
              Sign-up opens when the hosted service launches. Nothing you typed was sent or saved.
            </p>
          )}
          <p className="text-ui text-lira-muted">Already have an account? <Link to="/login" className={LINK}>Log in</Link></p>
        </div>
      </div>
    </div>
  );
}
