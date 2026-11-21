import { useGoogleOffered } from '../../hooks/useGoogleOffered';
import { BTN_DISABLED, BTN_GHOST } from './styles';

/** Google's four-colour "G", drawn in the brand colours Google requires for its sign-in button. */
function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}

const LAYOUT = 'inline-flex items-center justify-center gap-2';

/**
 * The "Google" button of the log-in and sign-up pages. When the server has Google set up it is a link that goes to the server, which
 * sends the browser to Google; otherwise it is switched off, so no button ever does nothing. On the sign-up bar (`intent="signup"`)
 * Google is asked once for everything a new owner needs (Meet links, invitation email); on the log-in page only who the person is.
 */
export function GoogleButton({ className = '', intent = 'login' }: { className?: string; intent?: 'login' | 'signup' }) {
  const offered = useGoogleOffered();
  return offered
    ? <a href={intent === 'signup' ? '/api/auth/google/start?intent=signup' : '/api/auth/google/start'} className={`${BTN_GHOST} ${LAYOUT} ${className}`}><GoogleG />Google</a>
    : <button type="button" disabled title="Google sign-in is not set up on this server" className={`${BTN_DISABLED} ${LAYOUT} ${className}`}><GoogleG />Google</button>;
}
